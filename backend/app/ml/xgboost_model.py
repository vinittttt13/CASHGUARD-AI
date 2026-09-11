import joblib
import numpy as np
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder


class CashoutLocationPredictor:
    def __init__(self):
        self.model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.08,
            subsample=0.8,
            objective="multi:softprob",
            eval_metric="mlogloss",
        )
        self.feature_names = None
        self.label_encoder = LabelEncoder()
        self.classes_ = None

    def train(self, X_train, y_train, X_val, y_val, feature_names=None):
        self.feature_names = feature_names
        y_train_enc = self.label_encoder.fit_transform(y_train)
        y_val_enc = self.label_encoder.transform(y_val)
        self.classes_ = self.label_encoder.classes_
        self.model.fit(X_train, y_train_enc, eval_set=[(X_val, y_val_enc)], verbose=False)

    def fit(self, X, y, feature_names=None):
        self.feature_names = feature_names
        y_enc = self.label_encoder.fit_transform(y)
        self.classes_ = self.label_encoder.classes_
        self.model.set_params(early_stopping_rounds=None)
        self.model.fit(X, y_enc, verbose=False)
        return self

    def predict(self, X):
        probs = self.model.predict_proba(X)
        results = []
        for p in probs:
            sorted_probs = sorted(
                zip(self.classes_, p), key=lambda x: x[1], reverse=True
            )
            results.append(sorted_probs)
        return results

    def predict_top_k(self, X, k=5):
        all_preds = self.predict(X)
        return [preds[:k] for preds in all_preds]

    def get_feature_importance(self):
        if self.feature_names:
            importance = self.model.feature_importances_
            return dict(zip(self.feature_names, importance))
        return {}

    def save(self, path):
        data = {
            "model": self.model,
            "feature_names": self.feature_names,
            "classes_": self.classes_,
            "label_encoder": self.label_encoder,
        }
        joblib.dump(data, path)

    def load(self, path):
        data = joblib.load(path)
        self.model = data["model"]
        self.feature_names = data.get("feature_names")
        self.classes_ = data.get("classes_")
        self.label_encoder = data.get("label_encoder", LabelEncoder())

