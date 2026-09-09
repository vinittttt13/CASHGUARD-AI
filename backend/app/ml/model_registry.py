import threading
import os
import joblib

class ModelRegistry:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ModelRegistry, cls).__new__(cls)
                cls._instance._models = {}
                cls._instance._versions = {}
                cls._instance.artifacts_dir = os.path.join(os.path.dirname(__file__), 'model_artifacts')
                os.makedirs(cls._instance.artifacts_dir, exist_ok=True)
        return cls._instance

    def register(self, name, model, version):
        with self._lock:
            self._models[name] = model
            self._versions[name] = version

    def get(self, name):
        with self._lock:
            return self._models.get(name)

    def hot_swap(self, name, new_model, new_version):
        with self._lock:
            self._models[name] = new_model
            self._versions[name] = new_version

    def get_all_versions(self):
        with self._lock:
            return self._versions.copy()

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
            for f in os.listdir(target_dir):
                if f.endswith('.pkl'):
                    name = f.replace('.pkl', '')
                    data = joblib.load(os.path.join(target_dir, f))
                    self._models[name] = data['model']
                    self._versions[name] = data['version']
