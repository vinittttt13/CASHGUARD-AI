import math

class GeospatialService:
    def __init__(self):
        self.kd_tree = None
        
    def load_atm_locations(self, db):
        # Builds K-D tree from withdrawal_locations table
        pass
        
    def haversine(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0 # Earth radius in kilometers
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        distance = R * c
        return distance
        
    def find_nearest_atms(self, lat: float, lng: float, k: int = 10) -> list:
        # Mock nearest ATMs
        return [{"location": "ATM 1", "distance_km": 1.2}]
        
    def find_within_radius(self, lat: float, lng: float, radius_km: float) -> list:
        return []
        
    def get_cluster_center(self, cluster_id: int) -> tuple:
        return (28.6139, 77.2090)
        
    def generate_heatmap_points(self, predictions: list) -> list:
        return [{"lat": 28.6, "lng": 77.2, "weight": 0.9}]
        
    def geocode_address(self, address: str) -> tuple:
        # Uses Nominatim in reality
        return (28.6, 77.2)
        
    def reverse_geocode(self, lat: float, lng: float) -> str:
        return "123 Cyber Street, New Delhi"
        
    def calculate_risk_score(self, location: dict, recent_incidents: int) -> float:
        return min(1.0, recent_incidents * 0.1)
