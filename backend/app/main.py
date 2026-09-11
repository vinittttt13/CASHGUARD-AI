from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from limits import parse as parse_rate_limit
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import get_settings
from app.core.database import get_db, init_db
from app.utils.logging_config import get_logger
from app.utils.rate_limiter import limiter

logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up application...")
    # Schema is owned by Alembic (the `migrate` service / k8s Job runs
    # `alembic upgrade head`). init_db() only does anything when TESTING=1.
    await init_db()

    # Start WebSocket PubSub for cross-pod broadcast
    from app.api.v1.websocket import manager as ws_manager

    await ws_manager.start_pubsub()
    logger.info("WebSocket PubSub relay started.")

    yield

    # Shutdown
    await ws_manager.stop_pubsub()
    logger.info("Shutting down application...")


app = FastAPI(
    title="Cybercrime Predictive Analytics Framework",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Rate limiting is enforced entirely in the middleware below (not via slowapi's
# route decorators, whose swallow_errors path is broken in 0.1.9). Every request
# gets the global default; a few sensitive routes get a tighter per-IP budget.
_GLOBAL_LIMIT = parse_rate_limit("60/minute")
_ROUTE_LIMITS = {
    ("POST", "/api/v1/auth/login"): parse_rate_limit("5/minute"),
    ("POST", "/api/v1/predict"): parse_rate_limit("10/minute"),
}
_RATE_LIMIT_EXEMPT_PREFIXES = ("/health", "/docs", "/redoc", "/openapi.json")


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Per-IP fixed-window rate limiting.

    A storage-backend failure (e.g. Redis down) is logged and the request is
    allowed through rather than turned into a 500 — the readiness probe already
    reports 503 in that case so Kubernetes drains the pod.
    """
    path = request.url.path
    if not any(path.startswith(p) for p in _RATE_LIMIT_EXEMPT_PREFIXES):
        client_ip = get_remote_address(request)
        rules = [(_GLOBAL_LIMIT, "global")]
        route_limit = _ROUTE_LIMITS.get((request.method, path))
        if route_limit is not None:
            rules.append((route_limit, f"{request.method}:{path}"))

        for item, scope in rules:
            try:
                allowed = limiter.limiter.hit(item, client_ip, scope)
            except Exception as exc:  # noqa: BLE001 — storage backend hiccup
                logger.warning("Rate limiter storage error; allowing request: %s", exc)
                break
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Rate limit exceeded: {item}"},
                )

    return await call_next(request)


# CORS — explicit origins only. No wildcard (incompatible with
# allow_credentials=True anyway). A non-development environment MUST set
# CORS_ORIGINS or the app refuses to start.
_cors_origins = [o for o in settings.cors_origins if o and o != "*"]
if not _cors_origins:
    if settings.environment.lower() != "development":
        raise RuntimeError(
            "CORS_ORIGINS must be set to an explicit list of allowed origins "
            f"when ENVIRONMENT={settings.environment!r}. Refusing to start."
        )
    _cors_origins = ["http://localhost:3000"]
    logger.warning(
        "CORS_ORIGINS not set — defaulting to %s (development only).",
        _cors_origins,
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.ngrok-free\.app|http://localhost:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


from fastapi.encoders import jsonable_encoder


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(exc.errors())},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/health")
async def health_check():
    """Liveness — process is up. Never touches dependencies."""
    return {
        "status": "healthy",
        "version": settings.model_version,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/health/ready")
async def readiness_check(db=Depends(get_db)):
    """Readiness — can this pod actually serve traffic?

    Checks the database (`SELECT 1`) and Redis (`PING`) with a short timeout.
    Returns 503 if either dependency is unreachable so Kubernetes takes the
    pod out of the Service until it recovers.
    """
    import asyncio

    from sqlalchemy import text

    from app.core.redis_client import _redis_available, redis_client

    checks: dict[str, str] = {}
    healthy = True

    async def _probe(coro):
        # A health probe must never raise — catch BaseException too, since a
        # cancelled/timed-out driver call can surface as CancelledError.
        try:
            await asyncio.wait_for(coro, timeout=2)
            return "ok"
        except BaseException as exc:  # noqa: BLE001
            return f"error: {type(exc).__name__}"

    # Database
    checks["database"] = await _probe(db.execute(text("SELECT 1")))
    if checks["database"] != "ok":
        healthy = False

    # Redis
    if _redis_available and redis_client is not None:
        checks["redis"] = await _probe(redis_client.ping())
        if checks["redis"] != "ok":
            healthy = False
    else:
        checks["redis"] = "unavailable"
        healthy = False

    body = {"status": "ready" if healthy else "not ready", "checks": checks}
    if not healthy:
        return JSONResponse(status_code=503, content=body)
    return body


# Include API v1 routers
from app.api.v1.auth import router as auth_router
from app.api.v1.complaints import router as complaints_router
from app.api.v1.intelligence import router as intelligence_router
from app.api.v1.locations import router as locations_router
from app.api.v1.predict import router as predict_router
from app.api.v1.websocket import router as websocket_router

app.include_router(auth_router, prefix="/api/v1")
app.include_router(complaints_router, prefix="/api/v1")
app.include_router(predict_router, prefix="/api/v1")
app.include_router(intelligence_router, prefix="/api/v1")
app.include_router(locations_router, prefix="/api/v1")
app.include_router(websocket_router, prefix="/api/v1")
