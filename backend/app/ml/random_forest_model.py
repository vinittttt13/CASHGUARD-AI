import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score


class RiskLevelClassifier:
    def __init__(self):
        self.model = RandomForestClassifier(
            n_estimators=200, class_weight="balanced", random_state=42
        )
        self.classes_ = None

    def train(self, X_train, y_train):
        self.model.fit(X_train, y_train)
        self.classes_ = self.model.classes_

    def predict_risk(self, X):
        preds = self.model.predict(X)
        probs = self.model.predict_proba(X)
        results = []
        for i, p in enumerate(preds):
            prob_dict = dict(zip(self.classes_, probs[i]))
            results.append((p, prob_dict))
        return results

    def cross_validate(self, X, y, cv=5):
        scores = cross_val_score(self.model, X, y, cv=cv, scoring="accuracy")
        return np.mean(scores)

    def save(self, path):
        joblib.dump({"model": self.model, "classes_": self.classes_}, path)

    def load(self, path):
        data = joblib.load(path)
        self.model = data["model"]
        self.classes_ = data.get("classes_")
