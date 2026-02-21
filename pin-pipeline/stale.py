#!/usr/bin/env python3
"""
PIN Staleness Checker — finds stale sources, attempts to revive dead ones.

Usage:
  python stale.py --report          # Show staleness report
  python stale.py --revive          # Try alternate URLs for dead sources
  python stale.py --threshold 180   # Custom staleness threshold (days)
"""

import argparse
import json
import sys
import time
import requests
from datetime import datetime, timedelta
from pathlib import Path

DIR = Path(__file__).parent
REGISTRY = DIR / "registry.json"

# Industry standard age brackets
AGE_BRACKETS = [
    (730,  "Current (< 2yr)",        "decision-grade"),
    (1825, "Valid for trends (2-5yr)", "trend-analysis"),
    (3650, "Supplemental (5-10yr)",   "supplemental"),
    (None, "Historical only (>10yr)", "historical"),
]


def load_registry():
    with open(REGISTRY) as f:
        return json.load(f)


def save_registry(reg):
    reg["meta"]["updated"] = datetime.utcnow().isoformat() + "Z"
    with open(REGISTRY, "w") as f:
        json.dump(reg, f, indent=2)


def days_since(iso_str):
    """Days since an ISO timestamp. Returns None if no timestamp."""
    if not iso_str:
        return None
    try:
        ts = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return (datetime.now(ts.tzinfo) - ts).days
    except Exception:
        return None


def classify_age(days):
    """Return (bracket_label, bracket_key) for a given age in days."""
    if days is None:
        return "Never fetched", "never"
    for threshold, label, key in AGE_BRACKETS:
        if threshold is None or days < threshold:
            return label, key
    return "Historical only (>10yr)", "historical"


def report(reg, threshold_days):
    """Print a staleness report for all sources."""
    print(f"\n  ── PIN Staleness Report (threshold: {threshold_days} days) ──\n")

    # Federal / state / NOAA
    stale_sources = []
    dead_sources = []
    never_fetched = []

    for src in reg["sources"]:
        age = days_since(src.get("last_success"))
        label, bracket = classify_age(age)

        if src["status"] == "dead":
            dead_sources.append(src)
        elif age is None:
            never_fetched.append(src)
        elif age > threshold_days:
            stale_sources.append((src, age, label))

    # WQP states
    wqp = reg.get("wqp_states", {})
    stale_wqp = []
    dead_wqp = []
    never_wqp = []

    for abbr, st in sorted(wqp.items()):
        age = days_since(st.get("last_success"))
        label, bracket = classify_age(age)

        if st.get("status") == "dead":
            dead_wqp.append((abbr, st))
        elif age is None:
            never_wqp.append((abbr, st))
        elif age > threshold_days:
            stale_wqp.append((abbr, st, age, label))

    # ── Print report ──

    if dead_sources or dead_wqp:
        print(f"  ❌ DEAD SOURCES ({len(dead_sources) + len(dead_wqp)})")
        for src in dead_sources:
            errs = src.get("error_count", 0)
            print(f"     {src['id']:35s}  errors={errs}  last_checked={src.get('last_checked', 'never')}")
        for abbr, st in dead_wqp:
            errs = st.get("error_count", 0)
            print(f"     wqp-{abbr:32s}  errors={errs}")
        print()

    if stale_sources or stale_wqp:
        print(f"  ⏰ STALE (>{threshold_days} days) — ({len(stale_sources) + len(stale_wqp)})")
        for src, age, label in stale_sources:
            print(f"     {src['id']:35s}  {age:>5}d old  {label}")
        for abbr, st, age, label in stale_wqp:
            print(f"     wqp-{abbr:32s}  {age:>5}d old  {label}")
        print()

    if never_fetched or never_wqp:
        print(f"  🆕 NEVER FETCHED ({len(never_fetched) + len(never_wqp)})")
        for src in never_fetched:
            print(f"     {src['id']:35s}  priority={src['priority']}  status={src['status']}")
        for abbr, st in never_wqp:
            print(f"     wqp-{abbr:32s}  priority={st['priority']}")
        print()

    # Summary by age bracket
    print("  ── Age Distribution ──\n")
    brackets = {"decision-grade": 0, "trend-analysis": 0, "supplemental": 0, "historical": 0, "never": 0}

    for src in reg["sources"]:
        age = days_since(src.get("last_success"))
        _, key = classify_age(age)
        brackets[key] = brackets.get(key, 0) + 1

    for abbr, st in wqp.items():
        age = days_since(st.get("last_success"))
        _, key = classify_age(age)
        brackets[key] = brackets.get(key, 0) + 1

    total = sum(brackets.values())
    print(f"     Current (< 2yr):        {brackets['decision-grade']:>3}")
    print(f"     Trend analysis (2-5yr): {brackets['trend-analysis']:>3}")
    print(f"     Supplemental (5-10yr):  {brackets['supplemental']:>3}")
    print(f"     Historical (>10yr):     {brackets['historical']:>3}")
    print(f"     Never fetched:          {brackets['never']:>3}")
    print(f"     {'─'*35}")
    print(f"     Total:                  {total:>3}")
    print()


def revive(reg):
    """Try alternate URLs for dead sources."""
    print(f"\n  ── Reviving Dead Sources ──\n")
    revived = 0

    for src in reg["sources"]:
        if src["status"] != "dead":
            continue
        alt_urls = src.get("alt_urls", [])
        if not alt_urls:
            print(f"  ⏭  {src['id']:35s}  no alternate URLs")
            continue

        for alt in alt_urls:
            print(f"  🔄 {src['id']:35s}  trying {alt[:80]}...")
            try:
                r = requests.get(alt, timeout=15, stream=True)
                r.close()
                if r.status_code < 300:
                    src["status"] = "live"
                    src["url"] = alt
                    src["error_count"] = 0
                    src["last_checked"] = datetime.utcnow().isoformat() + "Z"
                    print(f"  ✅ {src['id']:35s}  REVIVED via alternate URL!")
                    revived += 1
                    break
                else:
                    print(f"     HTTP {r.status_code} — still dead")
            except Exception as e:
                print(f"     Failed: {str(e)[:80]}")
            time.sleep(1)

    # Try WQP states
    wqp = reg.get("wqp_states", {})
    for abbr, st in sorted(wqp.items()):
        if st.get("status") != "dead":
            continue
        # Try a minimal WQP query to test
        url = f"https://www.waterqualitydata.us/data/Result/search?statecode=US:{st['fips']}&characteristicName=pH&startDateLo=01-01-2025&mimeType=csv&sorted=no&zip=no"
        print(f"  🔄 wqp-{abbr:32s}  testing minimal query...")
        try:
            r = requests.get(url, timeout=30, stream=True)
            r.close()
            if r.status_code < 300:
                st["status"] = "live"
                st["error_count"] = 0
                print(f"  ✅ wqp-{abbr:32s}  REVIVED!")
                revived += 1
            else:
                print(f"     HTTP {r.status_code} — still dead")
        except Exception as e:
            print(f"     Failed: {str(e)[:80]}")
        time.sleep(1)

    save_registry(reg)
    print(f"\n  Revived {revived} source{'s' if revived != 1 else ''}\n")


def main():
    parser = argparse.ArgumentParser(description="PIN Staleness Checker")
    parser.add_argument("--report", action="store_true", help="Print staleness report")
    parser.add_argument("--revive", action="store_true", help="Try alternate URLs for dead sources")
    parser.add_argument("--threshold", type=int, default=365, help="Staleness threshold in days (default: 365)")
    args = parser.parse_args()

    if not args.report and not args.revive:
        args.report = True  # Default to report

    reg = load_registry()

    if args.report:
        report(reg, args.threshold)
    if args.revive:
        revive(reg)


if __name__ == "__main__":
    main()
