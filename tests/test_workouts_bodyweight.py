from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def _headers(token: str) -> dict[str, str]:
    return {"X-Encryption-Token": token}


def _create_user(client: TestClient, token: str = "bodyweight-token") -> None:
    payload = {
        "display_name": "Bodyweight Tester",
        "email": "bodyweight@example.com",
        "encryption_token": token,
    }
    resp = client.post("/users", json=payload)
    assert resp.status_code == 201, resp.text


def test_trends_include_bodyweight_modifiers(client: TestClient):
    encryption_token = "bodyweight-token"
    _create_user(client, encryption_token)
    start_time = datetime(2024, 2, 1, 7, 0, 0, tzinfo=timezone.utc)
    workout = {
        "title": "Mixed Session",
        "start_time": start_time.isoformat(),
        "end_time": (start_time + timedelta(minutes=30)).isoformat(),
        "body_weight": None,
        "body_weight_timing": "before",
        "notes": None,
        "sets": [
            {
                "exercise": "Pushup",
                "exercise_type": "bodyweight",
                "reps": 10,
                "weight": 2,
                "unit": "kg",
            },
            {
                "exercise": "Bench",
                "exercise_type": "weighted",
                "reps": 5,
                "weight": 80,
                "unit": "kg",
            },
        ],
    }
    create_resp = client.post("/workouts", json=workout, headers=_headers(encryption_token))
    assert create_resp.status_code == 201, create_resp.text

    trends = client.get("/workouts/trends", headers=_headers(encryption_token))
    assert trends.status_code == 200
    payload = trends.json()
    overview = payload["overview"][0]
    assert overview["total_sets"] == 2
    assert overview["total_reps"] == 17  # 10 + 2 modifier + 5
    assert overview["tonnage_kg"] == 400.0

    exercise_volume = {entry["exercise"]: entry for entry in payload["exercise_volume"]}
    assert exercise_volume["Pushup"]["tonnage_kg"] == 0.0
    assert exercise_volume["Pushup"]["total_reps"] == 12
    assert exercise_volume["Bench"]["tonnage_kg"] == 400.0
    assert exercise_volume["Bench"]["total_reps"] == 5
