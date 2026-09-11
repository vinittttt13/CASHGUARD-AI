import numpy as np
import shap


class SHAPExplainer:
    def __init__(self, model, feature_names):
        self.model = model
        self.feature_names = feature_names

        model_type = type(model).__name__
        if "XGB" in model_type or "RandomForest" in model_type:
            self.explainer = shap.TreeExplainer(model)
        else:
            self.explainer = shap.KernelExplainer(
                model.predict, np.zeros((1, len(feature_names)))
            )

    def explain_prediction(self, X_instance):
        shap_values = self.explainer.shap_values(X_instance)
        if isinstance(shap_values, list):
            vals = shap_values[0][0]
        else:
            vals = shap_values[0]
            if len(vals.shape) > 1:
                vals = vals[0]
        return {k: float(v) for k, v in zip(self.feature_names, vals)}

    def explain_batch(self, X_batch):
        shap_values = self.explainer.shap_values(X_batch)
        explanations = []
        if isinstance(shap_values, list):
            sv = shap_values[0]
        else:
            sv = shap_values

        for i in range(len(X_batch)):
            explanations.append(dict(zip(self.feature_names, sv[i])))
        return explanations

    def get_global_importance(self, X_sample):
        shap_values = self.explainer.shap_values(X_sample)
        if isinstance(shap_values, list):
            sv = shap_values[0]
        else:
            sv = shap_values

        mean_abs = np.abs(sv).mean(axis=0)
        if len(mean_abs.shape) > 1:
            mean_abs = mean_abs.mean(axis=1)

        importance = list(zip(self.feature_names, mean_abs))
        return sorted(importance, key=lambda x: x[1], reverse=True)

    def to_radar_data(self, explanation):
        return [{"feature": k, "value": float(v)} for k, v in explanation.items()]
