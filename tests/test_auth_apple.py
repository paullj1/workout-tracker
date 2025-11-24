from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from workout_tracker.config import settings


@pytest.fixture
def apple_settings(monkeypatch):
    monkeypatch.setattr(settings, "apple_client_id", "com.example.app")
    monkeypatch.setattr(settings, "apple_team_id", "TEAM123")
    monkeypatch.setattr(settings, "apple_key_id", "ABC123")
    monkeypatch.setattr(settings, "apple_private_key", "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----")
    yield


@pytest.fixture(autouse=True)
def fake_apple(monkeypatch):
    async def fake_exchange(code: str):
        return {"id_token": "token", "access_token": "access"}

    async def fake_verify(token: str, audience: str):
        return {"email": "appleuser@example.com"}

    monkeypatch.setattr("workout_tracker.auth.router.exchange_authorization_code", fake_exchange)
    monkeypatch.setattr("workout_tracker.auth.router.verify_identity_token", fake_verify)


def test_apple_login_requires_configuration(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "apple_client_id", None)
    resp = client.post("/auth/apple/complete", json={"authorization_code": "code"})
    assert resp.status_code == 503


def test_new_apple_user_requires_encryption_token(client: TestClient, apple_settings):
    resp = client.post("/auth/apple/complete", json={"authorization_code": "code"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "encryption_token required when provisioning with Apple"


def test_apple_login_creates_user(client: TestClient, apple_settings):
    payload = {"authorization_code": "code", "encryption_token": "sync-token", "display_name": "Apple User"}
    resp = client.post("/auth/apple/complete", json=payload)
    assert resp.status_code == 200
    assert resp.json()["email"] == "appleuser@example.com"


def test_existing_user_can_login_without_encryption(client: TestClient, apple_settings):
    create = client.post(
        "/users",
        json={
            "display_name": "Existing",
            "email": "appleuser@example.com",
            "encryption_token": "token123",
        },
    )
    assert create.status_code == 201
    resp = client.post("/auth/apple/complete", json={"authorization_code": "code"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "appleuser@example.com"
