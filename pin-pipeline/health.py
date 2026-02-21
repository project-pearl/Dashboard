#!/usr/bin/env python3
"""
PIN Health Checker — probes all registered endpoints, updates registry status.
Run daily via cron or manually before fetch runs.

Usage:
  python health.py              # Full check (GET, 15s timeout)
  python health.py --fast       # HEAD-only, 5s timeout
  python health.py --source wqp-portal   # Single source
  python health.py --wqp        # Check all 56 WQP state endpoints
"""

import argparse
import json
import sys
import time
import requests
from datetime import datetime
from pathlib import Path

DIR = Path(__file__).parent
REGISTRY = DIR / "registry.json"


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
    now = datetime.utcnow().isoformat() + "Z"

    old = src.get("status", "unknown")
    src["status"] = status
    src["last_checked"] = now
    if status == "live":
        src["error_count"] = 0
    else:
        src["error_count"] = src.get("error_count", 0) + 1

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


def main():
    parser = argparse.ArgumentParser(description="PIN Health Checker")
    parser.add_argument("--fast", action="store_true", help="HEAD-only, 5s timeout")
    parser.add_argument("--source", help="Check a single source by ID")
    parser.add_argument("--wqp", action="store_true", help="Check all 56 WQP state endpoints")
    args = parser.parse_args()

    reg = load_registry()
    counts = {"live": 0, "degraded": 0, "dead": 0, "gated": 0}

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
                url = f"https://www.waterqualitydata.us/data/Result/search?statecode=US:{st['fips']}&characteristicName=pH&startDateLo=01-01-2025&mimeType=csv&sorted=no&zip=no"
                old = st.get("status")
                status, latency, error = probe(url, fast=args.fast)
                now = datetime.utcnow().isoformat() + "Z"
                st["status"] = status
                st["last_checked"] = now
                if status == "live":
                    st["error_count"] = 0
                else:
                    st["error_count"] = st.get("error_count", 0) + 1
                counts[status] = counts.get(status, 0) + 1
                print_result(f"wqp-{abbr} ({st['name']})", status, latency, error, old)
                time.sleep(0.5)

    save_registry(reg)

    total = sum(counts.values())
    print(f"\n  {'='*55}")
    print(f"  ✅ {counts['live']} live  ⚠️ {counts['degraded']} degraded  ❌ {counts['dead']} dead  ⏭ {counts['gated']} gated  ({total} total)\n")


if __name__ == "__main__":
    main()
