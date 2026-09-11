import math
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree
from sklearn.preprocessing import LabelEncoder

FEATURE_NAMES = [
    "hour",
    "day_of_week",
    "month",
    "is_weekend",
    "is_holiday_period",
    "dist_to_city_center",
    "dist_to_atm",
    "tfidf_sum",
    "ner_loc_count",
    "bank_name_indicator",
    "amount_log",
    "amount_percentile",
    "is_round_number",
    "state_encoded",
    "district_encoded",
    "category_encoded",
    "bank_encoded",
]


class FeatureEngineer:
    def __init__(self):
        self.label_encoders = {}
        self.amount_bins = None
        self.atm_tree = None
        self.atm_coords = None
        self.city_centers = {
            "Mumbai": (19.0760, 72.8777),
            "Delhi": (28.7041, 77.1025),
            "Bangalore": (12.9716, 77.5946),
            "Hyderabad": (17.3850, 78.4867),
            "Chennai": (13.0827, 80.2707),
            "Kolkata": (22.5726, 88.3639),
        }

    def haversine(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Great-circle distance in kilometers using the Haversine formula."""
        R = 6371.0  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def fit_atm_tree(self, atm_df: pd.DataFrame) -> None:
        """Fit a geodesic BallTree with haversine metric on radian coordinates."""
        self.atm_coords = atm_df[["lat", "lng"]].values
        rad_coords = np.radians(self.atm_coords)
        self.atm_tree = BallTree(rad_coords, metric="haversine")

    def extract_temporal_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df["datetime"] = pd.to_datetime(df["timestamp"])
        df["hour"] = df["datetime"].dt.hour
        df["day_of_week"] = df["datetime"].dt.dayofweek
        df["month"] = df["datetime"].dt.month
        df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
        df["is_holiday_period"] = df["month"].isin([10, 11]).astype(int)
        return df

    def extract_spatial_features(self, df: pd.DataFrame) -> pd.DataFrame:
        def nearest_city_dist(row):
            min_dist = float("inf")
            for city, (lat, lon) in self.city_centers.items():
                d = self.haversine(row["lat"], row["lng"], lat, lon)
                if d < min_dist:
                    min_dist = d
            return min_dist

        df["dist_to_city_center"] = df.apply(nearest_city_dist, axis=1)

        if self.atm_tree is not None and len(df) > 0:
            coords = df[["lat", "lng"]].values
            rad_query = np.radians(coords)
            rad_dist, _ = self.atm_tree.query(rad_query, k=1)
            # rad_dist is in radians; multiply by Earth radius to get km
            df["dist_to_atm"] = rad_dist[:, 0] * 6371.0
        else:
            df["dist_to_atm"] = 0.0

        return df

    def extract_text_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df["tfidf_sum"] = df["complaint_text"].apply(
            lambda x: len(str(x).split()) * 0.1
        )
        df["ner_loc_count"] = df["complaint_text"].apply(
            lambda x: str(x).count(" at ") + str(x).count(" in ")
        )
        df["bank_name_indicator"] = (
            df["complaint_text"]
            .str.contains("bank|sbi|hdfc|icici|axis|pnb", case=False, na=False)
            .astype(int)
        )
        return df

    def extract_amount_features(
        self, df: pd.DataFrame, is_training: bool = False
    ) -> pd.DataFrame:
        """Extract amount features without data leakage.

        During training, quantile thresholds are fitted. During inference, values
        are mapped onto these bins. Single instances use the fitted bins (or
        logarithmic interpolation fallback) to avoid degenerate 1.0 rank.
        """
        df["amount_log"] = np.log1p(df["amount"])
        df["is_round_number"] = (df["amount"] % 1000 == 0).astype(int)

        if is_training:
            amounts = df["amount"].dropna().values
            if len(amounts) > 0:
                self.amount_bins = np.percentile(amounts, np.linspace(0, 100, 101))
                ranks = np.searchsorted(self.amount_bins, df["amount"], side="right")
                df["amount_percentile"] = np.clip(ranks / 100.0, 0.0, 1.0)
            else:
                df["amount_percentile"] = 0.5
        else:
            if self.amount_bins is not None:
                ranks = np.searchsorted(self.amount_bins, df["amount"], side="right")
                df["amount_percentile"] = np.clip(ranks / 100.0, 0.0, 1.0)
            elif len(df) > 1:
                df["amount_percentile"] = df["amount"].rank(pct=True).fillna(0.5)
            else:
                # Single-instance inference with no fitted training bins:
                # Use empirical benchmark logarithmic scale (Rs. 100 to Rs. 200,000)
                val = float(df["amount"].iloc[0]) if len(df) > 0 else 0.0
                log_min = np.log1p(100.0)
                log_max = np.log1p(200000.0)
                scaled = (np.log1p(max(0.0, val)) - log_min) / (log_max - log_min)
                df["amount_percentile"] = float(np.clip(scaled, 0.0, 1.0))

        return df

    def extract_categorical_features(
        self, df: pd.DataFrame, is_training: bool = False
    ) -> pd.DataFrame:
        cats = [
            ("state", "state_encoded"),
            ("district", "district_encoded"),
            ("category", "category_encoded"),
            ("bank_name", "bank_encoded"),
        ]
        for c, target_col in cats:
            if c not in df.columns:
                df[c] = "Unknown"
            df[c] = df[c].fillna("Unknown").astype(str)

            if is_training:
                unique_vals = list(df[c].unique())
                if "Unknown" not in unique_vals:
                    unique_vals.append("Unknown")
                le = LabelEncoder()
                le.fit(unique_vals)
                self.label_encoders[c] = le
                unknown_idx = le.transform(["Unknown"])[0]
                df[target_col] = df[c].apply(
                    lambda x: le.transform([x])[0] if x in le.classes_ else unknown_idx
                )
            else:
                le = self.label_encoders.get(c)
                if le is not None:
                    unknown_idx = (
                        le.transform(["Unknown"])[0] if "Unknown" in le.classes_ else 0
                    )
                    df[target_col] = df[c].apply(
                        lambda x: (
                            le.transform([x])[0] if x in le.classes_ else unknown_idx
                        )
                    )
                else:
                    df[target_col] = 0
        return df

    def create_feature_matrix(
        self, complaints_df: pd.DataFrame, is_training: bool = False
    ) -> np.ndarray:
        df = complaints_df.copy()
        df = self.extract_temporal_features(df)
        df = self.extract_spatial_features(df)
        df = self.extract_text_features(df)
        df = self.extract_amount_features(df, is_training=is_training)
        df = self.extract_categorical_features(df, is_training=is_training)
        return df[FEATURE_NAMES].values
