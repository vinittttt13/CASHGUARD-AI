#!/usr/bin/env python3
"""Verify (or record) SHA-256 checksums of the IBM AML dataset files.

    python dataset/verify.py            # check local files against manifest.json
    python dataset/verify.py --write    # (re)compute every hash and update manifest.json

Exit code 0 = all present files match; 1 = a mismatch or a missing file that
has a recorded hash.
"""
import argparse
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(HERE, "manifest.json")


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="compute and store all hashes")
    args = ap.parse_args()

    manifest = json.load(open(MANIFEST))
    failures = 0
    for entry in manifest["files"]:
        path = os.path.join(HERE, entry["name"])
        if not os.path.exists(path):
            if entry.get("sha256"):
                print(f"MISSING  {entry['name']}")
                failures += 1
            else:
                print(f"skip     {entry['name']} (not downloaded)")
            continue

        size = os.path.getsize(path)
        if size != entry["bytes"]:
            print(f"SIZE     {entry['name']}: {size} != {entry['bytes']}")
            failures += 1

        if args.write:
            entry["sha256"] = sha256(path)
            print(f"hashed   {entry['name']} {entry['sha256'][:16]}...")
        elif entry.get("sha256"):
            actual = sha256(path)
            if actual != entry["sha256"]:
                print(f"MISMATCH {entry['name']}")
                failures += 1
            else:
                print(f"ok       {entry['name']}")
        else:
            print(f"no-hash  {entry['name']} (run --write to record)")

    if args.write:
        json.dump(manifest, open(MANIFEST, "w"), indent=2)
        print("manifest.json updated")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
