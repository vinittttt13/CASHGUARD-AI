from slowapi import Limiter
from slowapi.util import get_remote_address

# Configure rate limiter using remote address
# Redis backend will be used if configured properly, falling back to memory
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"]
)
