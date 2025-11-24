"""Workout Tracker package."""

from importlib import metadata


def get_version() -> str:
    try:
        return metadata.version("workout-tracker")
    except metadata.PackageNotFoundError:  # pragma: no cover - dev installs
        return "0.0.0"


__all__ = ["get_version"]
