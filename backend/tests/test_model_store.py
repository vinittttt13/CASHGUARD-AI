"""ModelRegistry object-store round-trip (local file:// backend) + gate logic."""

import os

import numpy as np
import pytest

from app.ml.model_registry import ModelRegistry
from app.ml.model_validation import ModelValidator
from app.ml.random_forest_model import RiskLevelClassifier


def _fit_rf():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(60, 4))
    y = np.array(["low", "medium", "high", "critical"] * 15)
    m = RiskLevelClassifier()
    m.train(X, y)
    return m


def test_save_and_load_from_store_local(tmp_path):
    store = f"file://{tmp_path.as_posix()}"

    reg = ModelRegistry()
    reg._models.clear()
    reg._versions.clear()
    reg.register("rf_risk", _fit_rf(), "vtest")
    reg.save_to_store(store)

    assert (tmp_path / "rf_risk.pkl").exists()

    reg2 = ModelRegistry()  # singleton, but clear + reload from store
    reg2._models.clear()
    reg2._versions.clear()
    reg2.load_from_store(store)
    assert reg2.get("rf_risk") is not None
    assert reg2.get_version("rf_risk") == "vtest"


def test_load_from_store_missing_raises(tmp_path):
    with pytest.raises((FileNotFoundError, ValueError, OSError)):
        ModelRegistry().load_from_store("")  # empty URI


def test_validator_gate_blocks_bad_model():
    v = ModelValidator(min_accuracy=0.9, min_f1=0.9)
    # Deliberately wrong predictions -> gate must fail.
    res = v.validate("rf_risk", ["low"] * 10, ["high"] * 10)
    assert res["passed"] is False
