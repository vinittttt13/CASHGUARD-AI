"""Application rate limiter (slowapi).

Uses Redis as the shared backing store so limits hold across multiple
Kubernetes pods. If Redis cannot be reached at startup we fall back to an
in-process memory store so a single instance (and the test suite, which has no
Redis) still works — just without cross-pod coordination.
"""

import logging
import socket
from urllib.parse import urlparse

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _redis_reachable(url: str, timeout: float = 1.5) -> bool:
    try:
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError as exc:  # DNS failure, connection refused, timeout, ...
        logger.warning(
            "Rate limiter: Redis at %s unreachable (%s); using in-memory store.",
            url,
            exc,
        )
        return False


_storage_uri = settings.redis_url if _redis_reachable(settings.redis_url) else "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
    storage_uri=_storage_uri,
    strategy="fixed-window",
    # If the storage backend (Redis) errors at request time, log and allow the
    # request through rather than 500-ing the whole API on a Redis blip.
    swallow_errors=True,
)


def reset_limiter_storage() -> None:
    """Clear all recorded hits — used by the test suite between tests."""
    try:
        limiter._storage.reset()  # type: ignore[attr-defined]
    except Exception:  # pragma: no cover - best effort
        pass
