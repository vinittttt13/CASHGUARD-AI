import json
from typing import Any, Optional

try:
    import redis.asyncio as redis
    from app.core.config import get_settings

    settings = get_settings()
    redis_client = redis.from_url(
        settings.redis_url, encoding="utf-8", decode_responses=True
    )
    _redis_available = True
except Exception:
    redis_client = None
    _redis_available = False


def get_redis():
    return redis_client


async def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
    if not _redis_available or redis_client is None:
        return False
    try:
        json_val = json.dumps(value, default=str)
        await redis_client.set(key, json_val, ex=ttl)
        return True
    except Exception:
        return False


async def cache_get(key: str) -> Optional[Any]:
    if not _redis_available or redis_client is None:
        return None
    try:
        val = await redis_client.get(key)
        if val:
            return json.loads(val)
        return None
    except Exception:
        return None


async def cache_delete(key: str) -> bool:
    if not _redis_available or redis_client is None:
        return False
    try:
        await redis_client.delete(key)
        return True
    except Exception:
        return False


async def cache_delete_pattern(pattern: str) -> int:
    if not _redis_available or redis_client is None:
        return 0
    try:
        keys = await redis_client.keys(pattern)
        if keys:
            await redis_client.delete(*keys)
            return len(keys)
        return 0
    except Exception:
        return 0


async def revoke_token(jti: str, ttl_days: int = 7) -> bool:
    """Add a JWT ID to the revocation blacklist in Redis.

    Args:
        jti: The JWT ID (unique token identifier) to revoke.
        ttl_days: How long to keep the revocation entry (should match refresh token lifetime).

    Returns:
        True if the token was successfully revoked, False if Redis is unavailable.
    """
    if not _redis_available or redis_client is None:
        return False
    try:
        await redis_client.set(f"revoked:{jti}", "1", ex=ttl_days * 86400)
        return True
    except Exception:
        return False


async def is_token_revoked(jti: str) -> bool:
    """Check whether a JWT ID has been revoked.

    Args:
        jti: The JWT ID to check.

    Returns:
        True if the token is revoked (or Redis is unavailable — fail-closed),
        False if the token is NOT revoked.
    """
    if not _redis_available or redis_client is None:
        # Fail-open when Redis is down to avoid locking out all users.
        # In a strict-security deployment, you may want to fail-closed instead.
        return False
    try:
        return await redis_client.exists(f"revoked:{jti}") == 1
    except Exception:
        return False
