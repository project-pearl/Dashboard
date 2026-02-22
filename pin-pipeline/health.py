#!/usr/bin/env python3
"""
PIN Health Checker — probes all registered endpoints, updates registry status.
Run daily via cron or manually before fetch runs.

Exponential backoff for dead sources:
  LIVE:              check every run (5 min default)
  DEGRADED (1-3):    check every 15 min
  DEAD (4+):         check every 60 min
  DEAD 24+ hours:    check every 6 hours
  DEAD 7+ days:      check once daily

Usage:
  python health.py              # Full check (GET, 15s timeout)
  python health.py --fast       # HEAD-only, 5s timeout
  python health.py --source wqp-portal   # Single source
  python health.py --wqp        # Check all 56 WQP state endpoints
  python health.py --force      # Ignore backoff, check everything
"""

import argparse
import json
import os
import sys
import time
import requests
from datetime import datetime, timedelta
from pathlib import Path

# Fix Windows console encoding for unicode output
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

DIR = Path(__file__).parent
REGISTRY = DIR / "registry.json"

# ── Backoff schedule ─────────────────────────────────────────────────────────

BASE_INTERVAL_MIN = 5        # live sources
DEGRADED_INTERVAL_MIN = 15   # 1-3 consecutive failures
DEAD_INTERVAL_MIN = 60       # 4+ consecutive failures
DEAD_24H_INTERVAL_MIN = 360  # dead for 24+ hours
DEAD_7D_INTERVAL_MIN = 1440  # dead for 7+ days
MAX_BACKOFF_MIN = 1440       # cap at 24 hours


def compute_backoff(src):
    """Compute the next check interval in minutes based on error history."""
    error_count = src.get("error_count", 0)
    if error_count == 0:
        return BASE_INTERVAL_MIN

    # Check how long the source has been dead
    last_checked = src.get("last_checked")
    first_failure = src.get("first_failure")
    if first_failure:
        try:
            down_duration = datetime.utcnow() - datetime.fromisoformat(first_failure.replace("Z", "+00:00")).replace(tzinfo=None)
            if down_duration > timedelta(days=7):
                return DEAD_7D_INTERVAL_MIN
            if down_duration > timedelta(hours=24):
                return DEAD_24H_INTERVAL_MIN
        except (ValueError, TypeError):
            pass

    if error_count >= 4:
        return DEAD_INTERVAL_MIN
    return DEGRADED_INTERVAL_MIN


def should_skip(src, force=False):
    """Check if this source should be skipped based on backoff schedule.
    Returns (skip: bool, reason: str | None)."""
    if force:
        return False, None

    next_check = src.get("next_check_after")
    if not next_check:
        return False, None

    try:
        next_dt = datetime.fromisoformat(next_check.replace("Z", "+00:00")).replace(tzinfo=None)
        now = datetime.utcnow()
        if now < next_dt:
            remaining = next_dt - now
            mins = int(remaining.total_seconds() / 60)
            return True, f"next check in {mins}m (backoff {src.get('backoff_minutes', '?')}m)"
    except (ValueError, TypeError):
        pass

    return False, None


def update_backoff_fields(src, status):
    """Update backoff tracking fields after a probe."""
    now = datetime.utcnow().isoformat() + "Z"

    if status == "live":
        src["error_count"] = 0
        src["backoff_minutes"] = BASE_INTERVAL_MIN
        src["first_failure"] = None
        next_check = datetime.utcnow() + timedelta(minutes=BASE_INTERVAL_MIN)
    else:
        src["error_count"] = src.get("error_count", 0) + 1
        # Track when failures started
        if not src.get("first_failure"):
            src["first_failure"] = now
        backoff = compute_backoff(src)
        src["backoff_minutes"] = backoff
        next_check = datetime.utcnow() + timedelta(minutes=backoff)

    src["next_check_after"] = next_check.isoformat() + "Z"
    src["last_checked"] = now


def load_registry():
    with open(REGISTRY) as f:
        return json.load(f)


def save_registry(reg):
    reg["meta"]["updated"] = datetime.utcnow().isoformat() + "Z"
    with open(REGISTRY, "w") as f:
        json.dump(reg, f, indent=2)
    print(f"\n  Registry saved → {REGISTRY.name}")


def probe(url, fast=False):
    """Probe a URL. Returns (status, latency_ms, error)."""
    timeout = 5 if fast else 15
    try:
        if fast:
            r = requests.head(url, timeout=timeout, allow_redirects=True)
        else:
            r = requests.get(url, timeout=timeout, allow_redirects=True, stream=True)
            r.close()
        latency = r.elapsed.total_seconds() * 1000
        if r.status_code < 300:
            return "live", latency, None
        elif r.status_code < 500:
            return "degraded", latency, f"HTTP {r.status_code}"
        else:
            return "dead", latency, f"HTTP {r.status_code}"
    except requests.exceptions.Timeout:
        return "degraded", None, "Timeout"
    except requests.exceptions.ConnectionError as e:
        return "dead", None, str(e)[:120]
    except Exception as e:
        return "dead", None, str(e)[:120]


def check_source(src, fast=False):
    """Probe a source dict (must have 'probe_url' or 'url'). Mutates src in place."""
    if src.get("status") == "gated":
        return "gated", None, "Requires auth"

    url = src.get("probe_url") or src["url"]
    status, latency, error = probe(url, fast=fast)
    update_backoff_fields(src, status)
    src["status"] = status
    return status, latency, error


def print_result(label, status, latency, error, old_status=None):
    lat = f"{latency:.0f}ms" if latency else "?"
    if status == "live":
        icon = "✅" if old_status == "live" else "🔄"
        print(f"  {icon}  {label:35s}  live ({lat})")
    elif status == "degraded":
        print(f"  ⚠️   {label:35s}  degraded — {error}")
    elif status == "gated":
        print(f"  ⏭   {label:35s}  gated (requires auth)")
    else:
        print(f"  ❌  {label:35s}  dead — {error}")


def print_skip(label, reason):
    print(f"  ⏩  {label:35s}  skipped — {reason}")


def main():
    parser = argparse.ArgumentParser(description="PIN Health Checker")
    parser.add_argument("--fast", action="store_true", help="HEAD-only, 5s timeout")
    parser.add_argument("--source", help="Check a single source by ID")
    parser.add_argument("--wqp", action="store_true", help="Check all 56 WQP state endpoints")
    parser.add_argument("--force", action="store_true", help="Ignore backoff, check everything")
    args = parser.parse_args()

    reg = load_registry()
    counts = {"live": 0, "degraded": 0, "dead": 0, "gated": 0, "skipped": 0}

    # ── Federal / state / NOAA sources ──
    sources = reg["sources"]
    if args.source:
        sources = [s for s in sources if s["id"] == args.source]
        if not sources:
            print(f"  Source '{args.source}' not found in registry")
            sys.exit(1)

    if not args.wqp or args.source:
        print("\n  ── Federal / State / NOAA Sources ──\n")
        for src in sources:
            old = src.get("status")

            # Backoff check
            skip, reason = should_skip(src, force=args.force)
            if skip:
                counts["skipped"] += 1
                print_skip(src["id"], reason)
                continue

            status, latency, error = check_source(src, fast=args.fast)
            counts[status] = counts.get(status, 0) + 1
            print_result(src["id"], status, latency, error, old)
            time.sleep(0.3)

    # ── WQP per-state endpoints ──
    if args.wqp or (not args.source):
        wqp = reg.get("wqp_states", {})
        if wqp:
            print(f"\n  ── WQP State Endpoints ({len(wqp)}) ──\n")
            for abbr, st in sorted(wqp.items()):
                # Backoff check
                skip, reason = should_skip(st, force=args.force)
                if skip:
                    counts["skipped"] += 1
                    print_skip(f"wqp-{abbr} ({st['name']})", reason)
                    continue

                url = f"https://www.waterqualitydata.us/data/Result/search?statecode=US:{st['fips']}&characteristicName=pH&startDateLo=01-01-2025&mimeType=csv&sorted=no&zip=no"
                old = st.get("status")
                status, latency, error = probe(url, fast=args.fast)
                update_backoff_fields(st, status)
                st["status"] = status
                counts[status] = counts.get(status, 0) + 1
                print_result(f"wqp-{abbr} ({st['name']})", status, latency, error, old)
                time.sleep(0.5)

    save_registry(reg)

    total = sum(counts.values())
    skipped = counts["skipped"]
    checked = total - skipped
    print(f"\n  {'='*55}")
    print(f"  ✅ {counts['live']} live  ⚠️ {counts['degraded']} degraded  ❌ {counts['dead']} dead  ⏭ {counts['gated']} gated  ⏩ {skipped} skipped  ({checked} checked / {total} total)\n")


if __name__ == "__main__":
    main()
