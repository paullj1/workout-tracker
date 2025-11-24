from __future__ import annotations

from fastapi import Response
from itsdangerous import BadSignature, URLSafeTimedSerializer

from ..config import settings

SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt="workout-tracker-session")


def create_session_token(user_id: str, encryption_token: str | None = None) -> str:
    payload: dict[str, str] = {"user_id": user_id}
    if encryption_token:
        payload["encryption_token"] = encryption_token
    return _serializer().dumps(payload)


def resolve_session(token: str | None) -> dict[str, str] | None:
    if not token:
        return None
    try:
        payload = _serializer().loads(token, max_age=SESSION_MAX_AGE)
        if not isinstance(payload, dict):
            return None
        if "user_id" not in payload:
            return None
        return payload
    except BadSignature:
        return None


def attach_session_cookie(response: Response, user_id: str, encryption_token: str | None = None) -> None:
    response.set_cookie(
        key="session",
        value=create_session_token(user_id, encryption_token),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=settings.environment == "prod",
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie("session")
