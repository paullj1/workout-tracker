from __future__ import annotations

from typing import cast
import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..deps import get_current_user, get_db, get_encryption_service, maybe_current_user
from ..encryption import EncryptionService
from ..models import User
from ..schemas import UserRead
from .apple import exchange_authorization_code, verify_identity_token
from .passkeys import (
    begin_authentication,
    begin_registration,
    finish_authentication,
    finish_registration,
)
from .sessions import attach_session_cookie, clear_session_cookie

router = APIRouter(prefix="/auth", tags=["auth"])


def _serialize(user: User | None) -> UserRead | None:
    if not user:
        return None
    return UserRead(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/session", response_model=UserRead | None)
def get_session(user: User | None = Depends(maybe_current_user)) -> UserRead | None:
    return _serialize(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    clear_session_cookie(response)


class PasskeyLoginBegin(BaseModel):
    email: EmailStr | None = None


@router.post("/passkey/login/begin")
def passkey_login_begin(payload: PasskeyLoginBegin, db: Session = Depends(get_db)):
    user = None
    if payload.email:
        user = db.scalar(select(User).where(User.email == payload.email.lower()))
    return begin_authentication(db, user)


@router.post("/passkey/login/complete", response_model=UserRead)
def passkey_login_complete(
    payload: dict,
    response: Response,
    db: Session = Depends(get_db),
) -> UserRead:
    user, encryption_token = finish_authentication(db, payload)
    attach_session_cookie(response, user.id, encryption_token=encryption_token)
    return cast(UserRead, _serialize(user))


class PasskeyRegisterBeginResponse(BaseModel):
    options: dict
    encryption_token: str | None = None


@router.post("/passkey/register/begin", response_model=PasskeyRegisterBeginResponse)
def passkey_register_begin(
    db: Session = Depends(get_db),
    encryption_service: EncryptionService = Depends(get_encryption_service),
    user: User | None = Depends(maybe_current_user),
) -> PasskeyRegisterBeginResponse:
    if user:
        options = begin_registration(db, user)
        return PasskeyRegisterBeginResponse(options=options, encryption_token=None)
    user = User(
        display_name=None,
        email=None,
        encryption_salt=b"",
        encrypted_data_key=b"",
    )
    db.add(user)
    db.flush()
    options = begin_registration(db, user)
    return PasskeyRegisterBeginResponse(options=options, encryption_token=secrets.token_urlsafe(32))


@router.post("/passkey/register/complete", response_model=UserRead)
def passkey_register_complete(
    payload: dict,
    response: Response,
    db: Session = Depends(get_db),
    user: User | None = Depends(maybe_current_user),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> UserRead:
    registered_user, encryption_token = finish_registration(db, payload, user, encryption_service=encryption_service)
    attach_session_cookie(response, registered_user.id, encryption_token=encryption_token)
    return cast(UserRead, _serialize(registered_user))


class AppleAuthPayload(BaseModel):
    authorization_code: str
    display_name: str | None = None
    encryption_token: str | None = None


@router.post("/apple/complete", response_model=UserRead)
async def apple_complete(
    payload: AppleAuthPayload,
    response: Response,
    db: Session = Depends(get_db),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> UserRead:
    if not all([settings.apple_client_id, settings.apple_team_id, settings.apple_key_id, settings.apple_private_key]):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Apple auth not configured")
    token_response = await exchange_authorization_code(payload.authorization_code)
    identity_token = token_response.get("id_token")
    if not identity_token:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Apple token exchange failed")
    claims = await verify_identity_token(identity_token, settings.apple_client_id)
    email_raw = claims.get("email")
    email = email_raw.lower() if isinstance(email_raw, str) else None
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Apple token missing email")
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        if not payload.encryption_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="encryption_token required when provisioning with Apple",
            )
        salt, envelope = encryption_service.create_user_envelope(payload.encryption_token)
        user = User(
            email=email,
            display_name=payload.display_name or claims.get("name"),
            encryption_salt=salt,
            encrypted_data_key=envelope,
        )
        db.add(user)
        db.flush()
    attach_session_cookie(response, user.id, encryption_token=payload.encryption_token)
    return cast(UserRead, _serialize(user))
