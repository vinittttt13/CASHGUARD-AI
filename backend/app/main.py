from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from contextlib import asynccontextmanager
from datetime import datetime

from app.core.config import get_settings
from app.core.database import init_db
from app.utils.logging_config import get_logger
from app.utils.rate_limiter import limiter

logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up application...")
    await init_db()
    logger.info("Database tables created successfully.")

    # Apply Alembic index/constraints (post-create_all) so dev path matches prod
    try:
        from pathlib import Path
        from alembic.config import Config
        from alembic import command
        backend_dir = Path(__file__).resolve().parent.parent
        ini_path = backend_dir / "alembic.ini"
        if ini_path.exists():
            alembic_cfg = Config(str(ini_path))
            alembic_cfg.set_main_option("script_location", str(backend_dir / "alembic"))
            alembic_cfg.set_main_option("sqlalchemy.url", get_settings().database_url)
            command.upgrade(alembic_cfg, "head")
            logger.info("Alembic upgrade (indexes/constraints) applied.")
        else:
            logger.warning("alembic.ini not found at %s", ini_path)
    except Exception as exc:
        logger.warning("Alembic upgrade skipped (expected in some envs): %s", exc)

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
# Enforce the configured limits (global default + per-route @limiter.limit).
app.add_middleware(SlowAPIMiddleware)

# CORS — never use ["*"] with allow_credentials=True (browser blocks)
_app_cors_origins = settings.cors_origins if settings.cors_origins != ["*"] else ["http://localhost:3000", "http://localhost:8000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_app_cors_origins,
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
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
):
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
    return {
        "status": "healthy",
        "version": settings.model_version,
        "timestamp": datetime.utcnow().isoformat(),
    }


# Include API v1 routers
from app.api.v1.auth import router as auth_router
from app.api.v1.complaints import router as complaints_router
from app.api.v1.predict import router as predict_router
from app.api.v1.intelligence import router as intelligence_router
from app.api.v1.locations import router as locations_router
from app.api.v1.websocket import router as websocket_router

app.include_router(auth_router, prefix="/api/v1")
app.include_router(complaints_router, prefix="/api/v1")
app.include_router(predict_router, prefix="/api/v1")
app.include_router(intelligence_router, prefix="/api/v1")
app.include_router(locations_router, prefix="/api/v1")
app.include_router(websocket_router, prefix="/api/v1")
