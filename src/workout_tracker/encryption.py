from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from .config import CryptoSettings, settings


class EncryptionError(Exception):
    pass


@dataclass(slots=True)
class EncryptionContext:
    token: str
    salt: bytes
    wrapped_key: bytes


class EncryptionService:
    def __init__(self, crypto_settings: CryptoSettings | None = None) -> None:
        self._crypto_settings = crypto_settings or CryptoSettings()

    def _derive_wrapping_key(self, token: str, salt: bytes) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=self._crypto_settings.derived_key_bytes,
            salt=salt,
            iterations=settings.kdf_iterations,
        )
        return base64.urlsafe_b64encode(kdf.derive(token.encode("utf-8")))

    def create_user_envelope(self, token: str) -> tuple[bytes, bytes]:
        salt = os.urandom(self._crypto_settings.salt_bytes)
        data_key = Fernet.generate_key()
        wrapping_key = self._derive_wrapping_key(token, salt)
        envelope = Fernet(wrapping_key).encrypt(data_key)
        return salt, envelope

    def unwrap_data_key(self, ctx: EncryptionContext) -> bytes:
        try:
            wrapping_key = self._derive_wrapping_key(ctx.token, ctx.salt)
            return Fernet(wrapping_key).decrypt(ctx.wrapped_key)
        except InvalidToken as exc:  # pragma: no cover - runtime protection
            raise EncryptionError("Unable to unlock user data") from exc

    def encrypt_payload(self, data_key: bytes, payload: dict[str, Any]) -> bytes:
        serialized = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
        return Fernet(data_key).encrypt(serialized)

    def decrypt_payload(self, data_key: bytes, blob: bytes) -> dict[str, Any]:
        try:
            raw = Fernet(data_key).decrypt(blob)
            return json.loads(raw.decode("utf-8"))
        except InvalidToken as exc:  # pragma: no cover - runtime protection
            raise EncryptionError("Payload decryption failed") from exc

    def rotate_envelope(self, data_key: bytes, new_token: str) -> tuple[bytes, bytes]:
        salt = os.urandom(self._crypto_settings.salt_bytes)
        wrapping_key = self._derive_wrapping_key(new_token, salt)
        envelope = Fernet(wrapping_key).encrypt(data_key)
        return salt, envelope
