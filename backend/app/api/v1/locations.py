from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.withdrawal_location import WithdrawalLocation, LocationType

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("")
async def get_locations(
    city: Optional[str] = None,
    state: Optional[str] = None,
    loc_type: Optional[LocationType] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(WithdrawalLocation).where(WithdrawalLocation.is_active == True)
    conditions = []
    if city:
        conditions.append(WithdrawalLocation.city == city)
    if state:
        conditions.append(WithdrawalLocation.state == state)
    if loc_type:
        conditions.append(WithdrawalLocation.location_type == loc_type)

    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query.limit(100))
    locations = result.scalars().all()
    return locations


@router.get("/hotspots")
async def get_hotspots(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Return locations with highest risk scores
    query = (
        select(WithdrawalLocation)
        .where(WithdrawalLocation.risk_score > 0.5)
        .order_by(WithdrawalLocation.risk_score.desc())
        .limit(20)
    )
    result = await db.execute(query)
    locations = result.scalars().all()

    hotspots = []
    for loc in locations:
        hotspots.append(
            {
                "cluster_id": str(loc.id)[:8],
                "center": [loc.latitude, loc.longitude],
                "radius_km": 5.0,
                "incident_count": loc.incident_count,
                "risk_score": loc.risk_score,
                "name": loc.name,
            }
        )

    # Return mock data if no real data yet
    if not hotspots:
        hotspots = [
            {
                "cluster_id": "1",
                "center": [28.7041, 77.1025],
                "radius_km": 5.0,
                "incident_count": 45,
                "risk_score": 0.85,
            },
            {
                "cluster_id": "2",
                "center": [19.0760, 72.8777],
                "radius_km": 3.2,
                "incident_count": 30,
                "risk_score": 0.72,
            },
        ]

    return hotspots


@router.get("/heatmap")
async def get_heatmap(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(WithdrawalLocation).where(WithdrawalLocation.is_active == True)
    result = await db.execute(query)
    locations = result.scalars().all()

    points = [
        {"lat": loc.latitude, "lng": loc.longitude, "weight": loc.risk_score or 0.5}
        for loc in locations
    ]

    if not points:
        points = [{"lat": 28.6, "lng": 77.2, "weight": 0.9}]

    return points


@router.get("/nearby")
async def get_nearby_locations(
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Simple bounding box filter (approximate, not geodesic)
    lat_diff = radius_km / 111.0  # ~111 km per degree latitude
    lng_diff = radius_km / (111.0 * abs(max(0.01, abs(lat))))

    query = select(WithdrawalLocation).where(
        and_(
            WithdrawalLocation.latitude.between(lat - lat_diff, lat + lat_diff),
            WithdrawalLocation.longitude.between(lng - lng_diff, lng + lng_diff),
            WithdrawalLocation.is_active == True,
        )
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{location_id}")
async def get_location(
    location_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WithdrawalLocation).where(WithdrawalLocation.id == location_id)
    )
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.post("")
async def create_location(
    location_data: dict,
    current_user: User = Depends(require_role("analyst", "admin")),
    db: AsyncSession = Depends(get_db),
):
    new_loc = WithdrawalLocation(**location_data)
    db.add(new_loc)
    await db.commit()
    await db.refresh(new_loc)
    return new_loc
