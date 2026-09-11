"""
IBM AML Dataset Streaming & Feature Engineering Pipeline for CASHGUARD-AI
Implements specifications from docs/IBM_AML_DATASET_INTEGRATION.md.
Handles large-scale CSV data efficiently using chunked streaming and snappy-compressed Parquet.
"""

import logging
import os
import sys
import time
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("aml_preprocessor")

# Exchange rates to USD
CURRENCY_TO_USD = {
    "US Dollar": 1.0,
    "Euro": 1.08,
    "UK Pound": 1.28,
    "Rupee": 0.012,
    "Yen": 0.0067,
    "Australian Dollar": 0.65,
    "Canadian Dollar": 0.74,
    "Mexican Peso": 0.055,
    "Bitcoin": 60000.0,
    "Yuan": 0.14,
    "Swiss Franc": 1.13,
    "Brazil Real": 0.18,
    "Saudi Riyal": 0.27,
    "Shekel": 0.27,
}
USD_TO_INR = 83.5


def clean_and_transform_aml_chunk(
    df: pd.DataFrame, include_inr: bool = True
) -> pd.DataFrame:
    """
    Cleans raw IBM AML transaction chunk and extracts engineered features
    per section 4 & 5 of docs/IBM_AML_DATASET_INTEGRATION.md.
    """
    # 1. Rename columns to standardized snake_case
    rename_map = {
        "Timestamp": "timestamp",
        "From Bank": "from_bank",
        "Account": "from_account",
        "To Bank": "to_bank",
        "Account.1": "to_account",
        "Amount Received": "amount_received",
        "Receiving Currency": "receiving_currency",
        "Amount Paid": "amount_paid",
        "Payment Currency": "payment_currency",
        "Payment Format": "payment_format",
        "Is Laundering": "is_laundering",
    }
    df = df.rename(columns=rename_map)

    # 2. Create globally unique account identifiers
    df["from_node"] = df["from_bank"].astype(str) + "_" + df["from_account"].astype(str)
    df["to_node"] = df["to_bank"].astype(str) + "_" + df["to_account"].astype(str)

    # 3. Parse timestamp & extract temporal features
    # Explicit format is order of magnitude faster; fallback to coerce
    try:
        df["timestamp"] = pd.to_datetime(df["timestamp"], format="%Y/%m/%d %H:%M")
    except Exception:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)

    # 4. Financial features
    df["amount_log"] = np.log1p(df["amount_paid"])
    df["is_round_amount"] = (df["amount_paid"] % 1000 == 0).astype(int)

    # Currency normalization to INR standard (Section 1.2 & 4.1)
    if include_inr and "payment_currency" in df.columns:
        usd_factor = df["payment_currency"].map(CURRENCY_TO_USD).fillna(1.0)
        df["amount_inr"] = (df["amount_paid"] * usd_factor * USD_TO_INR).round(2)

    # 5. Flag cash-out potential payment formats (Cash, Cheque, Wire)
    cashout_formats = ["Cash", "Cheque", "Wire"]
    df["is_cashout_format"] = df["payment_format"].isin(cashout_formats).astype(int)

    # 6. Drop unneeded raw fields to minimize memory
    cols_to_keep = [
        "timestamp",
        "from_node",
        "to_node",
        "from_bank",
        "to_bank",
        "amount_paid",
        "amount_log",
        "payment_format",
        "is_cashout_format",
        "hour",
        "day_of_week",
        "is_weekend",
        "is_round_amount",
        "is_laundering",
    ]
    if include_inr and "amount_inr" in df.columns:
        cols_to_keep.insert(6, "amount_inr")

    return df[cols_to_keep]


def process_aml_dataset(
    input_csv_path: str,
    output_parquet_path: str,
    chunksize: int = 500_000,
    max_rows: Optional[int] = None,
    sample_csv_path: Optional[str] = None,
    sample_size: int = 50_000,
) -> Dict:
    """
    Streams CSV in chunks and writes to a unified partitioned Parquet dataset
    using snappy compression as specified in docs/IBM_AML_DATASET_INTEGRATION.md.
    """
    start_time = time.time()
    logger.info(f"Starting ETL stream on: {input_csv_path}")
    os.makedirs(os.path.dirname(os.path.abspath(output_parquet_path)), exist_ok=True)

    writer = None
    total_rows = 0
    total_laundering = 0
    sample_collected: List[pd.DataFrame] = []
    sample_remaining = sample_size if sample_csv_path else 0

    try:
        for i, chunk in enumerate(pd.read_csv(input_csv_path, chunksize=chunksize)):
            if max_rows and total_rows >= max_rows:
                logger.info(f"Reached max rows limit: {max_rows}")
                break

            chunk_len = len(chunk)
            if max_rows and (total_rows + chunk_len) > max_rows:
                chunk = chunk.iloc[: (max_rows - total_rows)]
                chunk_len = len(chunk)

            transformed = clean_and_transform_aml_chunk(chunk)
            total_rows += chunk_len
            laundering_count = int(transformed["is_laundering"].sum())
            total_laundering += laundering_count

            # Collect sample if requested
            if sample_remaining > 0:
                take_n = min(sample_remaining, len(transformed))
                sample_collected.append(transformed.iloc[:take_n])
                sample_remaining -= take_n

            # Convert to PyArrow Table and append to Parquet
            table = pa.Table.from_pandas(transformed, preserve_index=False)
            if writer is None:
                writer = pq.ParquetWriter(
                    output_parquet_path, table.schema, compression="snappy"
                )
            writer.write_table(table)

            elapsed = time.time() - start_time
            rate = total_rows / elapsed if elapsed > 0 else 0
            logger.info(
                f"Chunk {i + 1:3d} | Rows: {total_rows:10,d} | "
                f"Laundering: {total_laundering:6,d} ({total_laundering/max(1, total_rows)*100:5.2f}%) | "
                f"Speed: {rate:8.0f} rows/s"
            )

    finally:
        if writer:
            writer.close()

    elapsed = time.time() - start_time
    file_size_mb = os.path.getsize(output_parquet_path) / (1024 * 1024)

    # Save sample CSV if requested
    if sample_csv_path and sample_collected:
        os.makedirs(os.path.dirname(os.path.abspath(sample_csv_path)), exist_ok=True)
        pd.concat(sample_collected, ignore_index=True).to_csv(
            sample_csv_path, index=False
        )
        logger.info(f"Saved sample CSV ({sample_size} rows) to: {sample_csv_path}")

    stats = {
        "input_file": input_csv_path,
        "output_file": output_parquet_path,
        "total_rows": total_rows,
        "laundering_rows": total_laundering,
        "laundering_ratio_percent": round(
            total_laundering / max(1, total_rows) * 100, 4
        ),
        "duration_seconds": round(elapsed, 2),
        "file_size_mb": round(file_size_mb, 2),
    }

    logger.info(
        f"ETL Complete! Cleaned {total_rows:,} rows in {elapsed:.1f}s. "
        f"Saved to: {output_parquet_path} ({file_size_mb:.2f} MB)"
    )
    return stats
