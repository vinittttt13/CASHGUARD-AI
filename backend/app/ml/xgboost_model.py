import joblib
import numpy as np
import xgboost as xgb


class CashoutLocationPredictor:
    def __init__(self):
        self.model = xgb.XGBClassifier(
            n_estimators=500,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            objective="multi:softprob",
            eval_metric="mlogloss",
            early_stopping_rounds=20,
        )
        self.feature_names = None
        self.classes_ = None

    def train(self, X_train, y_train, X_val, y_val, feature_names=None):
        self.feature_names = feature_names
        self.classes_ = np.unique(y_train)
        self.model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

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
        }
        joblib.dump(data, path)

    def load(self, path):
        data = joblib.load(path)
        self.model = data["model"]
        self.feature_names = data.get("feature_names")
        self.classes_ = data.get("classes_")
