# CASHGUARD-AI Remote Training Guide

Train on the full 40GB IBM AML dataset (`HI-Small_Trans.csv` / `HI-Large_Trans.csv`) on a remote GPU workstation, then sync artifacts back.

## 1. Copy dataset
```bash
scp -P 22 /local/HI-Large_Trans.csv user@remote-workstation:/data/
```

## 2. SSH and run
```bash
ssh user@remote-workstation "cd CASHGUARD-AI && docker compose up -d gpu-worker"
python scripts/train_remote_cluster.py --dataset /data/HI-Large_Trans.csv --chunksize 100000 --device cuda --out backend/app/ml/model_artifacts/
```

## 3. Sync artifacts back
```bash
scp -r user@remote-workstation:/data/CASHGUARD-AI/backend/app/ml/model_artifacts/*.pkl ./
```

Notes:
- Uses `chunksize=100000` for memory efficiency.
- `tree_method='hist'`, `device='cuda'` for GPU acceleration.
- Early stopping enabled; artifacts are `.pkl` only (no 40GB dataset copied back).

