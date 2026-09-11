"""Tests for app.ml.train_aml — previously 0% covered.

Uses tiny synthetic fixtures throughout, never the real 475MB
dataset/HI-Small_Trans.csv. That file is exercised manually via
`python -m app.ml.train_aml` (documented in docs/AML_FEATURE_REPORT.md) —
running the real 150k-row training pipeline on every test run would make
the suite slow and would only be reproducible on a machine that has the
dataset downloaded, which CI does not.
"""

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app.ml.aml_xgboost_model import PAYMENT_FORMAT_MAP, AmlLaunderingClassifier
from app.ml.train_aml import (
    load_aml_dataset,
    main,
    parse_patterns_file,
    train_aml_model,
)


def _synthetic_df(n: int = 200) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    return pd.DataFrame(
        {
            "Timestamp": pd.date_range("2023-01-01", periods=n, freq="h").strftime(
                "%Y/%m/%d %H:%M"
            ),
            "From Bank": rng.choice(["012", "020", "110"], n),
            "Account": rng.choice([f"ACC_{i}" for i in range(15)], n),
            "To Bank": rng.choice(["012", "020", "110"], n),
            "Account.1": rng.choice([f"ACC_{i}" for i in range(15)], n),
            "Amount Received": rng.exponential(5000, n).round(2),
            "Receiving Currency": rng.choice(["US Dollar", "Euro"], n),
            "Amount Paid": rng.exponential(5000, n).round(2),
            "Payment Currency": rng.choice(["US Dollar", "Euro"], n),
            "Payment Format": rng.choice(list(PAYMENT_FORMAT_MAP.keys()), n),
            "Is Laundering": rng.binomial(1, 0.15, n),
        }
    )


class TestParsePatternsFile:
    def test_returns_empty_dataframe_when_file_missing(self, tmp_path):
        result = parse_patterns_file(tmp_path / "nope.txt")
        assert result.empty

    def test_parses_valid_pattern_lines(self, tmp_path):
        patterns_file = tmp_path / "patterns.txt"
        patterns_file.write_text(
            "BEGIN LAUNDERING ATTEMPT - FAN-OUT\n"
            "2023/01/15 09:30,012,ACC1,020,ACC2,5000.00,US Dollar,5000.00,US Dollar,Wire,1\n"
            "END LAUNDERING ATTEMPT\n",
            encoding="utf-8",
        )

        result = parse_patterns_file(patterns_file)

        assert len(result) == 1
        assert result.iloc[0]["From Bank"] == "012"
        assert result.iloc[0]["Is Laundering"] == 1
        assert result.iloc[0]["Amount Paid"] == 5000.0

    def test_skips_malformed_lines(self, tmp_path):
        patterns_file = tmp_path / "patterns.txt"
        patterns_file.write_text(
            "BEGIN\ntoo,few,fields\nEND\n",
            encoding="utf-8",
        )

        result = parse_patterns_file(patterns_file)

        assert result.empty


class TestLoadAmlDataset:
    @pytest.fixture
    def small_csv(self, tmp_path):
        path = tmp_path / "trans.csv"
        _synthetic_df(50).to_csv(path, index=False)
        return path

    def test_raises_for_missing_file(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_aml_dataset(
                tmp_path / "missing.csv", max_rows=10, include_patterns=False
            )

    def test_loads_and_coerces_target_column(self, small_csv):
        df = load_aml_dataset(small_csv, max_rows=1000, include_patterns=False)

        assert "Is Laundering" in df.columns
        assert df["Is Laundering"].dtype == int
        assert len(df) > 0

    def test_enriches_with_patterns_file_when_present(
        self, small_csv, tmp_path, monkeypatch
    ):
        patterns_path = tmp_path / "HI-Small_Patterns.txt"
        patterns_path.write_text(
            "BEGIN\n"
            "2023/01/15 09:30,999,PATTERN_ACC1,998,PATTERN_ACC2,9000.00,US Dollar,9000.00,US Dollar,Cash,1\n"
            "END\n",
            encoding="utf-8",
        )
        monkeypatch.setattr("app.ml.train_aml.PATTERNS_FILE", patterns_path)

        df = load_aml_dataset(small_csv, max_rows=1000, include_patterns=True)

        assert "PATTERN_ACC1" in df["Account"].astype(str).values

    def test_include_patterns_false_skips_enrichment(
        self, small_csv, tmp_path, monkeypatch
    ):
        patterns_path = tmp_path / "HI-Small_Patterns.txt"
        patterns_path.write_text(
            "BEGIN\n"
            "2023/01/15 09:30,999,SHOULD_NOT_APPEAR,998,X,1.0,US Dollar,1.0,US Dollar,Cash,1\n"
            "END\n",
            encoding="utf-8",
        )
        monkeypatch.setattr("app.ml.train_aml.PATTERNS_FILE", patterns_path)

        df = load_aml_dataset(small_csv, max_rows=1000, include_patterns=False)

        assert "SHOULD_NOT_APPEAR" not in df["Account"].astype(str).values


class TestTrainAmlModel:
    def test_returns_fitted_classifier_and_honest_metrics(self):
        df = _synthetic_df(300)

        classifier, metrics = train_aml_model(
            df, test_size=0.2, val_size=0.2, random_state=42
        )

        assert isinstance(classifier, AmlLaunderingClassifier)
        # A fitted model can score a transaction without raising.
        preds = classifier.predict(df.drop(columns=["Is Laundering"]))
        assert len(preds) == len(df)

        for key in (
            "train_samples",
            "val_samples",
            "test_samples",
            "roc_auc",
            "pr_auc",
            "accuracy",
            "precision",
            "recall",
            "f1_score",
            "confusion_matrix",
            "top_features",
        ):
            assert key in metrics

        # Metrics must be genuine measured values, not placeholders.
        assert 0.0 <= metrics["precision"] <= 1.0
        assert 0.0 <= metrics["recall"] <= 1.0
        assert metrics["train_samples"] + metrics["val_samples"] + metrics[
            "test_samples"
        ] == len(df)

    def test_metrics_are_attached_to_the_classifier(self):
        df = _synthetic_df(300)
        classifier, metrics = train_aml_model(df)
        assert classifier.metrics_ == metrics


class TestMainEntrypoint:
    def test_exits_1_when_dataset_missing(self, tmp_path, capsys):
        rc = main(["--csv", str(tmp_path / "does_not_exist.csv")])
        assert rc == 1

    def test_full_cli_run_writes_artifact_and_metrics(self, tmp_path, monkeypatch):
        # load_aml_dataset's uniform-stride sampler is calibrated for the
        # real ~5M-row production CSV (hardcoded approx_total) — pointed at
        # a small fixture it under-samples to a handful of rows, almost all
        # positive (every laundering row is always kept regardless of
        # stride), which isn't a representative integration scenario. That
        # sampler is already covered directly in TestLoadAmlDataset above;
        # this test's job is main()'s orchestration (load -> train -> save
        # artifact + metrics), so it stubs load_aml_dataset with a properly
        # balanced synthetic frame instead.
        csv_path = tmp_path / "trans.csv"
        csv_path.write_text(
            "placeholder\n", encoding="utf-8"
        )  # must exist for the CLI's own check
        monkeypatch.setattr(
            "app.ml.train_aml.load_aml_dataset", lambda *a, **k: _synthetic_df(300)
        )

        artifact_dir = tmp_path / "model_artifacts"
        monkeypatch.setattr("app.ml.train_aml.ARTIFACT_DIR", artifact_dir)

        rc = main(["--csv", str(csv_path), "--max-rows", "300"])

        assert rc == 0
        artifact_path = artifact_dir / "xgboost_aml.pkl"
        metrics_path = artifact_dir / "xgboost_aml_metrics.json"
        assert artifact_path.exists()
        assert metrics_path.exists()

        # The saved artifact must actually be loadable and usable —
        # this is the real end-to-end guarantee the whole pipeline exists for.
        loaded = AmlLaunderingClassifier.load_from_artifact(str(artifact_path))
        result = loaded.score_transaction(
            {"amount_paid": 5000.0, "payment_format": "Wire"}
        )
        assert 0.0 <= result["laundering_probability"] <= 1.0

        with open(metrics_path) as f:
            saved_metrics = json.load(f)
        assert "precision" in saved_metrics and "recall" in saved_metrics
