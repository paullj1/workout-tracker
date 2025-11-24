from __future__ import annotations

import json
import time
from typing import Any

import httpx
import jwt

from ..config import settings

APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token"
_cached_keys: list[dict[str, Any]] | None = None
_cache_expiration: float = 0


async def _fetch_keys() -> list[dict[str, Any]]:
    global _cached_keys, _cache_expiration
    if _cached_keys and _cache_expiration > time.time():
        return _cached_keys
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(APPLE_KEYS_URL)
        resp.raise_for_status()
        _cached_keys = resp.json().get("keys", [])
        _cache_expiration = time.time() + 3600
        return _cached_keys


async def verify_identity_token(identity_token: str, audience: str) -> dict[str, Any]:
    header = jwt.get_unverified_header(identity_token)
    keys = await _fetch_keys()
    key = next((k for k in keys if k.get("kid") == header.get("kid")), None)
    if not key:
        raise ValueError("Apple public key not found")
    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
    data = jwt.decode(
        identity_token,
        key=public_key,
        algorithms=[header.get("alg", "RS256")],
        audience=audience,
        issuer="https://appleid.apple.com",
        options={"verify_at_hash": False},
    )
    return data


def _normalize_private_key(raw: str) -> str:
    return raw.replace("\\n", "\n")


def generate_client_secret() -> str:
    required = [settings.apple_team_id, settings.apple_client_id, settings.apple_key_id, settings.apple_private_key]
    if not all(required):
        raise ValueError("Apple Sign In is not fully configured")
    now = int(time.time())
    payload = {
        "iss": settings.apple_team_id,
        "iat": now,
        "exp": now + 300,
        "aud": "https://appleid.apple.com",
        "sub": settings.apple_client_id,
    }
    headers = {"kid": settings.apple_key_id, "alg": "ES256"}
    return jwt.encode(payload, _normalize_private_key(settings.apple_private_key), algorithm="ES256", headers=headers)


async def exchange_authorization_code(code: str) -> dict[str, Any]:
    client_secret = generate_client_secret()
    data = {
        "client_id": settings.apple_client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(APPLE_TOKEN_URL, data=data)
        resp.raise_for_status()
        return resp.json()
