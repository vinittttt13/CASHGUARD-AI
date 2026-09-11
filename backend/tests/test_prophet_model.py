"""Unit tests for app.ml.prophet_model.TemporalForecaster — previously 0% covered.

Prophet eagerly loads a compiled CmdStan backend even at plain construction
time (`Prophet(...)` calls `_load_stan_backend` in `__init__`), and CmdStan
is not installed in every environment (see docs/PROJECT_RUN_OBSTACLES.md —
a known, documented, deliberately-not-forced gap, not something to fake
around here). Every test in this file is therefore skipped with a clear
reason when CmdStan isn't available, rather than silently omitted or
fudged to "pass" without exercising real behavior.
"""

import os

import pandas as pd
import pytest

from app.ml.prophet_model import TemporalForecaster


def _cmdstan_available() -> bool:
    try:
        import cmdstanpy

        cmdstanpy.cmdstan_path()
        return True
    except Exception:
        return False


requires_cmdstan = pytest.mark.skipif(
    not _cmdstan_available(),
    reason="CmdStan not installed — Prophet.fit() unavailable in this environment",
)


def _historical_df(n=60):
    dates = pd.date_range("2024-01-01", periods=n, freq="D")
    return pd.DataFrame({"ds": dates, "y": [10 + (i % 7) for i in range(n)]})


@requires_cmdstan
class TestConstruction:
    def test_constructs_with_seasonality_enabled(self):
        forecaster = TemporalForecaster()
        assert forecaster.model is not None

    def test_country_holidays_added_for_india(self):
        forecaster = TemporalForecaster()
        # Prophet stores added holiday country on the model instance.
        assert getattr(forecaster.model, "country_holidays", None) == "IN"

    def test_get_trend_components_reflects_constructor_flags(self):
        forecaster = TemporalForecaster()
        components = forecaster.get_trend_components()
        assert set(components.keys()) == {"yearly", "weekly", "daily"}
        assert components["yearly"] is True
        assert components["weekly"] is True
        assert components["daily"] is True


@pytest.mark.slow
@requires_cmdstan
class TestFittingBehavior:
    def test_train_then_forecast_returns_expected_columns(self):
        forecaster = TemporalForecaster()
        forecaster.train(_historical_df())

        forecast = forecaster.forecast(periods=3)

        assert list(forecast.columns) == ["ds", "yhat", "yhat_lower", "yhat_upper"]
        assert len(forecast) >= 3

    def test_forecast_by_hour_returns_24_rows(self):
        forecaster = TemporalForecaster()
        forecaster.train(_historical_df())

        forecast = forecaster.forecast_by_hour("2024-03-01")

        assert len(forecast) == 24
        assert list(forecast.columns) == ["ds", "yhat", "yhat_lower", "yhat_upper"]

    def test_save_and_load_round_trip(self, tmp_path):
        forecaster = TemporalForecaster()
        forecaster.train(_historical_df())
        path = str(tmp_path / "prophet_temporal.json")

        forecaster.save(path)
        assert os.path.exists(path)

        reloaded = TemporalForecaster()
        reloaded.load(path)
        forecast = reloaded.forecast(periods=1)
        assert not forecast.empty
