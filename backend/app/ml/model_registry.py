import glob
import logging
import os
import tempfile
import threading
from collections import defaultdict
from urllib.parse import urlparse

import joblib

logger = logging.getLogger(__name__)


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
                cls._instance.artifacts_dir = os.path.join(
                    os.path.dirname(__file__), "model_artifacts"
                )
                os.makedirs(cls._instance.artifacts_dir, exist_ok=True)
        return cls._instance

    def _validate_model(self, model):
        """Validate that the model implements at least one inference method."""
        valid_methods = (
            "predict",
            "predict_top_k",
            "predict_risk",
            "predict_proba",
            "predict_cluster",
            "forecast",
            "transform",
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
                self._history[name].append(
                    (self._models[name], self._versions.get(name, "initial"))
                )
            self._models[name] = new_model
            self._versions[name] = new_version

    def rollback(self, name: str) -> str:
        """Roll back to the previous model version from history stack."""
        with self._lock:
            if not self._history[name]:
                raise ValueError(
                    f"No previous version available to rollback for model '{name}'"
                )
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
                joblib.dump(
                    {"model": model, "version": self._versions.get(name)},
                    os.path.join(target_dir, f"{name}.pkl"),
                )

    def load_from_disk(self, path=None):
        with self._lock:
            target_dir = path if path else self.artifacts_dir
            if not os.path.exists(target_dir):
                return
            for f in os.listdir(target_dir):
                if f.endswith(".pkl"):
                    name = f.replace(".pkl", "")
                    data = joblib.load(os.path.join(target_dir, f))
                    self._models[name] = data["model"]
                    self._versions[name] = data["version"]

    # ------------------------------------------------------------------
    # Object-store persistence (S3 today; local paths / file:// always work)
    # ------------------------------------------------------------------

    @staticmethod
    def _is_s3(uri: str) -> bool:
        return uri.startswith("s3://")

    @staticmethod
    def _local_path(uri: str) -> str:
        """Turn a local URI into a filesystem path (handles file:// on Windows)."""
        if uri.startswith("file://"):
            rest = uri[len("file://") :]
            # file:///abs/path -> /abs/path ; file://C:/x (Windows) -> C:/x
            return rest[1:] if rest.startswith("/") and ":" in rest[:3] else rest
        return uri

    def save_to_store(self, uri: str) -> None:
        """Persist every registered model as ``<uri>/<name>.pkl``.

        ``uri`` may be an ``s3://bucket/prefix`` URL or a local directory
        (optionally ``file://``-prefixed).
        """
        if not uri:
            raise ValueError("save_to_store requires a non-empty URI")
        if self._is_s3(uri):
            self._save_to_s3(uri)
        else:
            local = self._local_path(uri)
            self.save_to_disk(local)
        logger.info("Published %d model artifacts to %s", len(self._models), uri)

    def load_from_store(self, uri: str) -> None:
        """Load model artifacts from ``uri`` into the registry."""
        if not uri:
            raise ValueError("load_from_store requires a non-empty URI")
        if self._is_s3(uri):
            self._load_from_s3(uri)
        else:
            local = self._local_path(uri)
            self.load_from_disk(local)

    def _s3_client_and_parts(self, uri: str):
        try:
            import boto3  # noqa: PLC0415 — optional dependency
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "MODEL_STORE_URI is an s3:// URI but boto3 is not installed"
            ) from exc
        parsed = urlparse(uri)
        bucket = parsed.netloc
        prefix = parsed.path.lstrip("/")
        return boto3.client("s3"), bucket, prefix

    def _save_to_s3(self, uri: str) -> None:
        client, bucket, prefix = self._s3_client_and_parts(uri)
        with tempfile.TemporaryDirectory() as tmp:
            self.save_to_disk(tmp)
            for path in glob.glob(os.path.join(tmp, "*.pkl")):
                key = f"{prefix.rstrip('/')}/{os.path.basename(path)}".lstrip("/")
                client.upload_file(path, bucket, key)

    def _load_from_s3(self, uri: str) -> None:
        client, bucket, prefix = self._s3_client_and_parts(uri)
        resp = client.list_objects_v2(Bucket=bucket, Prefix=prefix)
        contents = resp.get("Contents", [])
        if not contents:
            raise FileNotFoundError(f"No objects under {uri}")
        with tempfile.TemporaryDirectory() as tmp:
            for obj in contents:
                key = obj["Key"]
                if not key.endswith(".pkl"):
                    continue
                dest = os.path.join(tmp, os.path.basename(key))
                client.download_file(bucket, key, dest)
            self.load_from_disk(tmp)
