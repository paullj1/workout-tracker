from __future__ import annotations

import importlib.resources
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import adapter
from .routers import users, workouts
from .auth import router as auth_router


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


def _static_dir() -> Path | None:
    # Prefer the repo-local Vite build during development, otherwise fall back to packaged assets.
    try:
        repo_root = Path(__file__).resolve().parents[2]
        dev_dir = repo_root / "frontend" / "dist"
        if dev_dir.exists():
            return dev_dir
    except IndexError:
        pass

    try:
        return Path(importlib.resources.files("workout_tracker") / "static")
    except FileNotFoundError:
        return None


def create_app() -> FastAPI:
    app = FastAPI(title="Workout Tracker", version=settings.environment)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_base_url, settings.auth_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router.router)
    app.include_router(users.router)
    app.include_router(workouts.router)

    @app.on_event("startup")
    def _startup() -> None:
        adapter.create_schema()

    @app.get("/healthz")
    def healthcheck():
        return {"status": "ok"}

    static_dir = _static_dir()
    if static_dir and static_dir.exists():
        app.mount("/", SPAStaticFiles(directory=static_dir, html=True), name="spa")

    return app


app = create_app()


def run() -> None:
    uvicorn.run("workout_tracker.app:app", reload=settings.environment == "dev")
