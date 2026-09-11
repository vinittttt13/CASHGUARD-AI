"""
Shared pytest fixtures for CASHGUARD-AI backend tests.

Uses SQLite in-memory for test isolation — no external PostgreSQL required.
Redis is mocked to avoid external dependency.
"""

import asyncio
import os
import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# ---------- Override SECRET_KEY BEFORE any app import ----------
# This must happen before get_settings() is first called, so the 32-char
# validation passes. We do NOT override DATABASE_URL here because database.py
# creates the real engine at module level — we use dependency injection instead.
os.environ["SECRET_KEY"] = "test-secret-key-must-be-at-least-32-characters-long!"


# ---------- Database fixtures (SQLite in-memory) ----------

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "slow: heavy tests (real model fits); run in a separate CI leg"
    )


from sqlalchemy.orm import declarative_base

# We create our OWN Base and engine for tests, completely bypassing the
# production engine in app.core.database.
TestBase = None  # Populated after importing the real Base

_test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

_TestSessionLocal = async_sessionmaker(
    bind=_test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def _override_get_db():
    async with _TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def db_session():
    async with _TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test, drop after."""
    # Import all models so Base.metadata knows about them
    import app.models  # noqa: F401
    from app.core.database import Base

    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ---------- Rate limiter isolation ----------


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Clear recorded hits so a 5/min or 10/min limit can't leak across tests."""
    from app.utils.rate_limiter import reset_limiter_storage

    reset_limiter_storage()
    yield
    reset_limiter_storage()


# ---------- Redis mocking ----------


@pytest.fixture(autouse=True)
def mock_redis():
    """Prevent real Redis connections during tests."""
    with (
        patch("app.core.redis_client.redis_client", None),
        patch("app.core.redis_client._redis_available", False),
    ):
        yield


# ---------- App + Client fixtures ----------


@pytest_asyncio.fixture
async def async_client():
    """HTTP test client using the real FastAPI app with test DB overrides."""
    from app.core.database import get_db
    from app.main import app

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


# ---------- Auth helpers ----------


@pytest_asyncio.fixture
async def test_user():
    """Create a test user directly in the DB and return the record."""
    from app.core.security import get_password_hash
    from app.models.user import User, UserRole

    async with _TestSessionLocal() as db:
        user = User(
            id=uuid.uuid4(),
            email="testuser@example.com",
            hashed_password=get_password_hash("testpassword123"),
            full_name="Test User",
            role=UserRole.admin,
            is_active=True,
            is_superuser=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


@pytest_asyncio.fixture
async def auth_headers(async_client: AsyncClient, test_user) -> dict:
    """Login with the test user and return Authorization headers."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@example.com", "password": "testpassword123"},
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def test_complaint():
    """Create a test complaint directly in the DB and return the record."""
    from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus

    async with _TestSessionLocal() as db:
        complaint = Complaint(
            id=uuid.uuid4(),
            complaint_number="CMP-2024-TEST-001",
            complaint_text="Victim received an automated phishing call claiming to be SBI bank and lost funds.",
            complaint_category=ComplaintCategory.phishing,
            amount_defrauded=55000.0,
            state="Maharashtra",
            district="Mumbai",
            latitude=19.0760,
            longitude=72.8777,
            status=ComplaintStatus.pending,
            bank_name="SBI",
        )
        db.add(complaint)
        await db.commit()
        await db.refresh(complaint)
        return complaint


@pytest_asyncio.fixture
async def test_location():
    """Create a test withdrawal location directly in the DB and return the record."""
    from app.models.withdrawal_location import LocationType, WithdrawalLocation

    async with _TestSessionLocal() as db:
        loc = WithdrawalLocation(
            id=uuid.uuid4(),
            name="SBI ATM Bandra West",
            location_type=LocationType.ATM,
            latitude=19.0596,
            longitude=72.8295,
            address="Hill Road, Bandra West",
            city="Mumbai",
            state="Maharashtra",
            bank_name="SBI",
            is_active=True,
            risk_score=0.85,
            incident_count=12,
        )
        db.add(loc)
        await db.commit()
        await db.refresh(loc)
        return loc
