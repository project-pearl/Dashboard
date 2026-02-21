#!/usr/bin/env python3
"""
PIN Orchestrator — runs the full pipeline: health → fetch → stale → output.

Usage:
  python run.py --from 2024-01-01
  python run.py --from 2024-01-01 --states MD,FL,CA
  python run.py --from 2024-01-01 --all-states
  python run.py --from 2024-01-01 --dry-run
  python run.py --health-only
"""

import argparse
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

DIR = Path(__file__).parent
PYTHON = sys.executable


def run_step(name, cmd):
    """Run a pipeline step, stream output, return success bool."""
    print(f"\n{'='*60}")
    print(f"  STEP: {name}")
    print(f"  CMD:  {' '.join(cmd)}")
    print(f"{'='*60}\n")

    start = time.time()
    result = subprocess.run(cmd, cwd=str(DIR))
    elapsed = time.time() - start

    if result.returncode == 0:
        print(f"\n  ✅ {name} completed in {elapsed:.1f}s")
    else:
        print(f"\n  ❌ {name} failed (exit code {result.returncode}) after {elapsed:.1f}s")

    return result.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="PIN Pipeline Orchestrator")
    parser.add_argument("--from", dest="start_date", default="2024-01-01",
                       help="Start date YYYY-MM-DD (default: 2024-01-01)")
    parser.add_argument("--all-states", action="store_true",
                       help="Fetch WQP for all 56 states/territories")
    parser.add_argument("--states", help="Comma-separated state abbreviations")
    parser.add_argument("--dry-run", action="store_true",
                       help="Show what would be fetched without pulling data")
    parser.add_argument("--health-only", action="store_true",
                       help="Only run health check")
    parser.add_argument("--skip-health", action="store_true",
                       help="Skip health check, go straight to fetch")
    parser.add_argument("--target", default="../lib/pin",
                       help="Target directory for .ts output (default: ../lib/pin)")
    parser.add_argument("--fast", action="store_true",
                       help="Fast health check (HEAD-only)")
    args = parser.parse_args()

    start_time = datetime.now()
    print(f"\n  PIN Pipeline — started {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Data from: {args.start_date}")
    if args.dry_run:
        print("  Mode: DRY RUN")
    print()

    steps_run = 0
    steps_ok = 0

    # ── Step 1: Health Check ──
    if not args.skip_health:
        health_cmd = [PYTHON, "health.py"]
        if args.fast:
            health_cmd.append("--fast")
        steps_run += 1
        if run_step("Health Check", health_cmd):
            steps_ok += 1
        else:
            print("\n  ⚠ Health check had issues, continuing anyway...")

    if args.health_only:
        print(f"\n  Done (health-only mode)")
        return

    # ── Step 2: Fetch ──
    fetch_cmd = [PYTHON, "fetch.py", "--from", args.start_date]
    if args.all_states:
        fetch_cmd.append("--all-states")
    elif args.states:
        fetch_cmd.extend(["--states", args.states])
    else:
        fetch_cmd.append("--segment")
        fetch_cmd.append("federal")
    if args.dry_run:
        fetch_cmd.append("--dry-run")

    steps_run += 1
    if run_step("Data Fetch", fetch_cmd):
        steps_ok += 1

    # ── Step 3: Staleness Report ──
    steps_run += 1
    if run_step("Staleness Report", [PYTHON, "stale.py", "--report"]):
        steps_ok += 1

    # ── Step 4: Generate .ts Files ──
    if not args.dry_run:
        output_cmd = [PYTHON, "output.py", "--target", args.target]
        steps_run += 1
        if run_step("Output Generation", output_cmd):
            steps_ok += 1

    # ── Summary ──
    elapsed = (datetime.now() - start_time).total_seconds()
    print(f"\n{'='*60}")
    print(f"  PIN Pipeline Complete")
    print(f"  Steps: {steps_ok}/{steps_run} succeeded")
    print(f"  Elapsed: {elapsed:.0f}s ({elapsed/60:.1f} min)")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
