from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.intelligence_alert import AlertPriority, AlertType, IntelligenceAlert
from app.models.user import User
from app.schemas.alert import AlertCreate, AlertListResponse, AlertResponse

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


from fastapi import Query
from fastapi.responses import Response

from app.services.intelligence_service import IntelligenceService

_intel_service = IntelligenceService()


@router.get("/trends")
async def get_trends(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _intel_service.get_trends(db=db, days=days)


@router.get("/report")
async def get_intelligence_report(
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _intel_service.generate_report(db=db, days=days)


@router.get("/report/export")
async def export_intelligence_report(
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    csv_content = await _intel_service.export_report_csv(db=db, days=days)
    filename = f"intelligence_report_{days}d.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/fraud-rings")
async def get_fraud_rings(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _intel_service.get_fraud_rings(db=db, days=days)

