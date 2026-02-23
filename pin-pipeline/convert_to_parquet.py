#!/usr/bin/env python3
"""
Convert WQP JSON observation files to Parquet for cold storage.
Run after fetch_wqp.py completes.

Usage:
    python convert_to_parquet.py                    # All states
    python convert_to_parquet.py --state MD         # Single state
    python convert_to_parquet.py --source-dir lib/wqp/observations
"""

import json
import sys
import argparse
from pathlib import Path

try:
    import duckdb
except ImportError:
    print("pip install duckdb --break-system-packages")
    sys.exit(1)

def convert_state(state_dir: Path, output_dir: Path):
    """Convert all year JSON files for one state to Parquet."""
    state = state_dir.name
    out_path = output_dir / state
    out_path.mkdir(parents=True, exist_ok=True)

    for json_file in sorted(state_dir.glob("*.json")):
        year = json_file.stem
        parquet_file = out_path / f"{year}.parquet"

        print(f"  {state}/{year}.json -> {parquet_file}")

        with open(json_file) as f:
            data = json.load(f)

        if not data:
            print(f"    Skipping empty file")
            continue

        conn = duckdb.connect()
        conn.execute("""
            COPY (
                SELECT * FROM read_json_auto(?)
            ) TO ? (FORMAT PARQUET, COMPRESSION ZSTD)
        """, [str(json_file), str(parquet_file)])
        conn.close()

        json_size = json_file.stat().st_size / 1024
        pq_size = parquet_file.stat().st_size / 1024
        ratio = json_size / pq_size if pq_size > 0 else 0
        print(f"    {json_size:.0f} KB -> {pq_size:.0f} KB ({ratio:.1f}x)")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", default="lib/wqp/observations")
    parser.add_argument("--output-dir", default="archive/wqp")
    parser.add_argument("--state", default=None)
    args = parser.parse_args()

    source = Path(args.source_dir)
    output = Path(args.output_dir)

    if not source.exists():
        print(f"Source dir not found: {source}")
        sys.exit(1)

    if args.state:
        state_dir = source / args.state.lower()
        if not state_dir.exists():
            print(f"State dir not found: {state_dir}")
            sys.exit(1)
        convert_state(state_dir, output)
    else:
        for state_dir in sorted(source.iterdir()):
            if state_dir.is_dir():
                convert_state(state_dir, output)

    print("\nDone. Parquet files ready for upload to object storage.")

if __name__ == "__main__":
    main()
