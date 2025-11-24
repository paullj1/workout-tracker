import json
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from workout_tracker.database import adapter
from workout_tracker.models import Workout


def _headers(token: str) -> dict[str, str]:
    return {"X-Encryption-Token": token}


def test_workout_crud_and_trends(client: TestClient):
    encryption_token = "sync-secret"
    user_payload = {
        "display_name": "Test Runner",
        "email": "runner@example.com",
        "encryption_token": encryption_token,
    }
    resp = client.post("/users", json=user_payload)
    assert resp.status_code == 201, resp.text

    base_time = datetime(2024, 1, 1, 8, 0, 0)
    workout_one = {
        "title": "Push",
        "start_time": base_time.isoformat(),
        "end_time": (base_time + timedelta(hours=1)).isoformat(),
        "body_weight": 81.0,
        "body_weight_timing": "before",
        "notes": "Bench focus",
        "sets": [
            {"exercise": "Bench", "reps": 5, "weight": 80, "unit": "kg"},
            {"exercise": "Row", "reps": 8, "weight": 60, "unit": "kg"},
        ],
    }
    workout_two = {
        "title": "Lower",
        "start_time": (base_time + timedelta(days=1)).isoformat(),
        "end_time": (base_time + timedelta(days=1, hours=1)).isoformat(),
        "body_weight": 82.0,
        "body_weight_timing": "after",
        "notes": "Squats",
        "sets": [
            {"exercise": "Squat", "reps": 3, "weight": 120, "unit": "kg"},
            {"exercise": "Lunge", "reps": 10, "weight": 40, "unit": "kg"},
        ],
    }

    create_one = client.post("/workouts", json=workout_one, headers=_headers(encryption_token))
    assert create_one.status_code == 201, create_one.text
    workout_one_id = create_one.json()["id"]

    create_two = client.post("/workouts", json=workout_two, headers=_headers(encryption_token))
    assert create_two.status_code == 201, create_two.text
    workout_two_id = create_two.json()["id"]

    updated = {**workout_one, "notes": "Bench PR"}
    update_resp = client.put(f"/workouts/{workout_one_id}", json=updated, headers=_headers(encryption_token))
    assert update_resp.status_code == 200, update_resp.text
    assert update_resp.json()["notes"] == "Bench PR"

    detail = client.get(f"/workouts/{workout_one_id}", headers=_headers(encryption_token))
    assert detail.status_code == 200
    assert detail.json()["title"] == "Push"

    listing = client.get("/workouts", headers=_headers(encryption_token))
    assert listing.status_code == 200
    workouts = listing.json()
    assert len(workouts) == 2

    with adapter.session() as db:
        stored = db.get(Workout, workout_one_id)
        assert stored is not None
        assert stored.encrypted_payload != json.dumps(updated).encode("utf-8")

    trends = client.get("/workouts/trends", headers=_headers(encryption_token))
    assert trends.status_code == 200
    points = trends.json()
    assert points == {
        "overview": [
            {
                "date": "2024-01-01T00:00:00",
                "total_sets": 2,
                "total_reps": 13,
                "tonnage_kg": 880.0,
                "average_body_weight_kg": 81.0,
                "duration_minutes": 60.0,
            },
            {
                "date": "2024-01-02T00:00:00",
                "total_sets": 2,
                "total_reps": 13,
                "tonnage_kg": 760.0,
                "average_body_weight_kg": 82.0,
                "duration_minutes": 60.0,
            },
        ],
        "body_weight": [
            {"date": "2024-01-01T00:00:00", "average_body_weight_kg": 81.0},
            {"date": "2024-01-02T00:00:00", "average_body_weight_kg": 82.0},
        ],
        "durations": [
            {"date": "2024-01-01T00:00:00", "duration_minutes": 60.0},
            {"date": "2024-01-02T00:00:00", "duration_minutes": 60.0},
        ],
        "exercise_volume": [
            {"date": "2024-01-01T00:00:00", "exercise": "Bench", "tonnage_kg": 400.0, "total_sets": 1, "total_reps": 5},
            {"date": "2024-01-01T00:00:00", "exercise": "Row", "tonnage_kg": 480.0, "total_sets": 1, "total_reps": 8},
            {"date": "2024-01-02T00:00:00", "exercise": "Lunge", "tonnage_kg": 400.0, "total_sets": 1, "total_reps": 10},
            {"date": "2024-01-02T00:00:00", "exercise": "Squat", "tonnage_kg": 360.0, "total_sets": 1, "total_reps": 3},
        ],
    }

    delete_resp = client.delete(f"/workouts/{workout_one_id}")
    assert delete_resp.status_code == 204
    post_delete = client.get("/workouts", headers=_headers(encryption_token)).json()
    assert [workout_two_id] == [item["id"] for item in post_delete]
