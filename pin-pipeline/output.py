#!/usr/bin/env python3
"""
PIN Output Generator — converts fetched CSV data into typed .ts files
for the Next.js app. Drops them into the target lib/ directory.

Usage:
  python output.py --target ../lib
  python output.py --target ../lib --source wqp-MD
  python output.py --list                    # Show available CSV files
"""

import argparse
import json
import os
import sys
import pandas as pd
from datetime import datetime
from pathlib import Path

DIR = Path(__file__).parent
OUTPUT = DIR / "output"
REGISTRY = DIR / "registry.json"

# WQP characteristic names → our param keys (same as fetch.py)
WQP_CHAR_MAP = {
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


def load_registry():
    with open(REGISTRY) as f:
        return json.load(f)


def list_csvs():
    """List available CSV files in output/."""
    csvs = sorted(OUTPUT.glob("*.csv"))
    if not csvs:
        print("  No CSV files in output/. Run fetch.py first.")
        return
    print(f"\n  ── Available CSV Files ({len(csvs)}) ──\n")
    for f in csvs:
        size_mb = f.stat().st_size / (1024 * 1024)
        rows = sum(1 for _ in open(f)) - 1  # subtract header
        print(f"  {f.name:40s}  {size_mb:>6.1f} MB  {rows:>10,} rows")
    print()


def aggregate_wqp(csv_path, state_abbr):
    """Aggregate a WQP CSV into a state summary dict for .ts output."""
    df = pd.read_csv(csv_path, low_memory=False)

    # Map characteristic names to our param keys
    if "CharacteristicName" in df.columns:
        df["param"] = df["CharacteristicName"].map(WQP_CHAR_MAP)
        df = df.dropna(subset=["param"])

    if "ResultMeasureValue" in df.columns:
        df["value"] = pd.to_numeric(df["ResultMeasureValue"], errors="coerce")
    elif "value" in df.columns:
        df["value"] = pd.to_numeric(df["value"], errors="coerce")
    else:
        return None

    df = df.dropna(subset=["value"])

    # Site info
    site_col = "MonitoringLocationIdentifier" if "MonitoringLocationIdentifier" in df.columns else "site_id"
    name_col = "MonitoringLocationName" if "MonitoringLocationName" in df.columns else "site_name"
    date_col = "ActivityStartDate" if "ActivityStartDate" in df.columns else "datetime"
    lat_col = next((c for c in df.columns if "Latitude" in c or c == "lat"), None)
    lon_col = next((c for c in df.columns if "Longitude" in c or c == "lon"), None)

    # Parameter coverage: count of samples per param
    param_coverage = df.groupby("param")["value"].count().to_dict()

    # Parameter medians
    param_medians = df.groupby("param")["value"].median().round(3).to_dict()

    # Date range
    if date_col in df.columns:
        dates = pd.to_datetime(df[date_col], errors="coerce").dropna()
        date_range = [str(dates.min().date()), str(dates.max().date())] if not dates.empty else [None, None]
    else:
        date_range = [None, None]

    # Top stations by sample count
    top_stations = []
    if site_col in df.columns:
        station_counts = df.groupby(site_col).agg(
            sample_count=("value", "count"),
            params=(("param", lambda x: list(x.unique()))),
        ).nlargest(25, "sample_count")

        for sid, row in station_counts.iterrows():
            station = {"siteId": str(sid), "sampleCount": int(row["sample_count"]), "params": row["params"]}

            # Try to get name, lat, lon
            site_rows = df[df[site_col] == sid]
            if name_col in site_rows.columns:
                names = site_rows[name_col].dropna()
                if not names.empty:
                    station["siteName"] = str(names.iloc[0])
            if lat_col and lat_col in site_rows.columns:
                lats = site_rows[lat_col].dropna()
                if not lats.empty:
                    station["lat"] = round(float(lats.iloc[0]), 5)
            if lon_col and lon_col in site_rows.columns:
                lons = site_rows[lon_col].dropna()
                if not lons.empty:
                    station["lon"] = round(float(lons.iloc[0]), 5)

            # Last sampled date for this station
            if date_col in site_rows.columns:
                sdates = pd.to_datetime(site_rows[date_col], errors="coerce").dropna()
                if not sdates.empty:
                    station["lastSampled"] = str(sdates.max().date())

            top_stations.append(station)

    unique_sites = df[site_col].nunique() if site_col in df.columns else 0

    return {
        "state": state_abbr,
        "stationCount": unique_sites,
        "sampleCount": len(df),
        "dateRange": date_range,
        "paramCoverage": param_coverage,
        "paramMedians": param_medians,
        "topStations": top_stations,
        "generated": datetime.utcnow().isoformat() + "Z",
    }


def aggregate_usgs(csv_path, state_abbr):
    """Aggregate USGS NWIS CSV into a state summary dict."""
    df = pd.read_csv(csv_path, low_memory=False)
    df["value"] = pd.to_numeric(df.get("value"), errors="coerce")
    df = df.dropna(subset=["value"])

    if df.empty:
        return None

    param_coverage = df.groupby("param")["value"].count().to_dict()
    param_medians = df.groupby("param")["value"].median().round(3).to_dict()

    dates = pd.to_datetime(df.get("datetime"), errors="coerce").dropna()
    date_range = [str(dates.min().date()), str(dates.max().date())] if not dates.empty else [None, None]

    unique_sites = df["site_id"].nunique() if "site_id" in df.columns else 0

    top_stations = []
    if "site_id" in df.columns:
        station_counts = df.groupby("site_id").agg(
            sample_count=("value", "count"),
            params=(("param", lambda x: list(x.unique()))),
        ).nlargest(25, "sample_count")
        for sid, row in station_counts.iterrows():
            station = {"siteId": str(sid), "sampleCount": int(row["sample_count"]), "params": row["params"]}
            site_rows = df[df["site_id"] == sid]
            if "site_name" in site_rows.columns:
                station["siteName"] = str(site_rows["site_name"].iloc[0])
            if "lat" in site_rows.columns:
                station["lat"] = round(float(site_rows["lat"].iloc[0]), 5)
            if "lon" in site_rows.columns:
                station["lon"] = round(float(site_rows["lon"].iloc[0]), 5)
            top_stations.append(station)

    return {
        "state": state_abbr,
        "source": "USGS_NWIS",
        "stationCount": unique_sites,
        "sampleCount": len(df),
        "dateRange": date_range,
        "paramCoverage": param_coverage,
        "paramMedians": param_medians,
        "topStations": top_stations,
        "generated": datetime.utcnow().isoformat() + "Z",
    }


def to_ts_value(val):
    """Convert a Python value to a TypeScript literal string."""
    if val is None:
        return "null"
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, str):
        return json.dumps(val)  # handles escaping
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, list):
        items = ", ".join(to_ts_value(v) for v in val)
        return f"[{items}]"
    if isinstance(val, dict):
        entries = ", ".join(f"{json.dumps(k)}: {to_ts_value(v)}" for k, v in val.items())
        return f"{{ {entries} }}"
    return json.dumps(str(val))


def generate_ts(summary, source_type, target_dir):
    """Generate a .ts file from an aggregated summary."""
    state = summary["state"]
    source = summary.get("source", source_type.upper())

    filename = f"{source_type}-{state}.ts"
    filepath = target_dir / filename

    ts_lines = [
        f"// Auto-generated by PIN pipeline — do not edit manually",
        f"// Source: {source} | State: {state} | Generated: {summary['generated']}",
        f"",
        f"export interface PINStationSummary {{",
        f"  siteId: string;",
        f"  siteName?: string;",
        f"  lat?: number;",
        f"  lon?: number;",
        f"  params: string[];",
        f"  sampleCount: number;",
        f"  lastSampled?: string;",
        f"}}",
        f"",
        f"export interface PINStateSummary {{",
        f"  state: string;",
        f"  source?: string;",
        f"  stationCount: number;",
        f"  sampleCount: number;",
        f"  dateRange: [string | null, string | null];",
        f"  paramCoverage: Record<string, number>;",
        f"  paramMedians: Record<string, number>;",
        f"  topStations: PINStationSummary[];",
        f"  generated: string;",
        f"}}",
        f"",
        f"export const PIN_{source_type.upper()}_{state}: PINStateSummary = {to_ts_value(summary)};",
        f"",
    ]

    filepath.write_text("\n".join(ts_lines), encoding="utf-8")
    print(f"  ✅ {filename:40s}  ({summary['stationCount']} stations, {summary['sampleCount']:,} samples)")


def main():
    parser = argparse.ArgumentParser(description="PIN Output Generator")
    parser.add_argument("--target", default="../lib/pin", help="Target directory for .ts files (default: ../lib/pin)")
    parser.add_argument("--source", help="Only process a specific CSV (e.g., wqp-MD)")
    parser.add_argument("--list", action="store_true", help="List available CSV files")
    args = parser.parse_args()

    if args.list:
        list_csvs()
        return

    target = Path(args.target)
    target.mkdir(parents=True, exist_ok=True)

    csvs = sorted(OUTPUT.glob("*.csv"))
    if not csvs:
        print("  No CSV files in output/. Run fetch.py first.")
        return

    if args.source:
        csvs = [c for c in csvs if c.stem == args.source]
        if not csvs:
            print(f"  CSV not found: {args.source}.csv")
            return

    print(f"\n  ── Generating .ts files → {target}/ ──\n")
    generated = 0

    for csv_path in csvs:
        name = csv_path.stem  # e.g., "wqp-MD", "usgs-nwis-MD", "sdwis-MD"
        parts = name.split("-")

        try:
            if name.startswith("wqp-"):
                state = parts[1]
                summary = aggregate_wqp(csv_path, state)
                if summary:
                    generate_ts(summary, "wqp", target)
                    generated += 1
            elif name.startswith("usgs-nwis-"):
                state = parts[2]
                summary = aggregate_usgs(csv_path, state)
                if summary:
                    generate_ts(summary, "nwis", target)
                    generated += 1
            elif name.startswith("sdwis-"):
                state = parts[1]
                # SDWIS is structured differently, just copy as JSON export
                df = pd.read_csv(csv_path, low_memory=False)
                summary = {
                    "state": state,
                    "source": "EPA_SDWIS",
                    "systemCount": len(df),
                    "generated": datetime.utcnow().isoformat() + "Z",
                }
                filepath = target / f"sdwis-{state}.ts"
                lines = [
                    "// Auto-generated by PIN pipeline — do not edit manually",
                    f"// Source: EPA SDWIS | State: {state} | Generated: {summary['generated']}",
                    "",
                    f"export const PIN_SDWIS_{state} = {{",
                    f"  state: {json.dumps(state)},",
                    f"  systemCount: {len(df)},",
                    f"  generated: {json.dumps(summary['generated'])},",
                    "};",
                    "",
                ]
                filepath.write_text("\n".join(lines), encoding="utf-8")
                print(f"  ✅ sdwis-{state}.ts{' ':32s}  ({len(df)} water systems)")
                generated += 1
            else:
                print(f"  ⏭  {name}.csv — unknown source type, skipping")
        except Exception as e:
            print(f"  ❌ {name}.csv — {str(e)[:100]}")

    # Generate index file that re-exports everything
    if generated > 0:
        ts_files = sorted(target.glob("*.ts"))
        ts_files = [f for f in ts_files if f.name != "index.ts"]
        index_lines = [
            "// Auto-generated by PIN pipeline — do not edit manually",
            f"// Generated: {datetime.utcnow().isoformat()}Z",
            f"// {generated} source files",
            "",
        ]
        for f in ts_files:
            module = f.stem
            index_lines.append(f"export * from './{module}';")
        index_lines.append("")
        (target / "index.ts").write_text("\n".join(index_lines), encoding="utf-8")
        print(f"\n  📦 index.ts — re-exports {len(ts_files)} modules")

    print(f"\n  {'='*50}")
    print(f"  Generated {generated} .ts file{'s' if generated != 1 else ''} → {target}/\n")


if __name__ == "__main__":
    main()
