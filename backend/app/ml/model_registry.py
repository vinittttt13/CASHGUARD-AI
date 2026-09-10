import threading
import os
import joblib
from collections import defaultdict


class ModelRegistry:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ModelRegistry, cls).__new__(cls)
                cls._instance._models = {}
                cls._instance._versions = {}
                cls._instance._history = defaultdict(list)
                cls._instance.artifacts_dir = os.path.join(os.path.dirname(__file__), 'model_artifacts')
                os.makedirs(cls._instance.artifacts_dir, exist_ok=True)
        return cls._instance

    def _validate_model(self, model):
        """Validate that the model implements at least one inference method."""
        valid_methods = (
            "predict", "predict_top_k", "predict_risk", "predict_proba",
            "predict_cluster", "forecast", "transform",
        )
        if not any(callable(getattr(model, method, None)) for method in valid_methods):
            raise ValueError(
                f"Invalid model object: must implement at least one of {valid_methods}"
            )

    def register(self, name: str, model, version: str):
        self._validate_model(model)
        with self._lock:
            self._models[name] = model
            self._versions[name] = version

    def get(self, name: str):
        with self._lock:
            return self._models.get(name)

    def get_version(self, name: str):
        with self._lock:
            return self._versions.get(name)

    def hot_swap(self, name: str, new_model, new_version: str):
        """Hot-swap a running model with validation and version backup for rollback."""
        self._validate_model(new_model)
        with self._lock:
            if name in self._models:
                self._history[name].append((self._models[name], self._versions.get(name, "initial")))
            self._models[name] = new_model
            self._versions[name] = new_version

    def rollback(self, name: str) -> str:
        """Roll back to the previous model version from history stack."""
        with self._lock:
            if not self._history[name]:
                raise ValueError(f"No previous version available to rollback for model '{name}'")
            prev_model, prev_version = self._history[name].pop()
            self._models[name] = prev_model
            self._versions[name] = prev_version
            return prev_version

    def get_all_versions(self):
        with self._lock:
            return self._versions.copy()

    def get_history_count(self, name: str) -> int:
        with self._lock:
            return len(self._history[name])

    def save_to_disk(self, path=None):
        with self._lock:
            target_dir = path if path else self.artifacts_dir
            os.makedirs(target_dir, exist_ok=True)
            for name, model in self._models.items():
                joblib.dump({
                    'model': model,
                    'version': self._versions.get(name)
                }, os.path.join(target_dir, f"{name}.pkl"))

    def load_from_disk(self, path=None):
        with self._lock:
            target_dir = path if path else self.artifacts_dir
            if not os.path.exists(target_dir):
                return
            for f in os.listdir(target_dir):
                if f.endswith('.pkl'):
                    name = f.replace('.pkl', '')
                    data = joblib.load(os.path.join(target_dir, f))
                    self._models[name] = data['model']
                    self._versions[name] = data['version']

