import argparse
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import os

from feature_engineering import FeatureEngineer, FEATURE_NAMES
from xgboost_model import CashoutLocationPredictor
from random_forest_model import RiskLevelClassifier
from prophet_model import TemporalForecaster
from kmeans_hotspot import HotspotDetector
from model_registry import ModelRegistry

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--from-csv', type=str, help='Path to CSV')
    parser.add_argument('--production', action='store_true', help='Deploy to prod')
    parser.add_argument('--model-version', type=str, default='v1.0')
    args = parser.parse_args()

    print(f"Starting training pipeline. Version: {args.model_version}")

    if args.from_csv:
        df = pd.read_csv(args.from_csv)
    else:
        print("Loading from DB (Mocked)...")
        df = pd.DataFrame({
            'timestamp': pd.date_range('2024-01-01', periods=100),
            'lat': np.random.uniform(18, 20, 100),
            'lng': np.random.uniform(72, 74, 100),
            'complaint_text': ['mock complaint']*100,
            'amount': np.random.uniform(100, 10000, 100),
            'state': ['MH']*100,
            'district': ['Mumbai']*100,
            'category': ['Phishing']*100,
            'bank_name': ['SBI']*100,
            'cluster_id': np.random.randint(0, 5, 100),
            'risk_level': np.random.choice(['low', 'medium', 'high'], 100)
        })

    print("1. Feature Engineering")
    fe = FeatureEngineer()
    
    atm_df = pd.DataFrame({
        'lat': np.random.uniform(18, 20, 10),
        'lng': np.random.uniform(72, 74, 10)
    })
    fe.fit_atm_tree(atm_df)
    
    X = fe.create_feature_matrix(df, is_training=True)
    
    y_cluster = df['cluster_id'].values
    y_risk = df['risk_level'].values

    X_train, X_val, y_cluster_train, y_cluster_val = train_test_split(X, y_cluster, test_size=0.2, random_state=42)
    _, _, y_risk_train, y_risk_val = train_test_split(X, y_risk, test_size=0.2, random_state=42)

    print("2. Train XGBoost Location Predictor")
    xgb_model = CashoutLocationPredictor()
    xgb_model.train(X_train, y_cluster_train, X_val, y_cluster_val, feature_names=FEATURE_NAMES)
    preds = [p[0][0] for p in xgb_model.predict(X_val)]
    print(f"XGBoost Validation Accuracy: {accuracy_score(y_cluster_val, preds):.2f}")

    print("3. Train Random Forest Risk Classifier")
    rf_model = RiskLevelClassifier()
    rf_model.train(X_train, y_risk_train)
    risk_preds = [p[0] for p in rf_model.predict_risk(X_val)]
    print(f"RF Validation Accuracy: {accuracy_score(y_risk_val, risk_preds):.2f}")

    print("4. Train Prophet Temporal Model")
    prophet_df = df[['timestamp']].copy()
    prophet_df['ds'] = pd.to_datetime(prophet_df['timestamp']).dt.date
    prophet_counts = prophet_df.groupby('ds').size().reset_index(name='y')
    prophet_model = TemporalForecaster()
    if len(prophet_counts) > 2:
        prophet_model.train(prophet_counts)

    print("5. Train K-Means Hotspot Detector")
    km_model = HotspotDetector()
    coords = df[['lat', 'lng']].values.tolist()
    km_model.fit(coords)

    print("6. Register and Save Models")
    registry = ModelRegistry()
    registry.register('xgboost_location', xgb_model, args.model_version)
    registry.register('rf_risk', rf_model, args.model_version)
    registry.register('prophet_temporal', prophet_model, args.model_version)
    registry.register('kmeans_hotspot', km_model, args.model_version)
    
    artifacts_dir = os.path.join(os.path.dirname(__file__), 'model_artifacts')
    os.makedirs(artifacts_dir, exist_ok=True)
    registry.save_to_disk(artifacts_dir)

    print("Training Complete!")

if __name__ == '__main__':
    main()
