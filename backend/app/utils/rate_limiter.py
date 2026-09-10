from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings

settings = get_settings()

# Use Redis as the backing store for distributed rate limiting across
# multiple Kubernetes pods. Falls back to in-memory if Redis is unavailable.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
    storage_uri=settings.redis_url,
    storage_options={"socket_connect_timeout": 5},
    strategy="fixed-window",
)
