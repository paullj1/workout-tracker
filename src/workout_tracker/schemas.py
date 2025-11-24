from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class WorkoutSet(BaseModel):
    exercise: str
    reps: int = Field(ge=0)
    weight: float | None = Field(default=None, ge=0)
    unit: Literal["kg", "lb"] = "kg"
    rpe: float | None = Field(default=None, ge=0, le=10)


class WorkoutPayload(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime | None = None
    body_weight: float | None = Field(default=None, ge=0)
    body_weight_timing: Literal["before", "after"] | None = None
    notes: str | None = None
    sets: list[WorkoutSet] = Field(default_factory=list)


class WorkoutCreate(WorkoutPayload):
    pass


class WorkoutRead(WorkoutPayload):
    id: str
    created_at: datetime
    updated_at: datetime


class WorkoutUpdate(BaseModel):
    payload: WorkoutPayload


class UserCreate(BaseModel):
    display_name: str
    email: EmailStr | None = None
    encryption_token: str


class UserRead(BaseModel):
    id: str
    display_name: str | None = None
    email: str | None = None
    created_at: datetime
    updated_at: datetime


class TrendPoint(BaseModel):
    date: datetime
    total_sets: int
    total_reps: int
    tonnage: float
    average_body_weight: float | None = None
