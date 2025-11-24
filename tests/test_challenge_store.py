from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException, status

from workout_tracker.auth.challenge_store import consume_challenge, persist_challenge, purge_expired_challenges
from workout_tracker.config import settings
from workout_tracker.models import AuthChallenge, User


def _seed_user(db_session):
    user = User(
        display_name="Tester",
        email="tester@example.com",
        encryption_salt=b"salt",
        encrypted_data_key=b"key",
    )
    db_session.add(user)
    db_session.flush()
    return user


def test_persist_and_consume_challenge(db_session):
    user = _seed_user(db_session)
    persist_challenge(db_session, "abc", "register", user)
    record = consume_challenge(db_session, "abc", "register", user)
    assert record.purpose == "register"
    with pytest.raises(HTTPException) as exc:
        consume_challenge(db_session, "abc", "register", user)
    assert exc.value.status_code == status.HTTP_400_BAD_REQUEST


def test_expired_challenge_rejected(db_session):
    user = _seed_user(db_session)
    old_created = datetime.utcnow() - timedelta(seconds=settings.challenge_ttl_seconds + 10)
    challenge = AuthChallenge(
        user=user,
        challenge="stale",
        purpose="authenticate",
        created_at=old_created,
    )
    db_session.add(challenge)
    db_session.flush()

    with pytest.raises(HTTPException) as excinfo:
        consume_challenge(db_session, "stale", "authenticate", user)
    assert excinfo.value.detail == "Challenge expired"


def test_purge_expired_challenges(db_session):
    user = _seed_user(db_session)
    fresh = AuthChallenge(user=user, challenge="fresh", purpose="register")
    stale = AuthChallenge(
        user=user,
        challenge="stale",
        purpose="register",
        created_at=datetime.utcnow() - timedelta(seconds=settings.challenge_ttl_seconds + 5),
    )
    db_session.add_all([fresh, stale])
    db_session.flush()

    removed = purge_expired_challenges(db_session)
    assert removed == 1
    remaining = db_session.query(AuthChallenge).all()
    assert len(remaining) == 1
    assert remaining[0].challenge == "fresh"
