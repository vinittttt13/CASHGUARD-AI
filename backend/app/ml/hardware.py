"""
Hardware Acceleration & GPU Diagnostic Engine for CASHGUARD-AI.
Detects NVIDIA GPUs, CUDA cores, AMD Radeon GPUs, ROCm support, and CPU topologies.
Configures optimal XGBoost device acceleration ('cuda' vs 'cpu' OpenMP).
"""

from __future__ import annotations

import json
import logging
import os
import platform
import shutil
import subprocess
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Known NVIDIA compute capability to CUDA cores per Streaming Multiprocessor (SM)
CORES_PER_SM_MAP: Dict[Tuple[int, int], int] = {
    (2, 0): 32,
    (2, 1): 48,
    (3, 0): 192,
    (3, 5): 192,
    (3, 7): 192,
    (5, 0): 128,
    (5, 2): 128,
    (6, 0): 64,
    (6, 1): 128,
    (6, 2): 128,
    (7, 0): 64,
    (7, 5): 64,  # Turing (GTX 1650, RTX 20xx)
    (8, 0): 64,  # Ampere A100
    (8, 6): 128, # Ampere (RTX 30xx)
    (8, 7): 128,
    (8, 9): 128, # Ada Lovelace (RTX 40xx)
    (9, 0): 128, # Hopper H100
    (10, 0): 128,# Blackwell B200
}

# Known CUDA core lookup for standard GPUs when direct SM count isn't returned by driver
KNOWN_GPU_CUDA_CORES: Dict[str, int] = {
    "GTX 1650": 896,
    "GTX 1650 SUPER": 1280,
    "GTX 1650 TI": 1024,
    "GTX 1660": 1408,
    "GTX 1660 TI": 1536,
    "GTX 1660 SUPER": 1408,
    "RTX 2060": 1920,
    "RTX 2070": 2304,
    "RTX 2080": 2944,
    "RTX 2080 TI": 4352,
    "RTX 3050": 2048,
    "RTX 3060": 3584,
    "RTX 3060 TI": 4864,
    "RTX 3070": 5888,
    "RTX 3070 TI": 6144,
    "RTX 3080": 8704,
    "RTX 3080 TI": 10240,
    "RTX 3090": 10496,
    "RTX 4060": 3072,
    "RTX 4070": 5888,
    "RTX 4080": 9728,
    "RTX 4090": 16384,
    "TESLA T4": 2560,
    "TESLA V100": 5120,
    "A100": 6912,
    "H100": 16896,
}


def _estimate_cuda_cores(name: str, compute_cap_str: Optional[str] = None) -> Optional[int]:
    """Estimate CUDA cores based on GPU model name and compute capability."""
    clean_name = name.upper().replace("NVIDIA", "").replace("GEFORCE", "").strip()
    for model, cores in KNOWN_GPU_CUDA_CORES.items():
        if model in clean_name:
            return cores
    return None


def detect_nvidia_gpus() -> List[Dict[str, Any]]:
    """Detect NVIDIA GPUs, driver versions, VRAM, and compute capabilities."""
    gpus: List[Dict[str, Any]] = []

    # 1. Try PyTorch first if installed
    try:
        import torch
        if torch.cuda.is_available():
            for i in range(torch.cuda.device_count()):
                props = torch.cuda.get_device_properties(i)
                cap = (props.major, props.minor)
                cores_per_sm = CORES_PER_SM_MAP.get(cap, 64)
                sm_count = getattr(props, "multi_processor_count", None)
                cuda_cores = sm_count * cores_per_sm if sm_count else _estimate_cuda_cores(props.name)

                gpus.append({
                    "index": i,
                    "name": props.name,
                    "vendor": "NVIDIA",
                    "vram_mb": round(props.total_memory / (1024 * 1024)),
                    "compute_capability": f"{props.major}.{props.minor}",
                    "cuda_cores": cuda_cores,
                    "multi_processor_count": sm_count,
                    "cuda_available": True,
                })
            if gpus:
                return gpus
    except Exception:
        pass

    # 2. Try nvidia-smi CLI
    if shutil.which("nvidia-smi"):
        try:
            cmd = [
                "nvidia-smi",
                "--query-gpu=index,name,driver_version,memory.total,memory.free,compute_cap",
                "--format=csv,noheader,nounits"
            ]
            out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
            for line in out.strip().splitlines():
                if not line.strip():
                    continue
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 6:
                    idx, name, driver, total_mem, free_mem, compute_cap = parts[:6]
                    cuda_cores = _estimate_cuda_cores(name, compute_cap)
                    gpus.append({
                        "index": int(idx),
                        "name": name,
                        "vendor": "NVIDIA",
                        "driver_version": driver,
                        "vram_mb": int(float(total_mem)),
                        "vram_free_mb": int(float(free_mem)),
                        "compute_capability": compute_cap,
                        "cuda_cores": cuda_cores,
                        "cuda_available": True,
                    })
        except Exception as exc:
            logger.debug("nvidia-smi failed: %s", exc)

    return gpus


def detect_amd_gpus() -> List[Dict[str, Any]]:
    """Detect AMD Radeon GPUs and ROCm availability."""
    gpus: List[Dict[str, Any]] = []

    # 1. Linux rocm-smi
    if shutil.which("rocm-smi"):
        try:
            cmd = ["rocm-smi", "--showid", "--showproductname", "--json"]
            out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
            data = json.loads(out)
            for k, v in data.items():
                gpus.append({
                    "name": v.get("Card series") or v.get("Device Name") or "AMD Radeon GPU",
                    "vendor": "AMD",
                    "rocm_available": True,
                })
        except Exception:
            pass

    # 2. Windows WMI for AMD Graphics
    if platform.system() == "Windows":
        try:
            cmd = ["powershell", "-Command", "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion | ConvertTo-Json"]
            out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
            data = json.loads(out)
            items = data if isinstance(data, list) else [data]
            for it in items:
                name = str(it.get("Name") or "")
                if "AMD" in name.upper() or "RADEON" in name.upper():
                    ram_bytes = it.get("AdapterRAM") or 0
                    gpus.append({
                        "name": name,
                        "vendor": "AMD",
                        "driver_version": it.get("DriverVersion"),
                        "vram_mb": round(ram_bytes / (1024 * 1024)) if ram_bytes > 0 else 1024,
                        "rocm_available": False,  # Windows ROCm is rarely enabled by default
                    })
        except Exception:
            pass

    # 3. Linux /sys/class/drm fallback
    if platform.system() == "Linux" and not gpus:
        try:
            cmd = ["lspci"]
            out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
            for line in out.splitlines():
                if ("VGA" in line or "3D" in line or "Display" in line) and ("AMD" in line or "Radeon" in line or "ATI" in line):
                    gpus.append({
                        "name": line.split(":")[-1].strip(),
                        "vendor": "AMD",
                        "rocm_available": os.path.exists("/dev/kfd"),
                    })
        except Exception:
            pass

    return gpus


def detect_hardware() -> Dict[str, Any]:
    """
    Comprehensive hardware acceleration audit.
    Probes NVIDIA, AMD, CPU topology, and returns optimal XGBoost hyperparameters.
    """
    nvidia_gpus = detect_nvidia_gpus()
    amd_gpus = detect_amd_gpus()
    all_gpus = nvidia_gpus + amd_gpus

    # If on Windows and nvidia-smi wasn't in PATH, check WMI for NVIDIA as well
    if platform.system() == "Windows" and not nvidia_gpus:
        try:
            cmd = ["powershell", "-Command", "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion | ConvertTo-Json"]
            out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
            data = json.loads(out)
            items = data if isinstance(data, list) else [data]
            for it in items:
                name = str(it.get("Name") or "")
                if "NVIDIA" in name.upper() or "GEFORCE" in name.upper():
                    ram_bytes = it.get("AdapterRAM") or 0
                    nvidia_gpus.append({
                        "name": name,
                        "vendor": "NVIDIA",
                        "driver_version": it.get("DriverVersion"),
                        "vram_mb": round(ram_bytes / (1024 * 1024)) if ram_bytes > 0 else 4096,
                        "cuda_cores": _estimate_cuda_cores(name),
                        "cuda_available": True,
                    })
            all_gpus = nvidia_gpus + amd_gpus
        except Exception:
            pass

    has_nvidia = len(nvidia_gpus) > 0
    has_amd = len(amd_gpus) > 0
    cuda_available = any(g.get("cuda_available") for g in nvidia_gpus)
    rocm_available = any(g.get("rocm_available") for g in amd_gpus)

    # CPU topology
    cpu_count = os.cpu_count() or 4
    system_os = f"{platform.system()} {platform.release()} ({platform.machine()})"

    # Test if installed XGBoost can actually run with device="cuda"
    xgboost_device = "cpu"
    xgboost_tree_method = "hist"
    if cuda_available:
        try:
            import xgboost as xgb
            import numpy as np
            # Quick 1-iteration probe on tiny matrix
            probe = xgb.XGBClassifier(n_estimators=1, max_depth=1, device="cuda")
            probe.fit(np.array([[0.0], [1.0]]), np.array([0, 1]))
            xgboost_device = "cuda"
        except Exception:
            xgboost_device = "cpu"

    from pathlib import Path
    artifacts_dir = Path(__file__).resolve().parent / "model_artifacts"
    profile_path = artifacts_dir / "hardware_profile.json"

    # If GPUs found, save profile for container access
    if all_gpus:
        try:
            artifacts_dir.mkdir(parents=True, exist_ok=True)
            with open(profile_path, "w", encoding="utf-8") as f:
                json.dump({
                    "os": system_os,
                    "cpu_count": cpu_count,
                    "gpus": all_gpus,
                    "has_nvidia": has_nvidia,
                    "has_amd": has_amd,
                    "cuda_available": cuda_available,
                    "rocm_available": rocm_available,
                    "primary_gpu": all_gpus[0]["name"] if all_gpus else None,
                }, f, indent=2)
        except Exception:
            pass
    elif profile_path.exists():
        # Running inside container without GPU passthrough: read host profile
        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                saved = json.load(f)
                all_gpus = saved.get("gpus", [])
                has_nvidia = saved.get("has_nvidia", False)
                has_amd = saved.get("has_amd", False)
                cuda_available = saved.get("cuda_available", False)
                rocm_available = saved.get("rocm_available", False)
        except Exception:
            pass

    return {
        "os": system_os,
        "cpu_count": cpu_count,
        "gpus": all_gpus,
        "has_nvidia": has_nvidia,
        "has_amd": has_amd,
        "cuda_available": cuda_available,
        "rocm_available": rocm_available,
        "primary_gpu": all_gpus[0]["name"] if all_gpus else None,
        "xgboost_device": xgboost_device,
        "xgboost_tree_method": xgboost_tree_method,
        "n_jobs": cpu_count,
    }


def print_hardware_summary(info: Optional[Dict[str, Any]] = None) -> None:
    """Print an informative hardware diagnostic summary to the console."""
    data = info or detect_hardware()
    print("=" * 72)
    print(" [*] CASHGUARD-AI HARDWARE ACCELERATION DIAGNOSTIC")
    print("=" * 72)
    print(f" OS: {data['os']}")
    print(f" CPU: {data['cpu_count']} Logical Cores (OpenMP multi-threading enabled)")

    gpus = data.get("gpus", [])
    if gpus:
        print(f" GPUs Detected: {len(gpus)}")
        for idx, g in enumerate(gpus):
            vendor = g.get("vendor", "Unknown")
            name = g.get("name", "Generic GPU")
            vram = f"{g['vram_mb']:,} MB" if "vram_mb" in g else "N/A"
            cores_info = ""
            if "cuda_cores" in g and g["cuda_cores"]:
                cores_info = f" | ~{g['cuda_cores']:,} CUDA Cores"
            elif "compute_capability" in g:
                cores_info = f" | Compute {g['compute_capability']}"

            driver = f" (Driver {g['driver_version']})" if "driver_version" in g else ""
            print(f"  [{idx}] {name}{driver}")
            print(f"      Vendor: {vendor} | VRAM: {vram}{cores_info}")
    else:
        print(" GPUs Detected: None (or running in standard container without GPU passthrough)")

    xgb_dev = data.get("xgboost_device", "cpu").upper()
    if xgb_dev == "CUDA":
        print(f" ML Acceleration: NVIDIA CUDA (tree_method='hist', device='cuda')")
    else:
        print(f" ML Acceleration: Multi-threaded CPU OpenMP ({data['cpu_count']} workers)")
    print("=" * 72)
