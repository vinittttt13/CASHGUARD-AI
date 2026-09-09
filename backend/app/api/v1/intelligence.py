from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.intelligence_alert import IntelligenceAlert, AlertPriority, AlertType
from app.schemas.alert import AlertCreate, AlertResponse, AlertListResponse

router = APIRouter(prefix="/intelligence", tags=["Intelligence"])


@router.get("/alerts", response_model=AlertListResponse)
async def get_active_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(IntelligenceAlert)
        .where(IntelligenceAlert.is_active == True)
        .order_by(IntelligenceAlert.created_at.desc())
        .limit(50)
    )
    result = await db.execute(query)
    alerts = result.scalars().all()

    total_query = select(IntelligenceAlert).where(IntelligenceAlert.is_active == True)
    from sqlalchemy import func

    count_result = await db.execute(
        select(func.count()).select_from(total_query.subquery())
    )
    total = count_result.scalar_one()

    return {"items": alerts, "total": total}


@router.post("/alerts", response_model=AlertResponse)
async def create_alert(
    alert_data: AlertCreate,
    current_user: User = Depends(require_role("analyst", "admin")),
    db: AsyncSession = Depends(get_db),
):
    new_alert = IntelligenceAlert(**alert_data.model_dump())
    db.add(new_alert)
    await db.commit()
    await db.refresh(new_alert)
    return new_alert


@router.put("/alerts/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IntelligenceAlert).where(IntelligenceAlert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_acknowledged = True
    alert.acknowledged_by = current_user.id
    await db.commit()
    await db.refresh(alert)
    return alert


@router.get("/trends")
async def get_trends(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Mock trend data
    return {
        "daily_counts": [10, 15, 8, 20, 12, 18, 22],
        "forecast": [14, 16, 18, 20, 22, 24, 26],
    }


@router.get("/report")
async def get_intelligence_report(
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func

    # Get actual counts from DB
    from app.models.complaint import Complaint

    total_complaints = await db.execute(select(func.count(Complaint.id)))
    alert_count = await db.execute(
        select(func.count(IntelligenceAlert.id)).where(
            IntelligenceAlert.is_active == True
        )
    )

    return {
        "summary": "Cybercrime activity report",
        "total_complaints": total_complaints.scalar_one(),
        "active_alerts": alert_count.scalar_one(),
        "generated_at": datetime.utcnow().isoformat(),
        "recommendations": [
            "Increase monitoring at top 5 active hotspots.",
            "Deploy local task force to recent critical alert zones.",
        ],
    }
