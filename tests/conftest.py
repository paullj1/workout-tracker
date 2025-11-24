import importlib
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

DB_PATH = Path("test-workout.sqlite3")

os.environ.setdefault("DATABASE_URL", f"sqlite:///{DB_PATH}")
os.environ.setdefault("AUTH_ORIGIN", "http://testserver")
os.environ.setdefault("FRONTEND_BASE_URL", "http://testserver")

import workout_tracker.config as config  # noqa: E402

importlib.reload(config)

import workout_tracker.database as database  # noqa: E402

importlib.reload(database)

import workout_tracker.app as app_module  # noqa: E402

importlib.reload(app_module)


@pytest.fixture
def client(clean_database):
    app = app_module.create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def clean_database():
    from workout_tracker.database import Base, adapter

    Base.metadata.drop_all(adapter.engine)
    Base.metadata.create_all(adapter.engine)
    yield
    Base.metadata.drop_all(adapter.engine)


@pytest.fixture
def db_session(clean_database):
    from workout_tracker.database import adapter

    with adapter.session() as session:
        yield session
