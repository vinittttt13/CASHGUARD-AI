from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.withdrawal_location import LocationType, WithdrawalLocation

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


from app.services.geospatial_service import GeospatialService

_geo_service = GeospatialService()


@router.get("/hotspots")
async def get_hotspots(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(WithdrawalLocation)
        .where(
            and_(
                WithdrawalLocation.is_active == True,
                WithdrawalLocation.risk_score >= 0.5,
            )
        )
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
                "incident_count": loc.incident_count or 0,
                "risk_score": loc.risk_score or 0.0,
                "name": loc.name,
            }
        )
    return hotspots


@router.get("/heatmap")
async def get_heatmap(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(WithdrawalLocation).where(WithdrawalLocation.is_active == True)
    result = await db.execute(query)
    locations = result.scalars().all()
    return _geo_service.generate_heatmap_points(locations)


@router.get("/nearby")
async def get_nearby_locations(
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _geo_service.load_atm_locations(db)
    return _geo_service.find_within_radius(lat, lng, radius_km)



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
