# Deployment Guide

This document outlines how to deploy the Workout Tracker with Postgres and containerized services.

## 1. Application build & packaging

### Local wheel build
- Build frontend bundle: `cd frontend && npm run build`.
- Package a wheel (frontend bundle is included via `tool.hatch.build.force-include`): `uv run hatch build`.
- Install the wheel on the target environment: `uv pip install dist/workout_tracker-*.whl`.
- Run the API: `workout-tracker-api` (via `./scripts/api.sh`).

### Container image
- Use `deploy/docker/Dockerfile` to build a production image.
- `docker build -f deploy/docker/Dockerfile -t workout-tracker .`
- The Dockerfile builds the SPA in a Node stage, packages the Python wheel (which already contains the compiled frontend), and installs the wheel into a slim uv runtime image. No helper scripts are copied—runtime executes `workout-tracker-api`.

## 2. Environment configuration

### Mandatory vars
- `DATABASE_URL`: Postgres connection string.
- `AUTH_RP_ID`, `AUTH_ORIGIN`, `FRONTEND_BASE_URL`: Domain/origin for passkeys + frontend.
- `SESSION_SECRET`: Long random string to sign sessions.

### Optional
- `APPLE_TEAM_ID`, `APPLE_CLIENT_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`: Enables Sign in with Apple.
- `VITE_APPLE_CLIENT_ID`: When running the SPA separately for development.
- `CHALLENGE_TTL_SECONDS`: Passkey challenge validity window.

You can override these at runtime with CLI flags instead of editing environment files. Example:
```
workout-tracker-api \
  --database-url postgresql+psycopg://workout:workout@db:5432/workout \
  --auth-rp-id workout.example.com \
  --auth-origin https://workout.example.com \
  --frontend-base-url https://workout.example.com \
  --host 0.0.0.0 --port 8000
```

For a lightweight deployment that sticks with SQLite, bind-mount a volume and point the URL at the mounted path:
```
docker run --rm \
  -v /host/data/workout:/data \
  -p 8000:8000 workout-tracker:latest \
  workout-tracker-api --database-url sqlite:////data/workout.sqlite3 --host 0.0.0.0
```
The four leading slashes in `sqlite:////data/workout.sqlite3` indicate an absolute path.

## 3. Database (Postgres)

1. Provision Postgres 14+ instance.
2. Create a database, e.g., `workout`.
3. Create a user with privileges (`workout` / `workout`).
4. Set `DATABASE_URL=postgresql+psycopg://workout:workout@db:5432/workout`.
5. On application start, SQLAlchemy `create_all` builds schema automatically.

For production migrations, introduce Alembic (not yet included).

## 4. Docker Compose example

File: `deploy/docker-compose.yml`
- `db` service: Postgres with persistent volume.
- `api` service: Builds API image, waits on Postgres, exposes port 8000.
- Provide environment via `.env` or compose file.
- Run: `docker-compose -f deploy/docker-compose.yml up --build`.

## 5. Reverse proxy

Use nginx/traefik to terminate TLS and proxy requests to `api:8000`.

Example nginx snippet:
```
server {
  listen 443 ssl;
  server_name workout.example.com;

  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

## 6. Operations

- Healthcheck endpoint: `/healthz`.
- Logs: default uvicorn logging to stdout.
- Restart: `docker-compose restart api` or systemd service.
- Database backups: standard Postgres backup procedures.
