from fastapi.testclient import TestClient


def test_passkey_register_begin_returns_token(client: TestClient):
    resp = client.post("/auth/passkey/register/begin")
    assert resp.status_code == 200
    data = resp.json()
    assert "options" in data
    assert isinstance(data.get("encryption_token"), str)
