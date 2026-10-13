"""Liveness endpoint for local health checks and platform probes."""

from __future__ import annotations

import time

from fastapi import APIRouter

router = APIRouter()

_STARTED_AT = time.monotonic()
_VERSION = "0.1.0"


@router.get("/health")
def health() -> dict[str, object]:
    """Return service identity, version, and process uptime in seconds."""
    return {
        "status": "ok",
        "service": "ml-service",
        "version": _VERSION,
        "uptimeSeconds": round(time.monotonic() - _STARTED_AT, 3),
    }
