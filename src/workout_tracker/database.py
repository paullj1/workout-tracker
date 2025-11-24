from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


class DatabaseAdapter:
    def __init__(self, url: str) -> None:
        self.url = url
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        self.engine = create_engine(url, future=True, connect_args=connect_args, pool_pre_ping=True)
        self._session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )

    @contextmanager
    def session(self) -> Generator[Session, None, None]:
        db = self._session_factory()
        try:
            yield db
            db.commit()
        except Exception:  # pragma: no cover - defensive
            db.rollback()
            raise
        finally:
            db.close()

    def create_schema(self) -> None:
        Base.metadata.create_all(self.engine)


adapter = DatabaseAdapter(settings.database_url)
