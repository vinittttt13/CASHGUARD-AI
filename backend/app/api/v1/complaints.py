from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus
from app.models.user import User, UserRole
from app.schemas.complaint import (
    ComplaintCreate,
    ComplaintListResponse,
    ComplaintResponse,
    ComplaintUpdate,
)
from app.utils.anonymizer import mask_text

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.get("", response_model=ComplaintListResponse)
async def get_complaints(
    skip: int = 0,
    limit: int = 50,
    status: Optional[ComplaintStatus] = None,
    category: Optional[ComplaintCategory] = None,
    state: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Complaint)

    conditions = []
    if status:
        conditions.append(Complaint.status == status)
    if category:
        conditions.append(Complaint.complaint_category == category)
    if state:
        conditions.append(Complaint.state == state)
    if start_date:
        conditions.append(Complaint.created_at >= start_date)
    if end_date:
        conditions.append(Complaint.created_at <= end_date)

    if conditions:
        query = query.where(and_(*conditions))

    total_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(total_query)
    total = total_result.scalar_one()

    query = query.order_by(Complaint.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    complaints = result.scalars().all()

    # Mask PII for viewer role
    if current_user.role == UserRole.viewer:
        for c in complaints:
            # victim_name_masked / victim_phone_masked are already masked at
            # creation time; do NOT overwrite with a literal "***" (loses the
            # last-4-digit pattern). Only redact free-form complaint_text.
            c.complaint_text = mask_text(c.complaint_text or "")

    return {"total": total, "items": complaints}


@router.post("", response_model=ComplaintResponse)
async def create_complaint(
    complaint_in: ComplaintCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    new_complaint = Complaint(**complaint_in.model_dump())
    db.add(new_complaint)
    await db.commit()
    await db.refresh(new_complaint)
    return new_complaint


@router.get("/stats/aggregate")
async def get_complaint_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category_result = await db.execute(
        select(Complaint.complaint_category, func.count()).group_by(
            Complaint.complaint_category
        )
    )
    state_result = await db.execute(
        select(Complaint.state, func.count()).group_by(Complaint.state)
    )
    status_result = await db.execute(
        select(Complaint.status, func.count()).group_by(Complaint.status)
    )

    def _key(k):
        # Enum -> its value ("phishing"), plain str stays as-is.
        return getattr(k, "value", k)

    return {
        "by_category": {_key(k): v for k, v in category_result.all() if k is not None},
        "by_state": {_key(k): v for k, v in state_result.all() if k is not None},
        "by_status": {_key(k): v for k, v in status_result.all() if k is not None},
    }


@router.get("/{complaint_id}", response_model=ComplaintResponse)
async def get_complaint(
    complaint_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    if current_user.role == UserRole.viewer:
        # Preserve existing masked fields; only redact free-form complaint_text.
        complaint.complaint_text = mask_text(complaint.complaint_text or "")

    return complaint


@router.put("/{complaint_id}", response_model=ComplaintResponse)
async def update_complaint(
    complaint_id: UUID,
    complaint_in: ComplaintUpdate,
    current_user: User = Depends(require_role("analyst", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    update_data = complaint_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(complaint, key, value)

    await db.commit()
    await db.refresh(complaint)
    return complaint


@router.delete("/{complaint_id}")
async def delete_complaint(
    complaint_id: UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    await db.delete(complaint)
    await db.commit()
    return {"message": "Complaint deleted successfully"}
