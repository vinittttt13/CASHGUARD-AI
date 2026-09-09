import numpy as np
import pandas as pd
from datetime import datetime
import math
from sklearn.preprocessing import LabelEncoder
from sklearn.neighbors import KDTree

FEATURE_NAMES = [
    'hour', 'day_of_week', 'month', 'is_weekend', 'is_holiday_period',
    'dist_to_city_center', 'dist_to_atm',
    'tfidf_sum', 'ner_loc_count', 'bank_name_indicator',
    'amount_log', 'amount_percentile', 'is_round_number',
    'state_encoded', 'district_encoded', 'category_encoded', 'bank_encoded'
]

class FeatureEngineer:
    def __init__(self):
        self.label_encoders = {}
        self.atm_tree = None
        self.atm_coords = None
        self.city_centers = {
            'Mumbai': (19.0760, 72.8777),
            'Delhi': (28.7041, 77.1025),
            'Bangalore': (12.9716, 77.5946),
            'Hyderabad': (17.3850, 78.4867),
            'Chennai': (13.0827, 80.2707),
            'Kolkata': (22.5726, 88.3639),
        }
        
    def haversine(self, lat1, lon1, lat2, lon2):
        R = 6371  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2) * math.sin(dlat/2) + \
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.sin(dlon/2) * math.sin(dlon/2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c

    def fit_atm_tree(self, atm_df):
        self.atm_coords = atm_df[['lat', 'lng']].values
        self.atm_tree = KDTree(self.atm_coords, metric='euclidean')

    def extract_temporal_features(self, df):
        df['datetime'] = pd.to_datetime(df['timestamp'])
        df['hour'] = df['datetime'].dt.hour
        df['day_of_week'] = df['datetime'].dt.dayofweek
        df['month'] = df['datetime'].dt.month
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['is_holiday_period'] = df['month'].isin([10, 11]).astype(int)
        return df

    def extract_spatial_features(self, df):
        def nearest_city_dist(row):
            min_dist = float('inf')
            for city, (lat, lon) in self.city_centers.items():
                d = self.haversine(row['lat'], row['lng'], lat, lon)
                if d < min_dist:
                    min_dist = d
            return min_dist
            
        df['dist_to_city_center'] = df.apply(nearest_city_dist, axis=1)
        
        if self.atm_tree is not None:
            coords = df[['lat', 'lng']].values
            dist, ind = self.atm_tree.query(coords, k=1)
            exact_dists = [self.haversine(df.iloc[i]['lat'], df.iloc[i]['lng'], 
                                          self.atm_coords[ind[i][0]][0], self.atm_coords[ind[i][0]][1])
                           for i in range(len(df))]
            df['dist_to_atm'] = exact_dists
        else:
            df['dist_to_atm'] = 0.0
            
        return df

    def extract_text_features(self, df):
        df['tfidf_sum'] = df['complaint_text'].apply(lambda x: len(str(x).split()) * 0.1)
        df['ner_loc_count'] = df['complaint_text'].apply(lambda x: str(x).count(' at ') + str(x).count(' in '))
        df['bank_name_indicator'] = df['complaint_text'].str.contains('bank|sbi|hdfc|icici|axis|pnb', case=False, na=False).astype(int)
        return df

    def extract_amount_features(self, df):
        df['amount_log'] = np.log1p(df['amount'])
        df['amount_percentile'] = df['amount'].rank(pct=True)
        df['is_round_number'] = (df['amount'] % 1000 == 0).astype(int)
        return df

    def extract_categorical_features(self, df, is_training=False):
        cats = ['state', 'district', 'category', 'bank_name']
        for c in cats:
            if c not in df.columns:
                df[c] = 'Unknown'
            df[c] = df[c].fillna('Unknown').astype(str)
            if is_training:
                le = LabelEncoder()
                df[f'{c}_encoded'] = le.fit_transform(df[c])
                self.label_encoders[c] = le
            else:
                le = self.label_encoders.get(c)
                if le is not None:
                    classes = le.classes_
                    df[f'{c}_encoded'] = df[c].apply(lambda x: le.transform([x])[0] if x in classes else 0)
                else:
                    df[f'{c}_encoded'] = 0
        return df

    def create_feature_matrix(self, complaints_df, is_training=False):
        df = complaints_df.copy()
        df = self.extract_temporal_features(df)
        df = self.extract_spatial_features(df)
        df = self.extract_text_features(df)
        df = self.extract_amount_features(df)
        df = self.extract_categorical_features(df, is_training)
        return df[FEATURE_NAMES].values
