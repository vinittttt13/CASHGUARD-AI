from math import asin, cos, radians, sin, sqrt

import joblib
import numpy as np
from sklearn.cluster import DBSCAN, KMeans


class HotspotDetector:
    def __init__(self):
        self.kmeans = None
        # DBSCAN on raw lat/lng degrees; eps=0.01 ≈ 1.1 km near equator (approx)
        # Used for noise/outlier detection rather than precise cluster extraction
        self.dbscan = DBSCAN(eps=0.01, min_samples=5)
        self.cluster_info = []

    def haversine(self, lon1, lat1, lon2, lat2):
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1 
        dlat = lat2 - lat1 
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a)) 
        r = 6371 
        return c * r

    def find_best_k(self, coordinates):
        if len(coordinates) < 3:
            return len(coordinates)
        max_k = min(15, len(coordinates) - 1)
        return min(max_k, 5)

    def fit(self, coordinates):
        coords = np.array(coordinates)
        if len(coords) == 0:
            return
            
        self.dbscan.fit(coords)
        
        k = self.find_best_k(coords)
        self.kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = self.kmeans.fit_predict(coords)
        
        self.cluster_info = []
        for c in range(k):
            cluster_pts = coords[labels == c]
            if len(cluster_pts) == 0:
                continue
            center = self.kmeans.cluster_centers_[c]
            dists = [self.haversine(pt[1], pt[0], center[1], center[0]) for pt in cluster_pts]
            radius = max(dists) if dists else 0
            self.cluster_info.append({
                'cluster_id': c,
                'center_lat': center[0],
                'center_lng': center[1],
                'radius_km': radius,
                'incident_count': len(cluster_pts),
                'risk_score': min(1.0, len(cluster_pts) / 100.0)
            })

    def predict_cluster(self, lat, lng):
        if self.kmeans is None:
            return -1
        return self.kmeans.predict([[lat, lng]])[0]

    def get_hotspots(self):
        return self.cluster_info

    def update_hotspots(self, new_coordinates):
        """Incremental update: refit DBSCAN + KMeans on combined data."""
        if not new_coordinates:
            return
        coords = np.array(new_coordinates)
        self.dbscan.fit(coords)
        k = self.find_best_k(coords)
        self.kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = self.kmeans.fit_predict(coords)
        # Rebuild cluster_info from new labels
        self.cluster_info = []
        for c in range(k):
            pts = coords[labels == c]
            if len(pts) == 0:
                continue
            center = self.kmeans.cluster_centers_[c]
            dists = [self.haversine(pt[1], pt[0], center[1], center[0]) for pt in pts]
            self.cluster_info.append({
                'cluster_id': c, 'center_lat': float(center[0]),
                'center_lng': float(center[1]), 'radius_km': float(max(dists) if dists else 0),
                'incident_count': int(len(pts)), 'risk_score': float(min(1.0, len(pts) / 100.0))
            })

    def visualize_hotspots(self):
        """Return cluster info formatted for plotting (e.g., Leaflet overlay)."""
        return [
            {
                'cluster_id': info['cluster_id'],
                'lat': info['center_lat'],
                'lng': info['center_lng'],
                'radius': info['radius_km'] * 1000,  # meters for map rendering
                'count': info['incident_count'],
            }
            for info in self.cluster_info
        ]

    def save(self, path):
        joblib.dump({'kmeans': self.kmeans, 'dbscan': self.dbscan, 'cluster_info': self.cluster_info}, path)

    def load(self, path):
        data = joblib.load(path)
        self.kmeans = data['kmeans']
        self.dbscan = data['dbscan']
        self.cluster_info = data['cluster_info']
