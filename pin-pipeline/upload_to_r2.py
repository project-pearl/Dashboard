#!/usr/bin/env python3
"""
Upload Parquet archive to Cloudflare R2.

Prerequisites:
    pip install boto3 --break-system-packages

    Set environment variables:
        R2_ACCOUNT_ID=your_account_id
        R2_ACCESS_KEY=your_access_key
        R2_SECRET_KEY=your_secret_key
        R2_BUCKET=pin-archive

Usage:
    python upload_to_r2.py                      # Upload all
    python upload_to_r2.py --state md           # Single state
"""

import os
import sys
import argparse
from pathlib import Path

try:
    import boto3
except ImportError:
    print("pip install boto3 --break-system-packages")
    sys.exit(1)

ARCHIVE_DIR = "archive"
BUCKET = os.environ.get("R2_BUCKET", "pin-archive")

def get_r2_client():
    account_id = os.environ.get("R2_ACCOUNT_ID")
    if not account_id:
        print("Set R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY env vars")
        sys.exit(1)

    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY"],
        aws_secret_access_key=os.environ["R2_SECRET_KEY"],
        region_name="auto",
    )

def upload_directory(client, local_dir: Path, prefix: str = ""):
    """Upload all .parquet files in directory tree."""
    count = 0
    total_mb = 0

    for parquet_file in sorted(local_dir.rglob("*.parquet")):
        key = str(parquet_file.relative_to(local_dir))
        if prefix:
            key = f"{prefix}/{key}"

        size_mb = parquet_file.stat().st_size / (1024 * 1024)
        print(f"  Uploading {key} ({size_mb:.1f} MB)")

        client.upload_file(
            str(parquet_file), BUCKET, key,
            ExtraArgs={"ContentType": "application/octet-stream"}
        )
        count += 1
        total_mb += size_mb

    print(f"\nDone. {count} files ({total_mb:.1f} MB) uploaded to s3://{BUCKET}/")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", help="Upload single state only")
    parser.add_argument("--source", default=ARCHIVE_DIR)
    args = parser.parse_args()

    client = get_r2_client()
    source = Path(args.source)

    if not source.exists():
        print(f"Archive dir not found: {source}")
        sys.exit(1)

    if args.state:
        for source_dir in source.iterdir():
            state_dir = source_dir / args.state.lower()
            if state_dir.exists():
                upload_directory(client, source)
    else:
        upload_directory(client, source)

if __name__ == "__main__":
    main()
