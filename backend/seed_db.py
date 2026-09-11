"""
Database seed script for CPAF.
Creates initial admin user and sample data.

Usage:
    cd backend
    python seed_db.py
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus
from app.models.intelligence_alert import AlertPriority, AlertType, IntelligenceAlert
from app.models.prediction import Prediction, RiskLevel
from app.models.user import User, UserRole
from app.models.withdrawal_location import LocationType, WithdrawalLocation


async def seed():
    # Schema is created by `alembic upgrade head` (the migrate service / Job),
    # not here. Run migrations first.
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        from sqlalchemy import func, select

        user_count = await session.execute(select(func.count(User.id)))
        if user_count.scalar_one() > 0:
            print("⚠️  Database already has data. Skipping seed.")
            return

        print("\n📦 Seeding users...")

        # Create admin user
        admin = User(
            id=uuid.uuid4(),
            email="admin@cpaf.gov.in",
            hashed_password=get_password_hash("admin123"),
            full_name="CPAF Administrator",
            role=UserRole.admin,
            jurisdiction="National",
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)

        # Create analyst users
        analyst1 = User(
            id=uuid.uuid4(),
            email="analyst1@cpaf.gov.in",
            hashed_password=get_password_hash("analyst123"),
            full_name="Priya Sharma",
            role=UserRole.analyst,
            jurisdiction="Maharashtra",
            is_active=True,
        )
        analyst2 = User(
            id=uuid.uuid4(),
            email="analyst2@cpaf.gov.in",
            hashed_password=get_password_hash("analyst123"),
            full_name="Rajesh Kumar",
            role=UserRole.analyst,
            jurisdiction="Delhi",
            is_active=True,
        )
        session.add_all([analyst1, analyst2])

        # Create viewer user
        viewer = User(
            id=uuid.uuid4(),
            email="viewer@cpaf.gov.in",
            hashed_password=get_password_hash("viewer123"),
            full_name="Amit Verma",
            role=UserRole.viewer,
            jurisdiction="Karnataka",
            is_active=True,
        )
        session.add(viewer)

        await session.flush()
        print("  ✅ Created 4 users (admin, 2 analysts, 1 viewer)")

        # Seed withdrawal locations (ATMs)
        print("\n📦 Seeding withdrawal locations...")
        states_cities = {
            "Maharashtra": ["Mumbai", "Pune", "Nagpur"],
            "Delhi": ["New Delhi", "Dwarka"],
            "Karnataka": ["Bangalore", "Mysore"],
            "Tamil Nadu": ["Chennai", "Coimbatore"],
            "Uttar Pradesh": ["Lucknow", "Noida"],
            "Rajasthan": ["Jaipur", "Jodhpur"],
        }
        banks = ["SBI", "HDFC", "ICICI", "Axis", "PNB", "BOB", "Canara"]
        locations = []
        loc_coords = [
            (28.6139, 77.2090, "New Delhi"),
            (19.0760, 72.8777, "Mumbai"),
            (12.9716, 77.5946, "Bangalore"),
            (13.0827, 80.2707, "Chennai"),
            (26.9124, 75.7873, "Jaipur"),
            (28.5355, 77.3910, "Noida"),
            (18.5204, 73.8567, "Pune"),
            (26.8467, 80.9462, "Lucknow"),
            (21.1458, 79.0882, "Nagpur"),
            (12.2958, 76.6394, "Mysore"),
            (11.0168, 76.9558, "Coimbatore"),
            (26.2389, 73.0243, "Jodhpur"),
            (28.5918, 77.0469, "Dwarka"),
        ]

        for i, (lat, lng, city) in enumerate(loc_coords):
            for j in range(3):  # 3 ATMs per city
                state = [s for s, cities in states_cities.items() if city in cities]
                state_name = state[0] if state else "Delhi"
                loc = WithdrawalLocation(
                    id=uuid.uuid4(),
                    name=f"{random.choice(banks)} ATM - {city} #{j+1}",
                    location_type=LocationType.ATM,
                    latitude=lat + random.uniform(-0.02, 0.02),
                    longitude=lng + random.uniform(-0.02, 0.02),
                    address=f"{random.randint(1, 500)} Main Road, {city}",
                    city=city,
                    state=state_name,
                    pincode=f"{random.randint(100000, 999999)}",
                    bank_name=random.choice(banks),
                    atm_id=f"ATM-{random.randint(10000, 99999)}",
                    is_active=True,
                    risk_score=round(random.uniform(0.0, 1.0), 2),
                    incident_count=random.randint(0, 50),
                )
                locations.append(loc)

        session.add_all(locations)
        await session.flush()
        print(f"  ✅ Created {len(locations)} withdrawal locations")

        # Seed complaints
        print("\n📦 Seeding complaints...")
        categories = list(ComplaintCategory)
        complaints = []

        for i in range(50):
            state = random.choice(list(states_cities.keys()))
            city = random.choice(states_cities[state])
            lat, lng = random.choice(loc_coords)[:2]
            days_ago = random.randint(1, 180)
            complaint_date = datetime.utcnow() - timedelta(days=days_ago)

            complaint = Complaint(
                id=uuid.uuid4(),
                complaint_number=f"CYB/2024/{10000 + i}",
                victim_name_masked=f"V****{random.randint(1, 99):02d}",
                victim_phone_masked=f"98****{random.randint(1000, 9999)}",
                complaint_text=random.choice(
                    [
                        "Received fraudulent call claiming to be from bank. Shared OTP and lost money.",
                        "Clicked on phishing link received via SMS. Unauthorized transaction occurred.",
                        "ATM card cloned at a suspicious location. Multiple withdrawals made.",
                        "Received fake email from IT department asking for PAN details.",
                        "Online shopping fraud - paid for product but never received it.",
                        "Money transferred to wrong UPI ID through a scam app.",
                        "Investment fraud through fake trading platform.",
                        "Loan fraud - fake loan approval with advance fee demand.",
                    ]
                ),
                complaint_category=random.choice(categories),
                amount_defrauded=round(random.uniform(5000, 500000), 2),
                state=state,
                district=city,
                city=city,
                pincode=f"{random.randint(100000, 999999)}",
                latitude=lat + random.uniform(-0.05, 0.05),
                longitude=lng + random.uniform(-0.05, 0.05),
                complaint_date=complaint_date,
                incident_date=complaint_date - timedelta(days=random.randint(0, 5)),
                status=random.choice(list(ComplaintStatus)),
                bank_name=random.choice(banks),
                account_type=random.choice(["savings", "current"]),
                assigned_to=random.choice([analyst1.id, analyst2.id, None]),
            )
            complaints.append(complaint)

        session.add_all(complaints)
        await session.flush()
        print(f"  ✅ Created {len(complaints)} complaints")

        # Seed predictions for some complaints
        print("\n📦 Seeding predictions...")
        predictions = []
        for complaint in complaints[:30]:  # Predictions for first 30 complaints
            prediction = Prediction(
                id=uuid.uuid4(),
                complaint_id=complaint.id,
                predicted_latitude=(
                    complaint.latitude + random.uniform(-0.01, 0.01)
                    if complaint.latitude
                    else 28.6139
                ),
                predicted_longitude=(
                    complaint.longitude + random.uniform(-0.01, 0.01)
                    if complaint.longitude
                    else 77.2090
                ),
                confidence_score=round(random.uniform(0.5, 0.99), 2),
                predicted_locations=[
                    {
                        "lat": complaint.latitude or 28.6,
                        "lng": complaint.longitude or 77.2,
                        "atm_name": f"{random.choice(banks)} ATM",
                        "confidence": round(random.uniform(0.5, 0.99), 2),
                    }
                ],
                hotspot_cluster_id=random.randint(1, 10),
                model_version="1.0.0",
                model_name="xgboost_v1",
                feature_importance=[
                    {
                        "feature": "amount",
                        "importance": round(random.uniform(0.1, 0.5), 2),
                    },
                    {
                        "feature": "location",
                        "importance": round(random.uniform(0.1, 0.4), 2),
                    },
                    {
                        "feature": "time_of_day",
                        "importance": round(random.uniform(0.05, 0.3), 2),
                    },
                ],
                risk_level=random.choice(list(RiskLevel)),
                prediction_radius_km=round(random.uniform(1.0, 15.0), 1),
            )
            predictions.append(prediction)

        session.add_all(predictions)
        await session.flush()
        print(f"  ✅ Created {len(predictions)} predictions")

        # Seed intelligence alerts
        print("\n📦 Seeding intelligence alerts...")
        alerts = []
        for i in range(15):
            alert = IntelligenceAlert(
                id=uuid.uuid4(),
                title=random.choice(
                    [
                        "Hotspot Detected in Coimbatore / Tiruppur Corridor",
                        "Pattern Change in Chennai Suburbs",
                        "High Risk Location: ATM Cluster in Bengaluru",
                        "Temporal Spike in Phishing Cases",
                        "New Vishing Campaign Detected",
                        "ATM Fraud Surge in Bangalore",
                        "Cross-State Fraud Ring Alert",
                    ]
                ),
                description=f"Alert generated by automated analysis system. Confidence: {random.randint(70, 99)}%.",
                alert_type=random.choice(list(AlertType)),
                priority=random.choice(list(AlertPriority)),
                latitude=random.choice(loc_coords)[0],
                longitude=random.choice(loc_coords)[1],
                radius_km=round(random.uniform(1.0, 10.0), 1),
                confidence_score=round(random.uniform(0.6, 0.99), 2),
                is_active=random.choice([True, True, True, False]),  # 75% active
                is_acknowledged=random.choice([True, False, False]),  # 33% ack'd
            )
            alerts.append(alert)

        session.add_all(alerts)
        await session.commit()
        print(f"  ✅ Created {len(alerts)} intelligence alerts")

        print("\n" + "=" * 50)
        print("🎉 Database seeded successfully!")
        print("=" * 50)
        print("\n📋 Login credentials:")
        print("  Admin:    admin@cpaf.gov.in / admin123")
        print("  Analyst:  analyst1@cpaf.gov.in / analyst123")
        print("  Analyst:  analyst2@cpaf.gov.in / analyst123")
        print("  Viewer:   viewer@cpaf.gov.in / viewer123")
        print()


if __name__ == "__main__":
    asyncio.run(seed())

