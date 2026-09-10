# Dataset — IBM Transactions for Anti-Money Laundering (AML)

~39 GB across 18 files. **Not stored in git** (`dataset/.gitignore`). This
directory keeps only the reproducibility metadata: `manifest.json` (file list +
sizes + SHA-256), `verify.py`, and `clean_aml_data.py`.

## Source

<https://www.kaggle.com/datasets/ealtman2019/ibm-transactions-for-anti-money-laundering-aml>

See `docs/IBM_AML_DATASET_INTEGRATION.md` for the column mapping and how the AML
graph maps onto the CASHGUARD-AI fraud model.

## Fetch

```bash
# needs a Kaggle API token at ~/.kaggle/kaggle.json
pip install kaggle
kaggle datasets download -d ealtman2019/ibm-transactions-for-anti-money-laundering-aml \
  -p dataset/ --unzip
```

## Verify

```bash
python dataset/verify.py          # checks sizes + SHA-256 against manifest.json
```

`manifest.json` carries SHA-256 for every file ≤ 800 MB (Patterns, all
`*_accounts.csv`, the two `*-Small_Trans.csv`). The four large
`*-Medium/Large_Trans.csv` files (3–17 GB) are listed with size only — record
their hashes once locally with:

```bash
python dataset/verify.py --write
```

## Files

| prefix | meaning |
|---|---|
| `HI-*` | higher illicit ratio |
| `LI-*` | lower illicit ratio |
| `*-Small/Medium/Large` | dataset size tier |
| `*_Trans.csv` | transactions (the bulk) |
| `*_accounts.csv` | account metadata |
| `*_Patterns.txt` | labelled laundering typologies |

## Cleaning

`clean_aml_data.py` streams a raw file into a documented, stable Parquet schema
under `dataset/cleaned/` that `backend/app/ml/data_loader.py` can consume:

```bash
python dataset/clean_aml_data.py                 # HI-Small_Trans.csv -> cleaned/
python dataset/clean_aml_data.py --all           # HI-Small + LI-Small
python dataset/clean_aml_data.py --accounts      # also process *_accounts.csv
```

Output columns (per `clean_aml_data.py`): `timestamp, from_account,
to_account, amount, currency, payment_format, is_laundering` plus the graph
features it derives. Keep this contract stable — changing it means updating
`data_loader.py`.
