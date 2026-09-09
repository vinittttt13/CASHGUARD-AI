"""
IBM AML Dataset Cleaning & Preprocessing CLI Runner
Follows docs/IBM_AML_DATASET_INTEGRATION.md specifications.

Usage:
  python dataset/clean_aml_data.py                  # Clean HI-Small dataset
  python dataset/clean_aml_data.py --all-small      # Clean both HI-Small and LI-Small
  python dataset/clean_aml_data.py --file <path>    # Clean specific file
  python dataset/clean_aml_data.py --patterns       # Extract laundering patterns
  python dataset/clean_aml_data.py --accounts       # Clean account mapping
"""

import os
import sys
import time
import argparse
import re
from pathlib import Path
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

# Add backend to sys.path for importing preprocessor
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.ml.aml_preprocessor import (
    clean_and_transform_aml_chunk,
    process_aml_dataset,
    CURRENCY_TO_USD,
    USD_TO_INR
)


def clean_accounts_file(input_csv: str, output_parquet: str) -> pd.DataFrame:
    """
    Cleans accounts metadata and generates unified node IDs.
    """
    print(f"\n[Accounts] Cleaning {input_csv} -> {output_parquet}")
    df = pd.read_csv(input_csv)
    df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]
    
    # Create unified node id
    df['node_id'] = df['bank_id'].astype(str) + "_" + df['account_number'].astype(str)
    
    os.makedirs(os.path.dirname(os.path.abspath(output_parquet)), exist_ok=True)
    table = pa.Table.from_pandas(df, preserve_index=False)
    pq.write_table(table, output_parquet, compression='snappy')
    print(f"[Accounts] Processed {len(df):,} accounts. Saved to {output_parquet}")
    return df


def parse_patterns_file(input_txt: str, output_parquet: str, output_csv: str = None) -> pd.DataFrame:
    """
    Parses laundering motif graph topology (*_Patterns.txt) into structured dataframe.
    Extracts pattern type (FAN-OUT, FAN-IN, CYCLE, SCATTER-GATHER) and links.
    """
    print(f"\n[Patterns] Parsing graph patterns from {input_txt}")
    records = []
    current_motif = None
    attempt_id = 0

    motif_start_pattern = re.compile(r"^BEGIN LAUNDERING ATTEMPT - ([^:]+)(?::\s*(.*))?$")
    motif_end_pattern = re.compile(r"^END LAUNDERING ATTEMPT")

    cols = [
        'timestamp', 'from_bank', 'from_account', 'to_bank', 'to_account',
        'amount_received', 'receiving_currency', 'amount_paid',
        'payment_currency', 'payment_format', 'is_laundering'
    ]

    with open(input_txt, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            start_match = motif_start_pattern.match(line)
            if start_match:
                current_motif = start_match.group(1).strip()
                attempt_id += 1
                continue

            if motif_end_pattern.match(line):
                current_motif = None
                continue

            if current_motif and ',' in line:
                parts = [p.strip() for p in line.split(',')]
                if len(parts) >= 11:
                    records.append({
                        'attempt_id': attempt_id,
                        'motif_type': current_motif,
                        'timestamp': parts[0],
                        'from_bank': parts[1],
                        'from_account': parts[2],
                        'to_bank': parts[3],
                        'to_account': parts[4],
                        'from_node': f"{parts[1]}_{parts[2]}",
                        'to_node': f"{parts[3]}_{parts[4]}",
                        'amount_received': float(parts[5]) if parts[5] else 0.0,
                        'receiving_currency': parts[6],
                        'amount_paid': float(parts[7]) if parts[7] else 0.0,
                        'payment_currency': parts[8],
                        'payment_format': parts[9],
                        'is_laundering': int(parts[10]) if parts[10] else 1
                    })

    df = pd.DataFrame(records)
    if not df.empty:
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        usd_factor = df['payment_currency'].map(CURRENCY_TO_USD).fillna(1.0)
        df['amount_inr'] = (df['amount_paid'] * usd_factor * USD_TO_INR).round(2)
        
        os.makedirs(os.path.dirname(os.path.abspath(output_parquet)), exist_ok=True)
        table = pa.Table.from_pandas(df, preserve_index=False)
        pq.write_table(table, output_parquet, compression='snappy')
        print(f"[Patterns] Extracted {len(df):,} pattern hops across {attempt_id} laundering attempts.")
        print(f"[Patterns] Saved to {output_parquet}")
        if output_csv:
            df.to_csv(output_csv, index=False)
            print(f"[Patterns] Saved CSV copy to {output_csv}")
    else:
        print("[Patterns] No pattern rows found.")

    return df


def main():
    parser = argparse.ArgumentParser(description="Clean and preprocess IBM AML dataset per docs/IBM_AML_DATASET_INTEGRATION.md")
    parser.add_argument("--file", type=str, help="Specific raw CSV transaction file to clean")
    parser.add_argument("--out", type=str, help="Specific output Parquet file path")
    parser.add_argument("--chunksize", type=int, default=500_000, help="Chunk size for streaming (default: 500,000)")
    parser.add_argument("--max-rows", type=int, default=None, help="Optional maximum rows to process")
    parser.add_argument("--all-small", action="store_true", help="Process both HI-Small and LI-Small datasets")
    parser.add_argument("--patterns", action="store_true", help="Also extract and parse *_Patterns.txt")
    parser.add_argument("--accounts", action="store_true", help="Also process *_accounts.csv")
    parser.add_argument("--sample-csv", action="store_true", default=True, help="Save a 50,000-row sample CSV for quick inspection and ML training")
    args = parser.parse_args()

    dataset_dir = PROJECT_ROOT / "dataset"
    cleaned_dir = dataset_dir / "cleaned"
    os.makedirs(cleaned_dir, exist_ok=True)

    files_to_process = []

    if args.file:
        in_path = Path(args.file)
        out_name = in_path.stem + "_cleaned.parquet"
        out_path = Path(args.out) if args.out else cleaned_dir / out_name
        files_to_process.append((str(in_path), str(out_path)))
    elif args.all_small:
        files_to_process = [
            (str(dataset_dir / "HI-Small_Trans.csv"), str(cleaned_dir / "HI-Small_Trans_cleaned.parquet")),
            (str(dataset_dir / "LI-Small_Trans.csv"), str(cleaned_dir / "LI-Small_Trans_cleaned.parquet"))
        ]
    else:
        # Default: Process HI-Small_Trans.csv
        files_to_process = [
            (str(dataset_dir / "HI-Small_Trans.csv"), str(cleaned_dir / "HI-Small_Trans_cleaned.parquet"))
        ]

    print("=" * 70)
    print(" CASHGUARD-AI | IBM AML DATASET CLEANING & PREPROCESSING ENGINE")
    print(" Specification: docs/IBM_AML_DATASET_INTEGRATION.md")
    print("=" * 70)

    for in_csv, out_parquet in files_to_process:
        if not os.path.exists(in_csv):
            print(f"Error: Input file {in_csv} does not exist. Skipping.")
            continue

        sample_csv = str(cleaned_dir / (Path(in_csv).stem + "_sample_50k.csv")) if args.sample_csv else None

        stats = process_aml_dataset(
            input_csv_path=in_csv,
            output_parquet_path=out_parquet,
            chunksize=args.chunksize,
            max_rows=args.max_rows,
            sample_csv_path=sample_csv,
            sample_size=50_000
        )
        print("-" * 50)
        print(f"Processed: {stats['input_file']}")
        print(f"Cleaned Output: {stats['output_file']} ({stats['file_size_mb']} MB)")
        print(f"Total Rows: {stats['total_rows']:,}")
        print(f"Laundering Transactions: {stats['laundering_rows']:,} ({stats['laundering_ratio_percent']}%)")
        print(f"Elapsed Time: {stats['duration_seconds']} s")
        print("-" * 50)

    # Process patterns if requested or by default for small
    hi_patterns = dataset_dir / "HI-Small_Patterns.txt"
    if (args.patterns or not args.file) and hi_patterns.exists():
        parse_patterns_file(
            str(hi_patterns),
            str(cleaned_dir / "HI-Small_Patterns_cleaned.parquet"),
            str(cleaned_dir / "HI-Small_Patterns_cleaned.csv")
        )

    # Process accounts if requested or by default for small
    hi_accounts = dataset_dir / "HI-Small_accounts.csv"
    if (args.accounts or not args.file) and hi_accounts.exists():
        clean_accounts_file(
            str(hi_accounts),
            str(cleaned_dir / "HI-Small_accounts_cleaned.parquet")
        )

    print("\n[SUCCESS] AML Data Cleaning Pipeline Completed Successfully!")
    print(f"Artifacts saved in: {cleaned_dir}")


if __name__ == "__main__":
    main()
