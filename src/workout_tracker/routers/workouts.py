from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_data_key, get_db, get_encryption_service
from ..encryption import EncryptionService
from ..models import User, Workout
from ..schemas import TrendPoint, WorkoutCreate, WorkoutPayload, WorkoutRead

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


@router.get("/trends/body", response_model=list[TrendPoint])
def workout_trends(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    data_key: bytes = Depends(get_data_key),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> list[TrendPoint]:
    stmt = select(Workout).where(Workout.user_id == user.id)
    workouts = db.scalars(stmt).all()
    bucket: dict[str, dict[str, float | int | None]] = defaultdict(lambda: {
        "total_sets": 0,
        "total_reps": 0,
        "tonnage": 0.0,
        "body_weights": [],
    })
    for record in workouts:
        payload = _deserialize(record, data_key, encryption_service)
        date_key = payload.start_time.date().isoformat()
        entry = bucket[date_key]
        entry["total_sets"] += len(payload.sets)
        reps = sum(set_.reps for set_ in payload.sets)
        entry["total_reps"] += reps
        entry["tonnage"] += sum((set_.weight or 0) * set_.reps for set_ in payload.sets)
        if payload.body_weight:
            entry["body_weights"].append(payload.body_weight)
    trend = []
    for date_str, entry in sorted(bucket.items()):
        avg_bw = None
        weights = entry["body_weights"]
        if weights:
            avg_bw = sum(weights) / len(weights)
        trend.append(
            TrendPoint(
                date=datetime.fromisoformat(date_str),
                total_sets=entry["total_sets"],
                total_reps=entry["total_reps"],
                tonnage=entry["tonnage"],
                average_body_weight=avg_bw,
            )
        )
    return trend
