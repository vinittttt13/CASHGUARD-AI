# Model artifacts

`python -m app.ml.train` (run from `backend/`) writes four `.pkl` files here:

| file | class | inference method |
|---|---|---|
| `xgboost_location.pkl` | `CashoutLocationPredictor` | `predict` / `predict_top_k` |
| `rf_risk.pkl` | `RiskLevelClassifier` | `predict_risk` |
| `prophet_temporal.pkl` | `TemporalForecaster` | `forecast` |
| `kmeans_hotspot.pkl` | `HotspotDetector` | `predict_cluster` |

The `*.pkl` files are **git-ignored** — only this README and `.gitkeep` are
tracked. Artifacts are produced by the retrain workflow and published to the
model store (`MODEL_STORE_URI`, MT-09); `PredictionService` loads from the
store first and falls back to this directory, then to a heuristic.

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
