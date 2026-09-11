"""Unit tests for app.ml.aml_preprocessor — previously 0% covered.

Pure pandas/pyarrow logic, no ML model fitting involved, so these run fast
and are not marked `slow`.
"""

import os

import numpy as np
import pandas as pd
import pytest

from app.ml.aml_preprocessor import (
    CURRENCY_TO_USD,
    USD_TO_INR,
    clean_and_transform_aml_chunk,
    process_aml_dataset,
)


def _raw_chunk(n=3):
    return pd.DataFrame(
        {
            "Timestamp": ["2024/01/15 09:30", "2024/01/20 14:00", "2024/01/21 23:45"][:n],
            "From Bank": [101, 102, 103][:n],
            "Account": ["A1", "A2", "A3"][:n],
            "To Bank": [201, 202, 203][:n],
            "Account.1": ["B1", "B2", "B3"][:n],
            "Amount Received": [1000.0, 2000.0, 3000.0][:n],
            "Receiving Currency": ["US Dollar", "Euro", "Rupee"][:n],
            "Amount Paid": [1000.0, 2000.0, 3000.0][:n],
            "Payment Currency": ["US Dollar", "Euro", "Rupee"][:n],
            "Payment Format": ["Cash", "Credit Card", "Wire"][:n],
            "Is Laundering": [0, 1, 0][:n],
        }
    )


class TestCleanAndTransformAmlChunk:
    def test_renames_columns_to_snake_case(self):
        out = clean_and_transform_aml_chunk(_raw_chunk())
        assert "from_bank" in out.columns
        assert "to_bank" in out.columns
        assert "amount_paid" in out.columns
        assert "Amount Paid" not in out.columns

    def test_builds_globally_unique_node_ids(self):
        out = clean_and_transform_aml_chunk(_raw_chunk())
        assert out.loc[0, "from_node"] == "101_A1"
        assert out.loc[0, "to_node"] == "201_B1"

    def test_extracts_temporal_features(self):
        out = clean_and_transform_aml_chunk(_raw_chunk())
        assert out.loc[0, "hour"] == 9
        # 2024-01-15 is a Monday -> day_of_week 0, not weekend
        assert out.loc[0, "day_of_week"] == 0
        assert out.loc[0, "is_weekend"] == 0
        # 2024-01-21 is a Sunday -> weekend flag set
        assert out.loc[2, "is_weekend"] == 1

    def test_amount_log_and_round_amount_flag(self):
        chunk = _raw_chunk()
        chunk.loc[0, "Amount Paid"] = 5000.0  # round to nearest 1000
        chunk.loc[1, "Amount Paid"] = 4321.0  # not round
        out = clean_and_transform_aml_chunk(chunk)
        assert out.loc[0, "is_round_amount"] == 1
        assert out.loc[1, "is_round_amount"] == 0
        assert out.loc[0, "amount_log"] == pytest.approx(np.log1p(5000.0))

    def test_currency_normalization_to_inr(self):
        out = clean_and_transform_aml_chunk(_raw_chunk())
        expected_usd_row0 = 1000.0 * CURRENCY_TO_USD["US Dollar"] * USD_TO_INR
        assert out.loc[0, "amount_inr"] == pytest.approx(round(expected_usd_row0, 2))

    def test_unknown_currency_defaults_to_usd_factor_one(self):
        chunk = _raw_chunk(1)
        chunk.loc[0, "Payment Currency"] = "Martian Credits"
        out = clean_and_transform_aml_chunk(chunk)
        expected = round(1000.0 * 1.0 * USD_TO_INR, 2)
        assert out.loc[0, "amount_inr"] == pytest.approx(expected)

    def test_include_inr_false_omits_amount_inr_column(self):
        out = clean_and_transform_aml_chunk(_raw_chunk(), include_inr=False)
        assert "amount_inr" not in out.columns

    def test_cashout_format_flag(self):
        out = clean_and_transform_aml_chunk(_raw_chunk())
        # row0 Cash -> cashout, row1 Credit Card -> not, row2 Wire -> cashout
        assert out.loc[0, "is_cashout_format"] == 1
        assert out.loc[1, "is_cashout_format"] == 0
        assert out.loc[2, "is_cashout_format"] == 1

    def test_drops_unneeded_raw_columns(self):
        out = clean_and_transform_aml_chunk(_raw_chunk())
        assert "from_account" not in out.columns
        assert "to_account" not in out.columns
        assert "receiving_currency" not in out.columns

    def test_malformed_timestamp_falls_back_to_coerce(self):
        chunk = _raw_chunk(1)
        chunk.loc[0, "Timestamp"] = "not-a-date"
        out = clean_and_transform_aml_chunk(chunk)
        assert pd.isna(out.loc[0, "timestamp"])


class TestProcessAmlDataset:
    @pytest.fixture
    def sample_csv(self, tmp_path):
        path = tmp_path / "input.csv"
        _raw_chunk(3).to_csv(path, index=False)
        return str(path)

    def test_streams_csv_to_parquet_and_returns_stats(self, sample_csv, tmp_path):
        out_path = str(tmp_path / "out.parquet")

        stats = process_aml_dataset(sample_csv, out_path, chunksize=2)

        assert os.path.exists(out_path)
        assert stats["total_rows"] == 3
        assert stats["laundering_rows"] == 1  # one row has Is Laundering=1
        assert stats["file_size_mb"] >= 0

    def test_respects_max_rows(self, sample_csv, tmp_path):
        out_path = str(tmp_path / "out.parquet")

        stats = process_aml_dataset(sample_csv, out_path, chunksize=2, max_rows=2)

        assert stats["total_rows"] == 2

    def test_writes_sample_csv_when_requested(self, sample_csv, tmp_path):
        out_path = str(tmp_path / "out.parquet")
        sample_path = str(tmp_path / "sample.csv")

        process_aml_dataset(
            sample_csv, out_path, chunksize=2, sample_csv_path=sample_path, sample_size=2
        )

        assert os.path.exists(sample_path)
        sample_df = pd.read_csv(sample_path)
        assert len(sample_df) == 2
