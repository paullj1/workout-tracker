from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import AuthChallenge, User


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc)


def _as_naive(ts: datetime) -> datetime:
    return ts.replace(tzinfo=None) if ts.tzinfo else ts


def purge_expired_challenges(db: Session) -> int:
    cutoff = _now() - timedelta(seconds=settings.challenge_ttl_seconds)
    stmt = delete(AuthChallenge).where(AuthChallenge.created_at < cutoff)
    result = db.execute(stmt.execution_options(synchronize_session=False))
    db.flush()
    return result.rowcount or 0


def persist_challenge(db: Session, encoded: str, purpose: str, user: User | None = None) -> AuthChallenge:
    purge_expired_challenges(db)
    record = AuthChallenge(user=user, challenge=encoded, purpose=purpose)
    db.add(record)
    db.flush()
    return record


def consume_challenge(db: Session, encoded: str, purpose: str, user: User | None = None) -> AuthChallenge:
    stmt = select(AuthChallenge).where(AuthChallenge.challenge == encoded, AuthChallenge.purpose == purpose)
    if user:
        stmt = stmt.where(AuthChallenge.user_id == user.id)
    record = db.scalar(stmt)
    if not record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge not found or expired")
    age = _now() - _normalize(record.created_at)
    if age.total_seconds() > settings.challenge_ttl_seconds:
        db.delete(record)
        db.flush()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge expired")
    db.delete(record)
    db.flush()
    return record
