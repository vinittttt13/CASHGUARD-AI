"""End-to-end smoke test for the training entrypoint.

Marked `slow` — it fits real XGBoost/RF/KMeans (and Prophet where available).
Run with:  pytest -m slow
"""

import os

import pytest

pytestmark = pytest.mark.slow

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "mini_train.csv")
CORE_ARTIFACTS = ("xgboost_location", "rf_risk", "kmeans_hotspot")


@pytest.fixture
def clean_artifacts_dir():
    from app.ml import train

    art_dir = os.path.join(os.path.dirname(train.__file__), "model_artifacts")
    before = {f for f in os.listdir(art_dir) if f.endswith(".pkl")}
    yield art_dir
    for f in os.listdir(art_dir):
        if f.endswith(".pkl") and f not in before:
            os.remove(os.path.join(art_dir, f))


def test_train_from_csv_writes_and_loads_artifacts(clean_artifacts_dir):
    from app.ml.train import main
    from app.ml.model_registry import ModelRegistry

    rc = main(["--from-csv", FIXTURE])
    assert rc == 0

    for name in CORE_ARTIFACTS:
        assert os.path.exists(os.path.join(clean_artifacts_dir, f"{name}.pkl")), name

    # Prophet needs a working Stan backend; skip that assertion if unavailable
    # in this environment (CI/Linux has it).
    prophet_pkl = os.path.join(clean_artifacts_dir, "prophet_temporal.pkl")
    prophet_present = os.path.exists(prophet_pkl)

    registry = ModelRegistry()
    registry.load_from_disk(clean_artifacts_dir)
    for name in CORE_ARTIFACTS:
        model = registry.get(name)
        assert model is not None
        assert any(
            callable(getattr(model, m, None))
            for m in ("predict", "predict_risk", "predict_cluster", "predict_top_k")
        )

    if prophet_present:
        assert registry.get("prophet_temporal") is not None
