# Work-in-progress components

These components are fully implemented but not wired into any route. They were
parked here during the MT-04 dead-code sweep instead of being deleted, because
they look like intended features rather than abandoned code:

- `PredictionForm.tsx` — manual prediction-request form (submit a complaint id /
  free text and call `POST /api/v1/predict`).
- `RiskScoreCard.tsx` — compact risk-score summary card for a prediction.

Wire them into `src/app/dashboard/` (or a new `/predict` route) and move them
back under `components/dashboard/` when adopted. If still unused at the next
cleanup, delete them.

`knip` is configured to ignore this folder (`src/components/_wip/**`).
