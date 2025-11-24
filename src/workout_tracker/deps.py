from __future__ import annotations

from typing import Generator

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .auth.sessions import resolve_session
from .database import adapter
from .encryption import EncryptionContext, EncryptionService
from .models import User


def get_db() -> Generator[Session, None, None]:
    with adapter.session() as db:
        yield db


def get_encryption_service() -> EncryptionService:
    return EncryptionService()


def maybe_current_user(
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias="session"),
) -> User | None:
    session = resolve_session(session_token)
    user_id = session.get("user_id") if session else None
    return db.get(User, user_id) if user_id else None


def get_current_user(user: User | None = Depends(maybe_current_user)) -> User:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user


def get_encryption_context(
    token: str | None = Header(default=None, alias="X-Encryption-Token"),
    session_token: str | None = Cookie(default=None, alias="session"),
    user: User = Depends(get_current_user),
) -> EncryptionContext:
    session = resolve_session(session_token)
    derived = session.get("encryption_token") if session else None
    candidate = token or derived
    if not candidate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing encryption token")
    return EncryptionContext(token=candidate, salt=user.encryption_salt, wrapped_key=user.encrypted_data_key)


def get_data_key(
    encryption_service: EncryptionService = Depends(get_encryption_service),
    ctx: EncryptionContext = Depends(get_encryption_context),
) -> bytes:
    return encryption_service.unwrap_data_key(ctx)
