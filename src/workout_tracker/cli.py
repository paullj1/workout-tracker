from __future__ import annotations

import argparse
import os
from typing import Sequence

import uvicorn


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Workout Tracker API")
    parser.add_argument("--database-url", help="SQLAlchemy connection URL")
    parser.add_argument("--auth-rp-id", help="Passkey relying party id (domain)")
    parser.add_argument("--auth-origin", help="Expected frontend origin for WebAuthn")
    parser.add_argument("--frontend-base-url", help="Public URL used by emails/deep links")
    parser.add_argument("--session-secret", help="Secret used to sign sessions")
    parser.add_argument(
        "--challenge-ttl-seconds",
        type=int,
        help="Passkey challenge validity window (seconds)",
    )
    parser.add_argument("--host", help="Host/IP to bind the server")
    parser.add_argument("--port", type=int, help="Port to bind the server")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)

    env_overrides = {
        "DATABASE_URL": args.database_url,
        "AUTH_RP_ID": args.auth_rp_id,
        "AUTH_ORIGIN": args.auth_origin,
        "FRONTEND_BASE_URL": args.frontend_base_url,
        "SESSION_SECRET": args.session_secret,
        "CHALLENGE_TTL_SECONDS": args.challenge_ttl_seconds,
    }
    for key, value in env_overrides.items():
        if value is not None:
            os.environ[key] = str(value)

    # Import after applying env overrides so pydantic settings pick them up.
    from workout_tracker.config import get_settings

    settings = get_settings()
    reload = settings.environment == "dev"
    uvicorn.run(
        "workout_tracker.app:app",
        host=args.host or DEFAULT_HOST,
        port=args.port or DEFAULT_PORT,
        reload=reload,
    )


__all__ = ["main"]
