import numpy as np
from sklearn.cluster import KMeans, DBSCAN
from math import radians, cos, sin, asin, sqrt
import joblib

class HotspotDetector:
    def __init__(self):
        self.kmeans = None
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
        pass

    def visualize_hotspots(self):
        return self.cluster_info

    def save(self, path):
        joblib.dump({'kmeans': self.kmeans, 'dbscan': self.dbscan, 'cluster_info': self.cluster_info}, path)

    def load(self, path):
        data = joblib.load(path)
        self.kmeans = data['kmeans']
        self.dbscan = data['dbscan']
        self.cluster_info = data['cluster_info']
