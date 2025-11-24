# Workout Tracker

This repository contains a small, privacy‑focused workout tracker composed of:

- A FastAPI backend that exposes workout, trend, and authentication endpoints.
- A React + Vite frontend that talks to the API and is packaged inside the Python wheel.
- A thin crypto layer that encrypts every workout payload with keys derived from a user‑controlled secret so the raw database is meaningless without a passkey/iCloud credential.

## Features

- Passkey (WebAuthn) first authentication with optional Sign in with Apple fallback.
- Self‑service registration, account deletion, and encryption key rotation.
- Secure storage of workouts (start/end time, body weight, notes, sets) via per‑user envelope encryption.
- Trend visualizations (volume, body weight, workout frequency) rendered client side.
- Adapter friendly database layer that defaults to SQLite but can be pointed at Postgres.

## Repository layout

```
.
├── frontend/               # React + Vite application (built assets copied into the wheel)
├── src/workout_tracker/    # FastAPI service, routers, database, and crypto helpers
├── docs/                   # Deployment and operations guides
├── deploy/                 # Containerization recipes and compose files
├── pyproject.toml          # uv + hatchling project metadata
└── README.md
```

## Tooling

- **uv** handles dependency resolution (`uv pip sync pyproject.toml`) and virtual environments (`uv venv`).
- **hatchling** builds the final wheel with both backend code and compiled frontend assets.
- **Vite** powers the React development server and build pipeline.
- **GitHub Actions** run `uv run --extra dev pytest` for the backend and `npm run typecheck && npm run build` for the frontend on every push/pull request (`.github/workflows/ci.yml`).

## Getting started

1. **Install Python 3.11+** and [uv](https://docs.astral.sh/uv/).
2. **Create a virtual environment**:
   ```bash
   uv venv
   source .venv/bin/activate
   ```
3. **Install backend dependencies**:
   ```bash
   uv pip sync pyproject.toml
   ```
4. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   - Set `VITE_APPLE_CLIENT_ID` in `frontend/.env` if you plan to enable Sign in with Apple (matches your Services ID).
5. **Run the API** (from repo root):
   ```bash
   ./scripts/api.sh
   ```

The helper script installs/builds the React app (if needed) and boots the API on `http://127.0.0.1:8000`, so the SPA and API share a single origin. Set `SKIP_FRONTEND_BUILD=1 ./scripts/api.sh` if you want to skip the build step and use a precompiled bundle.

The FastAPI process automatically serves assets from `frontend/dist` during development and falls back to the packaged `workout_tracker/static` directory when installed from a wheel.

## Building the unified wheel

1. Build the frontend (this populates `frontend/dist`):
   ```bash
   ./scripts/build_frontend.sh
   ```
2. Copy the static bundle into the Python package (handled automatically by Hatch via `tool.hatch.build.force-include`).
3. Build the wheel:
   ```bash
   uv run hatch build
   ```
4. Install the wheel on the target host with `uv pip install dist/workout_tracker-*.whl`.

## Configuration

Environment variables (or `.env`) drive deployment:

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy connection URL | `sqlite:///./var/workout.sqlite3` |
| `AUTH_RP_ID` | Passkey relying party id (domain) | `localhost` |
| `AUTH_ORIGIN` | Expected frontend origin for WebAuthn | `http://localhost:5173` |
| `FRONTEND_BASE_URL` | Public URL used by emails/deep links | `http://localhost:8000` |
| `APPLE_TEAM_ID`, `APPLE_CLIENT_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Required to generate Apple client secrets and verify identity tokens | unset |

The Vite app consumes `VITE_API_URL` (defaults to same origin) when you need to point the SPA at a remote API during development.

### Apple Sign-In

To offer Sign in with Apple you must provide:

- Backend: `APPLE_TEAM_ID`, `APPLE_CLIENT_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (`.p8` contents). The API exchanges authorization codes for tokens and verifies identity claims using these values.
- Frontend: `VITE_APPLE_CLIENT_ID` that matches the Services ID registered with Apple.

Once configured, the login screen renders a "Continue with Apple" button. New users must supply an encryption token (stored client side) so their data remains unreadable without their credentials.

## Database adapters

`workout_tracker.database.DatabaseAdapter` wraps SQLAlchemy session creation and supports:

- SQLite (default) – file path or memory.
- Postgres – specify `postgresql+psycopg://user:pass@host/db`.

Because the ORM layer never relies on SQLite‑specific features, switching databases only requires changing `DATABASE_URL`.

## Security model

- Each user owns a randomly generated 32‑byte data key encrypted (PBKDF2 + Fernet) with a secret derived from their WebAuthn credential. The server never stores the raw key.
- Workout payloads (metadata, notes, reps/sets) are serialized as JSON and encrypted before persistence.
- Without completing a passkey or Apple based login and supplying the derived wrapping secret, decrypted data is inaccessible.

## Next steps

- Plug in a durable passkey challenge store (Redis, DynamoDB) for a multi-process deployment.
- Wire Apple Sign In to real credentials and provide a UI for linking both login methods to a single account.
- Expand the trend API with richer aggregates (PR tracking, bodyweight deltas, etc.).
- Add integration tests that exercise the crypto envelope end-to-end against both SQLite and Postgres.
- See `docs/deployment.md` and `deploy/docker-compose.yml` for containerized/Postgres deployment instructions.
