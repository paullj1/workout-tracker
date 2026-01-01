from fastapi.testclient import TestClient


def _create_user(client: TestClient, token: str = "template-token") -> None:
    payload = {
        "display_name": "Template Tester",
        "email": "templates@example.com",
        "encryption_token": token,
    }
    resp = client.post("/users", json=payload)
    assert resp.status_code == 201, resp.text


def test_template_update_persists_exercise_type(client: TestClient):
    _create_user(client)
    create_payload = {
        "name": "Bodyweight Plan",
        "notes": "Intro",
        "exercises": [
            {"name": "Pushup", "exercise_type": "weighted", "target_sets": 3, "target_reps": 10, "rest_seconds": 60}
        ],
    }
    create_resp = client.post("/templates", json=create_payload)
    assert create_resp.status_code == 201, create_resp.text
    template = create_resp.json()
    template_id = template["id"]
    assert template["exercises"][0]["exercise_type"] == "weighted"

    update_payload = {
        "name": "Bodyweight Plan",
        "notes": "Updated",
        "exercises": [
            {"name": "Pushup", "exercise_type": "bodyweight", "target_sets": 4, "target_reps": 12, "rest_seconds": 45}
        ],
    }
    update_resp = client.put(f"/templates/{template_id}", json=update_payload)
    assert update_resp.status_code == 200, update_resp.text
    updated = update_resp.json()
    assert updated["exercises"][0]["exercise_type"] == "bodyweight"

    listing = client.get("/templates")
    assert listing.status_code == 200
    listed = listing.json()
    assert listed[0]["exercises"][0]["exercise_type"] == "bodyweight"
