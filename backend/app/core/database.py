from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_recycle=settings.db_pool_recycle,
    pool_timeout=settings.db_pool_timeout,
    pool_pre_ping=settings.db_pool_pre_ping,
)


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    """Create tables from SQLAlchemy metadata.

    Schema is owned by Alembic everywhere except the test suite. This is a
    no-op unless ``TESTING`` is set, so a production boot never races schema
    creation across replicas — run ``alembic upgrade head`` (the migrate
    service / Job) instead.
    """
    if not settings.testing:
        return
    import app.models  # noqa: F401  (register models with Base.metadata)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
