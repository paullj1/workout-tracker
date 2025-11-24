from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Dict, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_data_key, get_db, get_encryption_service
from ..encryption import EncryptionService
from ..models import User, Workout
from ..schemas import (
    TrendBodyWeightPoint,
    TrendDurationPoint,
    TrendExercisePoint,
    TrendOverviewPoint,
    TrendResponse,
    WorkoutCreate,
    WorkoutPayload,
    WorkoutRead,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])


def _deserialize(record: Workout, data_key: bytes, encryption_service: EncryptionService) -> WorkoutPayload:
    payload = encryption_service.decrypt_payload(data_key, record.encrypted_payload)
    return WorkoutPayload(**payload)


def _serialize(record: Workout, payload: WorkoutPayload) -> WorkoutRead:
    return WorkoutRead(
        id=record.id,
        created_at=record.created_at,
        updated_at=record.updated_at,
        **payload.model_dump(),
    )


def _get_workout_or_404(db: Session, user: User, workout_id: str) -> Workout:
    workout = db.get(Workout, workout_id)
    if not workout or workout.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout not found")
    return workout


def _weight_to_kg(weight: float | None, unit: str) -> float:
    """Normalize incoming weights to kilograms for consistent trend math."""
    if weight is None:
        return 0.0
    if unit == "kg":
        return float(weight)
    if unit == "lb":
        return float(weight) / 2.20462
    return float(weight)


@router.get("", response_model=list[WorkoutRead])
def list_workouts(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    data_key: bytes = Depends(get_data_key),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> list[WorkoutRead]:
    stmt = select(Workout).where(Workout.user_id == user.id).order_by(Workout.created_at.desc())
    workouts = db.scalars(stmt).all()
    return [_serialize(record, _deserialize(record, data_key, encryption_service)) for record in workouts]


@router.post("", response_model=WorkoutRead, status_code=status.HTTP_201_CREATED)
def create_workout(
    payload: WorkoutCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    data_key: bytes = Depends(get_data_key),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> WorkoutRead:
    blob = encryption_service.encrypt_payload(data_key, payload.model_dump())
    record = Workout(user=user, encrypted_payload=blob, notes_search=payload.notes)
    db.add(record)
    db.flush()
    return _serialize(record, payload)


@router.get("/trends", response_model=TrendResponse)
def workout_trends(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    data_key: bytes = Depends(get_data_key),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> TrendResponse:
    stmt = select(Workout).where(Workout.user_id == user.id)
    workouts = db.scalars(stmt).all()
    overview_bucket: dict[str, dict[str, float | int | None]] = defaultdict(
        lambda: {
            "total_sets": 0,
            "total_reps": 0,
            "tonnage_kg": 0.0,
            "body_weights": [],
            "durations": [],
        }
    )
    exercise_bucket: Dict[Tuple[str, str], dict[str, float | int]] = defaultdict(
        lambda: {"tonnage_kg": 0.0, "total_sets": 0, "total_reps": 0}
    )
    for record in workouts:
        payload = _deserialize(record, data_key, encryption_service)
        date_key = payload.start_time.date().isoformat()
        entry = overview_bucket[date_key]
        entry["total_sets"] += len(payload.sets)
        entry["total_reps"] += sum(set_.reps for set_ in payload.sets)
        for set_ in payload.sets:
            tonnage = _weight_to_kg(set_.weight, set_.unit) * set_.reps
            entry["tonnage_kg"] += tonnage
            exercise_entry = exercise_bucket[(set_.exercise, date_key)]
            exercise_entry["tonnage_kg"] += tonnage
            exercise_entry["total_sets"] += 1
            exercise_entry["total_reps"] += set_.reps
        if payload.body_weight is not None:
            entry["body_weights"].append(payload.body_weight)
        if payload.end_time:
            duration_minutes = (payload.end_time - payload.start_time).total_seconds() / 60
            if duration_minutes > 0:
                entry["durations"].append(duration_minutes)

    overview_points = []
    body_weight_points: list[TrendBodyWeightPoint] = []
    duration_points: list[TrendDurationPoint] = []

    for date_str, entry in sorted(overview_bucket.items()):
        date_obj = datetime.fromisoformat(date_str)
        weights = entry["body_weights"]
        avg_bw = sum(weights) / len(weights) if weights else None
        durations = entry["durations"]
        avg_duration = sum(durations) / len(durations) if durations else None
        overview_points.append(
            TrendOverviewPoint(
                date=date_obj,
                total_sets=entry["total_sets"],
                total_reps=entry["total_reps"],
                tonnage_kg=entry["tonnage_kg"],
                average_body_weight_kg=avg_bw,
                duration_minutes=avg_duration,
            )
        )
        if avg_bw is not None:
            body_weight_points.append(TrendBodyWeightPoint(date=date_obj, average_body_weight_kg=avg_bw))
        if avg_duration is not None:
            duration_points.append(TrendDurationPoint(date=date_obj, duration_minutes=avg_duration))

    exercise_points: list[TrendExercisePoint] = []
    for (exercise, date_str), metrics in sorted(exercise_bucket.items(), key=lambda item: (item[0][1], item[0][0])):
        exercise_points.append(
            TrendExercisePoint(
                date=datetime.fromisoformat(date_str),
                exercise=exercise,
                tonnage_kg=metrics["tonnage_kg"],
                total_sets=metrics["total_sets"],
                total_reps=metrics["total_reps"],
            )
        )

    return TrendResponse(
        overview=overview_points,
        body_weight=body_weight_points,
        durations=duration_points,
        exercise_volume=exercise_points,
    )


@router.get("/{workout_id}", response_model=WorkoutRead)
def read_workout(
    workout_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    data_key: bytes = Depends(get_data_key),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> WorkoutRead:
    record = _get_workout_or_404(db, user, workout_id)
    payload = _deserialize(record, data_key, encryption_service)
    return _serialize(record, payload)


@router.put("/{workout_id}", response_model=WorkoutRead)
def update_workout(
    workout_id: str,
    payload: WorkoutCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    data_key: bytes = Depends(get_data_key),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> WorkoutRead:
    record = _get_workout_or_404(db, user, workout_id)
    record.encrypted_payload = encryption_service.encrypt_payload(data_key, payload.model_dump())
    record.notes_search = payload.notes
    return _serialize(record, payload)


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(
    workout_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    record = _get_workout_or_404(db, user, workout_id)
    db.delete(record)
