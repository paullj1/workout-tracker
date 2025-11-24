from __future__ import annotations

import base64
import json
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import options_to_json
from webauthn.helpers.exceptions import InvalidAuthenticationResponse, InvalidRegistrationResponse
from webauthn.helpers.structs import (
    AuthenticationCredential,
    AuthenticatorAssertionResponse,
    AuthenticatorAttestationResponse,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    RegistrationCredential,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from ..config import settings
from ..encryption import EncryptionService
from ..models import PasskeyCredential, User
from .challenge_store import consume_challenge, persist_challenge

RP_NAME = "Workout Tracker"


def _encode(challenge: bytes) -> str:
    return base64.urlsafe_b64encode(challenge).decode("ascii")


def _decode(value: str | bytes | None) -> bytes | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        return value
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _normalize_keys(data: dict, mapping: dict[str, str], decode_keys: set[str]) -> dict:
    normalized: dict[str, object] = {}
    for key, value in data.items():
        if key == "clientExtensionResults" or value is None:
            continue
        if value is None:
            continue
        target = mapping.get(key, key)
        if target in decode_keys:
            decoded = _decode(value)
            if decoded is not None:
                normalized[target] = decoded
        else:
            normalized[target] = value
    return normalized


def _extract_client_challenge(client_data_json: bytes) -> bytes:
    payload = json.loads(client_data_json.decode("utf-8"))
    value = payload.get("challenge", "")
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _allowed_origins() -> list[str]:
    origins = []
    for origin in {settings.auth_origin, settings.frontend_base_url}:
        if origin:
            origins.append(origin)
    return origins


def _persist_challenge(db: Session, challenge: bytes, purpose: str, user: User | None = None) -> None:
    persist_challenge(db, _encode(challenge), purpose, user)


def _pull_challenge(
    db: Session, challenge_bytes: bytes, purpose: str, user: User | None = None
) -> tuple[bytes, User | None]:
    target = _encode(challenge_bytes)
    record = consume_challenge(db, target, purpose, user)
    decoded = base64.urlsafe_b64decode(record.challenge.encode("ascii"))
    return decoded, record.user


def _derive_encryption_token(raw_id: bytes) -> str:
    return _encode(raw_id).rstrip("=")


def begin_registration(db: Session, user: User) -> dict:
    exclude = [
        PublicKeyCredentialDescriptor(id=cred.credential_id) for cred in (user.credentials or [])
    ]
    options = generate_registration_options(
        rp_id=settings.auth_rp_id,
        rp_name=RP_NAME,
        user_id=user.id.encode("utf-8"),
        user_name=user.email or user.id,
        user_display_name=user.display_name or user.email or "Athlete",
        timeout=60000,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        exclude_credentials=exclude,
    )
    _persist_challenge(db, options.challenge, purpose="register", user=user)
    return json.loads(options_to_json(options))


def finish_registration(
    db: Session,
    payload: dict,
    current_user: User | None = None,
    encryption_service: EncryptionService | None = None,
) -> tuple[User, str]:
    encryption_service = encryption_service or EncryptionService()
    field_map = {"rawId": "raw_id", "clientExtensionResults": "client_extension_results"}
    response_map = {
        "attestationObject": "attestation_object",
        "clientDataJSON": "client_data_json",
        "authenticatorData": "authenticator_data",
        "signature": "signature",
        "userHandle": "user_handle",
        "publicKey": "public_key",
        "publicKeyAlgorithm": "public_key_algorithm",
    }
    decode_fields = {"raw_id", "attestation_object", "client_data_json", "authenticator_data", "signature", "user_handle", "public_key"}

    normalized = _normalize_keys({k: v for k, v in payload.items() if k != "response"}, field_map, decode_fields)
    response_payload = _normalize_keys(payload.get("response", {}) or {}, response_map, decode_fields)
    user_handle = response_payload.get("user_handle")
    response_obj = AuthenticatorAttestationResponse(**response_payload)
    credential = RegistrationCredential(response=response_obj, **normalized)
    client_challenge = _extract_client_challenge(credential.response.client_data_json)
    challenge_bytes, challenge_user = _pull_challenge(
        db, client_challenge, purpose="register", user=current_user
    )
    target_user = current_user or challenge_user
    if not target_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration context missing user")

    last_error: InvalidRegistrationResponse | None = None
    for origin in _allowed_origins():
        try:
            verification = verify_registration_response(
                credential=credential,
                expected_challenge=challenge_bytes,
                expected_rp_id=settings.auth_rp_id,
                expected_origin=origin,
                require_user_verification=True,
            )
            break
        except InvalidRegistrationResponse as exc:
            last_error = exc
    else:
        raise last_error or HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration failed")
    record = PasskeyCredential(
        user=target_user,
        credential_id=verification.credential_id,
        public_key=verification.credential_public_key,
        sign_count=verification.sign_count,
        transports=",".join(payload.get("transports", []) or []),
    )
    if user_handle:
        target_user.passkey_user_handle = user_handle
    encryption_token = _derive_encryption_token(credential.raw_id)
    salt, envelope = encryption_service.create_user_envelope(encryption_token)
    target_user.encryption_salt = salt
    target_user.encrypted_data_key = envelope
    db.add(record)
    return target_user, encryption_token


def begin_authentication(db: Session, user: User | None = None) -> dict:
    allow_credentials = []
    if user:
        allow_credentials = [
            PublicKeyCredentialDescriptor(id=cred.credential_id) for cred in (user.credentials or [])
        ]
    options = generate_authentication_options(
        rp_id=settings.auth_rp_id,
        timeout=60000,
        user_verification=UserVerificationRequirement.REQUIRED,
        allow_credentials=allow_credentials,
    )
    _persist_challenge(db, options.challenge, purpose="authenticate", user=user)
    return json.loads(options_to_json(options))


def finish_authentication(db: Session, payload: dict) -> tuple[User, str]:
    field_map = {"rawId": "raw_id", "clientExtensionResults": "client_extension_results"}
    response_map = {
        "authenticatorData": "authenticator_data",
        "clientDataJSON": "client_data_json",
        "signature": "signature",
        "userHandle": "user_handle",
    }
    decode_fields = {"raw_id", "authenticator_data", "client_data_json", "signature", "user_handle"}

    normalized = _normalize_keys({k: v for k, v in payload.items() if k != "response"}, field_map, decode_fields)
    response_payload = _normalize_keys(payload.get("response", {}) or {}, response_map, decode_fields)
    response_obj = AuthenticatorAssertionResponse(**response_payload)
    credential = AuthenticationCredential(response=response_obj, **normalized)
    client_challenge = _extract_client_challenge(credential.response.client_data_json)
    challenge, _ = _pull_challenge(db, client_challenge, purpose="authenticate")
    user = db.scalar(
        select(User).join(PasskeyCredential).where(PasskeyCredential.credential_id == credential.raw_id)
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not registered")

    stored_cred = next((c for c in user.credentials if c.credential_id == credential.raw_id), None)
    if not stored_cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential mismatch")

    last_error: InvalidAuthenticationResponse | None = None
    verification = None
    for origin in _allowed_origins():
        try:
            verification = verify_authentication_response(
                credential=credential,
                expected_challenge=challenge,
                expected_rp_id=settings.auth_rp_id,
                expected_origin=origin,
                credential_public_key=stored_cred.public_key,
                credential_current_sign_count=stored_cred.sign_count,
                require_user_verification=True,
            )
            break
        except InvalidAuthenticationResponse as exc:
            last_error = exc
    if not verification:
        raise last_error or HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Authentication failed")
    stored_cred.sign_count = verification.new_sign_count
    stored_cred.last_used_at = datetime.now(timezone.utc)
    encryption_token = _derive_encryption_token(credential.raw_id)
    return user, encryption_token
