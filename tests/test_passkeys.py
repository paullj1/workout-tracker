from __future__ import annotations

import base64
import json
from types import SimpleNamespace

from workout_tracker.auth import passkeys
from workout_tracker.models import PasskeyCredential, User


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def test_finish_registration_normalizes_payload(db_session, monkeypatch):
    user = User(encryption_salt=b"salt", encrypted_data_key=b"key")
    db_session.add(user)
    db_session.flush()

    captured = {}

    def fake_verify_registration_response(**kwargs):
        captured["credential"] = kwargs["credential"]
        return SimpleNamespace(credential_id=b"cred", credential_public_key=b"pk", sign_count=1)

    expected_challenge = b"challenge"

    def fake_pull(db, challenge, purpose, user=None):
        assert challenge == expected_challenge
        return expected_challenge, user or user_obj

    user_obj = user
    monkeypatch.setattr(passkeys, "verify_registration_response", fake_verify_registration_response)
    monkeypatch.setattr(passkeys, "_pull_challenge", fake_pull)

    client_payload = json.dumps({"challenge": _b64(expected_challenge)}).encode()

    payload = {
        "id": "test",
        "rawId": _b64(b"\x01"),
        "type": "public-key",
        "clientExtensionResults": {},
        "response": {
            "attestationObject": _b64(b"att"),
            "clientDataJSON": _b64(client_payload),
            "clientExtensionResults": {},
        },
    }

    result_user, encryption_token = passkeys.finish_registration(db_session, payload, None)
    assert result_user.id == user.id
    assert captured["credential"].raw_id == b"\x01"
    assert encryption_token == _b64(b"\x01")


def test_finish_authentication_normalizes_payload(db_session, monkeypatch):
    user = User(encryption_salt=b"salt", encrypted_data_key=b"key")
    credential = PasskeyCredential(user=user, credential_id=b"\x02", public_key=b"pk", sign_count=0)
    db_session.add_all([user, credential])
    db_session.flush()

    captured = {}

    def fake_verify_authentication_response(**kwargs):
        captured["credential"] = kwargs["credential"]
        return SimpleNamespace(new_sign_count=1)

    expected_challenge = b"auth-challenge"

    def fake_pull(db, challenge, purpose, user=None):
        assert challenge == expected_challenge
        return expected_challenge, None

    monkeypatch.setattr(passkeys, "verify_authentication_response", fake_verify_authentication_response)
    monkeypatch.setattr(passkeys, "_pull_challenge", fake_pull)

    client_payload = json.dumps({"challenge": _b64(expected_challenge)}).encode()

    payload = {
        "id": "test",
        "rawId": _b64(b"\x02"),
        "type": "public-key",
        "clientExtensionResults": {},
        "response": {
            "clientDataJSON": _b64(client_payload),
            "authenticatorData": _b64(b"auth"),
            "signature": _b64(b"sig"),
            "clientExtensionResults": {},
        },
    }

    result_user, encryption_token = passkeys.finish_authentication(db_session, payload)
    assert result_user.id == user.id
    assert captured["credential"].raw_id == b"\x02"
    assert encryption_token == _b64(b"\x02")
