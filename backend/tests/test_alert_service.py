"""Unit tests for app.services.alert_service.AlertService — previously 0% covered."""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.intelligence_alert import AlertPriority, AlertType, IntelligenceAlert
from app.models.user import User, UserRole
from app.services.alert_service import AlertService


@pytest.fixture
def service():
    return AlertService()


@pytest.mark.asyncio
async def test_evaluate_and_create_alerts_creates_alert_for_critical_high_confidence(
    service, db_session
):
    await service.evaluate_and_create_alerts(
        {"confidence_score": 0.95, "risk_level": "critical"}, db_session
    )

    result = await db_session.execute(select(IntelligenceAlert))
    alerts = result.scalars().all()
    assert len(alerts) == 1
    assert alerts[0].priority == AlertPriority.critical
    assert alerts[0].alert_type == AlertType.hotspot_detected
    assert "95%" in alerts[0].description


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "confidence,risk_level",
    [
        (0.5, "critical"),  # confidence too low
        (0.95, "medium"),  # risk not critical
        (0.8, "critical"),  # boundary: not > 0.8
    ],
)
async def test_evaluate_and_create_alerts_no_alert_below_threshold(
    service, db_session, confidence, risk_level
):
    await service.evaluate_and_create_alerts(
        {"confidence_score": confidence, "risk_level": risk_level}, db_session
    )

    result = await db_session.execute(select(IntelligenceAlert))
    assert result.scalars().all() == []


@pytest.mark.asyncio
async def test_evaluate_and_create_alerts_handles_missing_keys(service, db_session):
    # No confidence_score/risk_level at all — should default safely, not raise.
    await service.evaluate_and_create_alerts({}, db_session)

    result = await db_session.execute(select(IntelligenceAlert))
    assert result.scalars().all() == []


@pytest.mark.asyncio
async def test_get_active_alerts_returns_only_active_newest_first(service, db_session):
    old = IntelligenceAlert(
        id=uuid.uuid4(),
        title="Older",
        alert_type=AlertType.pattern_change,
        priority=AlertPriority.low,
        is_active=True,
        created_at=datetime.utcnow() - timedelta(hours=2),
    )
    newer = IntelligenceAlert(
        id=uuid.uuid4(),
        title="Newer",
        alert_type=AlertType.pattern_change,
        priority=AlertPriority.low,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    inactive = IntelligenceAlert(
        id=uuid.uuid4(),
        title="Inactive",
        alert_type=AlertType.pattern_change,
        priority=AlertPriority.low,
        is_active=False,
    )
    db_session.add_all([old, newer, inactive])
    await db_session.commit()

    active = await service.get_active_alerts(db_session)

    titles = [a.title for a in active]
    assert "Inactive" not in titles
    assert titles.index("Newer") < titles.index("Older")


@pytest.mark.asyncio
async def test_get_active_alerts_respects_limit(service, db_session):
    for i in range(5):
        db_session.add(
            IntelligenceAlert(
                id=uuid.uuid4(),
                title=f"Alert {i}",
                alert_type=AlertType.pattern_change,
                priority=AlertPriority.low,
                is_active=True,
            )
        )
    await db_session.commit()

    result = await service.get_active_alerts(db_session, limit=2)
    assert len(result) == 2


@pytest.mark.asyncio
async def test_acknowledge_alert_sets_flags_and_returns_alert(service, db_session):
    user = User(
        id=uuid.uuid4(),
        email="ack@example.com",
        hashed_password="x",
        role=UserRole.analyst,
        is_active=True,
    )
    alert = IntelligenceAlert(
        id=uuid.uuid4(),
        title="To ack",
        alert_type=AlertType.temporal_spike,
        priority=AlertPriority.high,
        is_active=True,
        is_acknowledged=False,
    )
    db_session.add_all([user, alert])
    await db_session.commit()

    result = await service.acknowledge_alert(alert.id, user.id, db_session)

    assert result is not None
    assert result.is_acknowledged is True
    assert result.acknowledged_by == user.id


@pytest.mark.asyncio
async def test_acknowledge_alert_returns_none_for_unknown_id(service, db_session):
    result = await service.acknowledge_alert(uuid.uuid4(), uuid.uuid4(), db_session)
    assert result is None


@pytest.mark.asyncio
async def test_expire_old_alerts_deactivates_only_stale_active_alerts(
    service, db_session
):
    stale = IntelligenceAlert(
        id=uuid.uuid4(),
        title="Stale",
        alert_type=AlertType.high_risk_location,
        priority=AlertPriority.medium,
        is_active=True,
        created_at=datetime.utcnow() - timedelta(days=2),
    )
    fresh = IntelligenceAlert(
        id=uuid.uuid4(),
        title="Fresh",
        alert_type=AlertType.high_risk_location,
        priority=AlertPriority.medium,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    already_inactive = IntelligenceAlert(
        id=uuid.uuid4(),
        title="AlreadyInactive",
        alert_type=AlertType.high_risk_location,
        priority=AlertPriority.medium,
        is_active=False,
        created_at=datetime.utcnow() - timedelta(days=5),
    )
    db_session.add_all([stale, fresh, already_inactive])
    await db_session.commit()

    await service.expire_old_alerts(db_session)

    await db_session.refresh(stale)
    await db_session.refresh(fresh)
    assert stale.is_active is False
    assert fresh.is_active is True


@pytest.mark.parametrize(
    "priority,expected",
    [
        (AlertPriority.critical, 100),
        (AlertPriority.high, 80),
        (AlertPriority.medium, 50),
        (AlertPriority.low, 20),
    ],
)
def test_priority_score_known_priorities(service, priority, expected):
    alert = IntelligenceAlert(id=uuid.uuid4(), title="x", priority=priority)
    assert service.priority_score(alert) == expected


def test_priority_score_defaults_to_zero_for_unset_priority(service):
    alert = IntelligenceAlert(id=uuid.uuid4(), title="x")
    alert.priority = None
    assert service.priority_score(alert) == 0
