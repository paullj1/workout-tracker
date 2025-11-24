from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth.sessions import attach_session_cookie, clear_session_cookie
from ..deps import (
    get_current_user,
    get_data_key,
    get_db,
    get_encryption_service,
)
from ..encryption import EncryptionService
from ..models import User
from ..schemas import UserCreate, UserRead

router = APIRouter(prefix="/users", tags=["users"])


def _serialize(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    response: Response,
    db: Session = Depends(get_db),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> UserRead:
    email = payload.email.lower() if payload.email else None
    if email:
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    salt, envelope = encryption_service.create_user_envelope(payload.encryption_token)
    user = User(
        display_name=payload.display_name,
        email=email,
        encryption_salt=salt,
        encrypted_data_key=envelope,
    )
    db.add(user)
    db.flush()
    attach_session_cookie(response, user.id, encryption_token=payload.encryption_token)
    return _serialize(user)


@router.get("/me", response_model=UserRead)
def read_me(user: User = Depends(get_current_user)) -> UserRead:
    return _serialize(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    db.delete(user)
    clear_session_cookie(response)


class EncryptionRotatePayload(BaseModel):
    encryption_token: str


@router.post("/encryption/rotate", response_model=UserRead)
def rotate_encryption(
    payload: EncryptionRotatePayload,
    user: User = Depends(get_current_user),
    data_key: bytes = Depends(get_data_key),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> UserRead:
    salt, envelope = encryption_service.rotate_envelope(data_key, payload.encryption_token)
    user.encryption_salt = salt
    user.encrypted_data_key = envelope
    user.encryption_version += 1
    return _serialize(user)
