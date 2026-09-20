# Model artifacts

`python -m app.ml.train` (run from `backend/`) writes four `.pkl` files here:

| file | class | inference method |
|---|---|---|
| `xgboost_location.pkl` | `CashoutLocationPredictor` | `predict` / `predict_top_k` |
| `rf_risk.pkl` | `RiskLevelClassifier` | `predict_risk` |
| `prophet_temporal.pkl` | `TemporalForecaster` | `forecast` |
| `kmeans_hotspot.pkl` | `HotspotDetector` | `predict_cluster` |

The `*.pkl` files **are committed** (total ~900KB) so `docker compose up
--build` on a fresh clone has real trained models with no S3/MODEL_STORE_URI
setup and no training run required — that was not the case until 2026-09-20:
they were git-ignored, the local fallback directory shipped empty, and every
prediction silently used `heuristic_fallback()` with no trained model ever
loaded on a clean clone. In production, artifacts are produced by the
retrain workflow and published to the model store (`MODEL_STORE_URI`,
MT-09); `PredictionService` loads from the store first, falls back to these
committed files, and only then to the heuristic.

Regenerate with `python -m app.ml.train --production` (needs a seeded DB,
≥20 complaints) or the faster `scripts/train_synthetic_models.py` (~5-10s,
no DB needed) — both build features through the same
`FeatureEngineer.create_feature_matrix()` pipeline `PredictionService` uses
at inference time, so `xgboost_location.pkl`/`rf_risk.pkl` stay compatible
with the live feature schema. Do not hand-build a differently-shaped
feature array for either model outside that pipeline — that mismatch is
exactly what produced "Feature shape mismatch, expected: 4, got 17" in
production before this fix.

## Training data

- **Source:** `app.ml.data_loader.load_training_frame()` reads `complaints`
  (joined against `withdrawal_locations`) from the database.
- **`cluster_id`:** K-Means hotspot cluster of the complaint coordinates,
  fitted on historical withdrawal-location coordinates.
- **`risk_level`:** a documented deterministic rule (amount on a log scale +
  local incident density + hotspot membership) — **not** random. Replace with
  real labels once analysts tag outcomes. See `data_loader.py`.
- `--from-csv <file>` trains from a CSV instead; such fixtures (e.g.
  `tests/fixtures/mini_train.csv`) are **non-production**.
- Minimum rows: `data_loader.MIN_TRAINING_ROWS` (20).
