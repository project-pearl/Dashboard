#!/usr/bin/env python3
"""
PIN Fetcher — priority-sorted data fetcher. Reads registry, pulls live sources.

Usage:
  python fetch.py --segment federal --from 2024-01-01 --dry-run
  python fetch.py --all-states --from 2024-01-01
  python fetch.py --states MD,FL,CA --from 2024-01-01
  python fetch.py --source usgs-nwis --from 2024-01-01
  python fetch.py --next-batch 4 --from 2024-01-01   # Scheduler mode
"""

import argparse
import io
import json
import os
import sys
import time
import requests
import pandas as pd
from datetime import datetime
from pathlib import Path

DIR = Path(__file__).parent
REGISTRY = DIR / "registry.json"
OUTPUT = DIR / "output"

# WQP characteristic names → our param keys
WQP_PARAMS = {
    "Dissolved oxygen (DO)":        "DO",
    "Temperature, water":           "temperature",
    "pH":                           "pH",
    "Turbidity":                    "turbidity",
    "Total suspended solids":       "TSS",
    "Nitrogen, mixed forms (NH3), (NH4), organic, (NO2) and (NO3)": "TN",
    "Total Nitrogen, mixed forms":  "TN",
    "Nitrogen":                     "TN",
    "Phosphorus":                   "TP",
    "Escherichia coli":             "bacteria",
    "Enterococcus":                 "bacteria",
    "Fecal Coliform":               "bacteria",
    "Chlorophyll a":                "chlorophyll",
    "Specific conductance":         "conductivity",
    "Salinity":                     "salinity",
    "Secchi depth":                 "secchi",
}

# USGS parameter codes → our param keys
USGS_CODES = {
    "00300": "DO",
    "00010": "temperature",
    "00400": "pH",
    "63680": "turbidity",
    "00095": "conductivity",
    "00060": "discharge",
    "00065": "gage_height",
    "00480": "salinity",
}

DELAY_BETWEEN_PULLS = 2  # seconds


def load_registry():
    with open(REGISTRY) as f:
        return json.load(f)


def save_registry(reg):
    reg["meta"]["updated"] = datetime.utcnow().isoformat() + "Z"
    with open(REGISTRY, "w") as f:
        json.dump(reg, f, indent=2)


def fetch_wqp_state(abbr, fips, start_date, dry_run=False):
    """Fetch WQP discrete samples for a single state. Returns DataFrame or None."""
    params_str = ";".join(WQP_PARAMS.keys())
    url = (
        f"https://www.waterqualitydata.us/data/Result/search"
        f"?statecode=US:{fips}"
        f"&characteristicName={requests.utils.quote(params_str)}"
        f"&startDateLo={start_date.strftime('%m-%d-%Y')}"
        f"&mimeType=csv&sorted=no&zip=no"
    )

    if dry_run:
        print(f"  [DRY RUN] wqp-{abbr}: would fetch")
        print(f"            {url[:120]}...")
        return None

    print(f"  Fetching wqp-{abbr} from {start_date.strftime('%Y-%m-%d')}...")
    try:
        r = requests.get(url, timeout=300, stream=True)
        r.raise_for_status()
        content = r.text
        if not content.strip():
            print(f"    ⚠ wqp-{abbr}: empty response")
            return None
        df = pd.read_csv(io.StringIO(content), low_memory=False)
        print(f"    ✅ wqp-{abbr}: {len(df):,} results")
        return df
    except requests.exceptions.Timeout:
        print(f"    ⚠ wqp-{abbr}: timeout (5 min)")
        return None
    except requests.exceptions.HTTPError as e:
        print(f"    ❌ wqp-{abbr}: HTTP {e.response.status_code}")
        return None
    except Exception as e:
        print(f"    ❌ wqp-{abbr}: {str(e)[:100]}")
        return None


def fetch_usgs_nwis(state_cd, start_date, dry_run=False):
    """Fetch USGS NWIS instantaneous values for a state. Returns DataFrame or None."""
    param_codes = ",".join(USGS_CODES.keys())
    url = (
        f"https://waterservices.usgs.gov/nwis/iv/"
        f"?format=json&stateCd={state_cd}"
        f"&parameterCd={param_codes}"
        f"&startDT={start_date.strftime('%Y-%m-%d')}"
        f"&siteStatus=active"
    )

    if dry_run:
        print(f"  [DRY RUN] usgs-nwis ({state_cd}): would fetch")
        print(f"            {url[:120]}...")
        return None

    print(f"  Fetching USGS NWIS {state_cd}...")
    try:
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        data = r.json()
        ts_list = data.get("value", {}).get("timeSeries", [])
        if not ts_list:
            print(f"    ⚠ NWIS {state_cd}: no time series")
            return None

        rows = []
        for ts in ts_list:
            site = ts.get("sourceInfo", {})
            variable = ts.get("variable", {})
            param_cd = variable.get("variableCode", [{}])[0].get("value", "")
            param_key = USGS_CODES.get(param_cd, param_cd)
            site_name = site.get("siteName", "")
            site_code = site.get("siteCode", [{}])[0].get("value", "")
            lat = site.get("geoLocation", {}).get("geogLocation", {}).get("latitude")
            lon = site.get("geoLocation", {}).get("geogLocation", {}).get("longitude")

            for val_entry in ts.get("values", [{}])[0].get("value", []):
                rows.append({
                    "source": "USGS",
                    "site_id": site_code,
                    "site_name": site_name,
                    "lat": lat,
                    "lon": lon,
                    "param": param_key,
                    "value": val_entry.get("value"),
                    "unit": variable.get("unit", {}).get("unitCode", ""),
                    "datetime": val_entry.get("dateTime"),
                    "qualifier": val_entry.get("qualifiers", [None])[0],
                })

        df = pd.DataFrame(rows)
        print(f"    ✅ NWIS {state_cd}: {len(df):,} readings across {len(ts_list)} series")
        return df
    except Exception as e:
        print(f"    ❌ NWIS {state_cd}: {str(e)[:100]}")
        return None


def fetch_sdwis(state_cd, dry_run=False):
    """Fetch EPA SDWIS drinking water systems for a state."""
    url = f"https://data.epa.gov/efservice/WATER_SYSTEM/STATE_CODE/{state_cd}/JSON"

    if dry_run:
        count_url = f"https://data.epa.gov/efservice/WATER_SYSTEM/STATE_CODE/{state_cd}/COUNT/JSON"
        try:
            r = requests.get(count_url, timeout=15)
            count = r.json()[0].get("TOTALQUERYRESULTS", "?") if r.ok else "?"
        except Exception:
            count = "?"
        print(f"  [DRY RUN] sdwis ({state_cd}): {count} systems")
        return None

    print(f"  Fetching SDWIS {state_cd}...")
    try:
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        data = r.json()
        df = pd.DataFrame(data)
        print(f"    ✅ SDWIS {state_cd}: {len(df):,} water systems")
        return df
    except Exception as e:
        print(f"    ❌ SDWIS {state_cd}: {str(e)[:100]}")
        return None


def save_csv(df, name):
    """Save DataFrame to output/ directory."""
    if df is None or df.empty:
        return
    OUTPUT.mkdir(exist_ok=True)
    path = OUTPUT / f"{name}.csv"
    df.to_csv(path, index=False)
    size_mb = path.stat().st_size / (1024 * 1024)
    print(f"    💾 Saved {path.name} ({size_mb:.1f} MB, {len(df):,} rows)")


def pick_next_batch(reg, batch_size):
    """Pick the next batch of states to fetch, sorted by:
    1. Never-fetched first
    2. Oldest last_fetch
    3. Higher priority (lower number) breaks ties
    Also includes federal sources that haven't been fetched this cycle.
    Returns list of (type, key, info) tuples."""

    batch = []

    # Federal sources that haven't been fetched
    for src in reg["sources"]:
        if src["status"] == "dead" or src["status"] == "gated":
            continue
        if src["id"] in ("wqp-portal", "epa-attains"):
            continue  # WQP handled per-state, ATTAINS already cached
        if not src.get("last_fetch"):
            batch.append(("federal", src["id"], src))
        if len(batch) >= batch_size:
            return batch

    # WQP states: never-fetched first, then oldest, priority breaks ties
    wqp = reg.get("wqp_states", {})
    state_queue = []
    for abbr, st in wqp.items():
        if st.get("status") == "dead":
            continue
        last = st.get("last_fetch")
        # Sort key: (has_been_fetched, last_fetch_timestamp, priority)
        # Never-fetched sorts first (False < True), then oldest date, then priority
        sort_key = (
            last is not None,           # False (never fetched) sorts before True
            last or "0000-00-00",        # oldest timestamp sorts first
            st.get("priority", 3),       # lower priority number = more important
        )
        state_queue.append((sort_key, abbr, st))

    state_queue.sort(key=lambda x: x[0])

    for _, abbr, st in state_queue:
        if len(batch) >= batch_size:
            break
        batch.append(("wqp", abbr, st))

    return batch


def main():
    parser = argparse.ArgumentParser(description="PIN Data Fetcher")
    parser.add_argument("--segment", choices=["federal", "state", "noaa"], help="Fetch only this segment")
    parser.add_argument("--all-states", action="store_true", help="Fetch WQP for all 56 states/territories")
    parser.add_argument("--states", help="Comma-separated state abbreviations (e.g., MD,FL,CA)")
    parser.add_argument("--source", help="Fetch a single source by ID")
    parser.add_argument("--next-batch", type=int, metavar="N", help="Scheduler mode: fetch next N unfetched/oldest sources")
    parser.add_argument("--from", dest="start_date", default="2024-01-01", help="Start date YYYY-MM-DD (default: 2024-01-01)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be fetched without pulling data")
    args = parser.parse_args()

    start_date = datetime.strptime(args.start_date, "%Y-%m-%d")
    reg = load_registry()
    fetched = 0
    skipped = 0

    print(f"\n  PIN Fetcher — data from {args.start_date} onward")
    if args.dry_run:
        print("  ⚡ DRY RUN — no data will be downloaded\n")
    else:
        print()

    # ── Scheduler mode: --next-batch N ──
    if args.next_batch:
        batch = pick_next_batch(reg, args.next_batch)
        if not batch:
            print("  ✅ All sources are up to date — nothing to fetch")
            return

        print(f"  ── Next Batch ({len(batch)} sources) ──\n")
        for src_type, key, info in batch:
            if src_type == "federal":
                src = info
                sid = src["id"]
                print(f"  [{src_type}] {sid}")
                if sid == "usgs-nwis":
                    # Fetch NWIS for all states that need it — one per batch slot
                    # For now, do all 50 states as NWIS is fast
                    for st_abbr in sorted(reg["wqp_states"].keys()):
                        df = fetch_usgs_nwis(st_abbr, start_date, dry_run=args.dry_run)
                        if df is not None:
                            save_csv(df, f"usgs-nwis-{st_abbr}")
                            fetched += 1
                        time.sleep(DELAY_BETWEEN_PULLS)
                    src["last_fetch"] = datetime.utcnow().isoformat() + "Z"
                    src["last_success"] = src["last_fetch"]
                elif sid == "epa-sdwis":
                    for st_abbr in sorted(reg["wqp_states"].keys()):
                        df = fetch_sdwis(st_abbr, dry_run=args.dry_run)
                        if df is not None:
                            save_csv(df, f"sdwis-{st_abbr}")
                            fetched += 1
                        time.sleep(DELAY_BETWEEN_PULLS)
                    src["last_fetch"] = datetime.utcnow().isoformat() + "Z"
                    src["last_success"] = src["last_fetch"]

            elif src_type == "wqp":
                abbr = key
                st = info
                df = fetch_wqp_state(abbr, st["fips"], start_date, dry_run=args.dry_run)
                if df is not None:
                    save_csv(df, f"wqp-{abbr}")
                    now = datetime.utcnow().isoformat() + "Z"
                    st["last_fetch"] = now
                    st["last_success"] = now
                    st["error_count"] = 0
                    fetched += 1
                elif not args.dry_run:
                    st["error_count"] = st.get("error_count", 0) + 1

            time.sleep(DELAY_BETWEEN_PULLS)

        save_registry(reg)
        print(f"\n  {'='*50}")
        print(f"  Batch complete: {fetched} fetched")
        print()
        return

    # ── Federal sources ──
    if args.segment in (None, "federal") or args.source:
        federal = [s for s in reg["sources"] if s["type"] == "federal"]
        if args.source:
            federal = [s for s in federal if s["id"] == args.source]

        for src in sorted(federal, key=lambda s: s["priority"]):
            if src["status"] == "dead":
                print(f"  ⏭  {src['id']:30s}  DEAD — skipping (error_count={src['error_count']})")
                skipped += 1
                continue

            sid = src["id"]
            if sid == "wqp-portal":
                continue
            elif sid == "usgs-nwis":
                df = fetch_usgs_nwis("MD", start_date, dry_run=args.dry_run)
                if df is not None:
                    save_csv(df, "usgs-nwis-MD")
                    src["last_fetch"] = datetime.utcnow().isoformat() + "Z"
                    src["last_success"] = src["last_fetch"]
                    fetched += 1
            elif sid == "epa-sdwis":
                df = fetch_sdwis("MD", dry_run=args.dry_run)
                if df is not None:
                    save_csv(df, "sdwis-MD")
                    src["last_fetch"] = datetime.utcnow().isoformat() + "Z"
                    src["last_success"] = src["last_fetch"]
                    fetched += 1
            elif sid == "epa-attains":
                print(f"  ⏭  epa-attains                     Already cached (51/51 states in lib/attainsCache.ts)")
                skipped += 1

            time.sleep(DELAY_BETWEEN_PULLS)

    # ── WQP state-by-state ──
    if args.all_states or args.states:
        wqp = reg.get("wqp_states", {})
        if args.states:
            target_states = [s.strip().upper() for s in args.states.split(",")]
        else:
            target_states = sorted(wqp.keys())

        print(f"\n  ── WQP State Fetch ({len(target_states)} states) ──\n")

        for abbr in target_states:
            st = wqp.get(abbr)
            if not st:
                print(f"  ⚠ Unknown state: {abbr}")
                continue
            if st["status"] == "dead":
                print(f"  ⏭  wqp-{abbr}:  DEAD — skipping")
                skipped += 1
                continue

            df = fetch_wqp_state(abbr, st["fips"], start_date, dry_run=args.dry_run)
            if df is not None:
                save_csv(df, f"wqp-{abbr}")
                now = datetime.utcnow().isoformat() + "Z"
                st["last_fetch"] = now
                st["last_success"] = now
                st["error_count"] = 0
                fetched += 1
            elif not args.dry_run:
                st["error_count"] = st.get("error_count", 0) + 1

            time.sleep(DELAY_BETWEEN_PULLS)

    save_registry(reg)

    print(f"\n  {'='*50}")
    print(f"  Fetched: {fetched}  |  Skipped: {skipped}  |  Output dir: {OUTPUT}")
    if not args.dry_run and fetched > 0:
        print(f"  Run `python output.py` to generate .ts files\n")
    print()


if __name__ == "__main__":
    main()
