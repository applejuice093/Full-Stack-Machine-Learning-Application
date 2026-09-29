"""File storage for uploaded datasets and trained models.

Locally, files live in the repo (``ml-service/data/datasets`` and ``models/``).
On Vercel the deployment filesystem is read-only, so files go to ``/tmp``.
``/tmp`` is per-instance and temporary, so when ``BLOB_READ_WRITE_TOKEN`` is set
every file is also mirrored to Vercel Blob and pulled back on demand by any
instance that does not have it yet.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

log = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SERVICE_ROOT = Path(__file__).resolve().parents[2]


def _base() -> Path | None:
    configured = os.getenv("ML_STORAGE_DIR")
    if configured:
        return Path(configured)
    if os.getenv("VERCEL"):
        return Path("/tmp/ml-service")
    return None


_base_dir = _base()
DATA_DIR = (_base_dir / "datasets") if _base_dir else _SERVICE_ROOT / "data" / "datasets"
MODELS_DIR = (_base_dir / "models") if _base_dir else _REPO_ROOT / "models"

BLOB_PREFIX = os.getenv("BLOB_PREFIX", "ml-service").strip("/")


def blob_enabled() -> bool:
    return bool(os.getenv("BLOB_READ_WRITE_TOKEN"))


def _blob_key(path: Path) -> str | None:
    for kind, root in (("datasets", DATA_DIR), ("models", MODELS_DIR)):
        try:
            return f"{BLOB_PREFIX}/{kind}/{path.resolve().relative_to(root.resolve()).as_posix()}"
        except ValueError:
            continue
    return None


def persist(path: Path) -> None:
    """Mirror a freshly written local file to Vercel Blob (no-op without a token)."""
    if not blob_enabled():
        return
    key = _blob_key(path)
    if key is None:
        return
    from vercel.blob import BlobClient

    with BlobClient() as client:
        client.put(key, path.read_bytes(), access="private", add_random_suffix=False, overwrite=True)


def fetch(path: Path) -> bool:
    """Make sure ``path`` exists locally, downloading it from Blob if needed."""
    if path.exists():
        return True
    if not blob_enabled():
        return False
    key = _blob_key(path)
    if key is None:
        return False
    from vercel.blob import BlobClient, BlobNotFoundError

    try:
        with BlobClient() as client:
            result = client.get(key, access="private", use_cache=False)
    except BlobNotFoundError:
        return False
    except Exception:  # network or auth problems: behave like a missing file
        log.exception("Could not read %s from Vercel Blob", key)
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(result.content)
    return True
