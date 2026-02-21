"""
CEDEN Cache Builder
Fetches California surface water chemistry + toxicity data from data.ca.gov,
deduplicates to latest-per-station-per-analyte, and writes a spatial-indexed
JSON cache file for instant lookups by the Next.js app.

Usage:
    python scripts/ceden_cache.py

Output:
    data/ceden-cache.json  (~5-10MB, spatial grid index)

Schedule: Run daily or twice-daily (CEDEN data updates weekly).
"""

import json
import math
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests

# ── Config ────────────────────────────────────────────────────────────────────

CKAN_BASE = "https://data.ca.gov/api/3/action/datastore_search_sql"

# Resource IDs
CHEM_2025 = "97b8bb60-8e58-4c97-a07f-d51a48cd36d4"
CHEM_AUG  = "e07c5e0b-cace-4b70-9f13-b3e696cd5a99"
TOX       = "bd484e9b-426a-4ba6-ba4d-f5f8ce095836"

# Grid resolution for spatial index (0.1 degree ~ 11km)
GRID_RES = 0.1

# CKAN page size (max 32000)
PAGE_SIZE = 32000

# Output path
OUT_DIR = Path(__file__).resolve().parent.parent / "data"
OUT_FILE = OUT_DIR / "ceden-cache.json"

# Analytes we care about (maps to PEARL keys)
PEARL_ANALYTES = {
    "Oxygen, Dissolved, Total": "DO",
    "Oxygen, Dissolved": "DO",
    "Temperature": "temperature",
    "pH": "pH",
    "Turbidity, Total": "turbidity",
    "Turbidity": "turbidity",
    "E. coli": "bacteria",
    "Enterococcus": "bacteria",
    "Enterococcus, Total": "bacteria",
    "Coliform, Fecal": "bacteria",
    "Coliform, Total": "coliform_total",
    "Nitrogen, Total": "TN",
    "Nitrogen, Total Kjeldahl": "TN",
    "Phosphorus as P": "TP",
    "Phosphorus, Total": "TP",
    "Chlorophyll a": "chlorophyll",
    "SpecificConductivity": "conductivity",
    "Specific Conductance": "conductivity",
    "Salinity": "salinity",
    "Total Suspended Solids": "TSS",
    "Suspended Sediment Concentration": "TSS",
}

CHEM_COLS = (
    '"StationName","StationCode","SampleDate","Analyte","Result","Unit",'
    '"Latitude","Longitude","DataQuality","SampleAgency"'
)

TOX_COLS = (
    '"StationName","StationCode","SampleDate","OrganismName","Analyte",'
    '"Result","Unit","Mean","SigEffectCode","Latitude","Longitude","DataQuality"'
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def grid_key(lat: float, lng: float) -> str:
    """Round lat/lng to grid cell key."""
    glat = round(math.floor(lat / GRID_RES) * GRID_RES, 2)
    glng = round(math.floor(lng / GRID_RES) * GRID_RES, 2)
    return f"{glat}_{glng}"


def ckan_sql(sql: str) -> list[dict]:
    """Execute a CKAN SQL query and return records."""
    resp = requests.get(CKAN_BASE, params={"sql": sql}, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        raise RuntimeError(data.get("error", {}).get("message", "CKAN query failed"))
    return data.get("result", {}).get("records", [])


def fetch_paginated(resource_id: str, cols: str, where: str, order: str = '"SampleDate" DESC') -> pd.DataFrame:
    """Fetch all records from a CKAN resource using OFFSET pagination."""
    all_records = []
    offset = 0
    while True:
        sql = (
            f'SELECT {cols} FROM "{resource_id}" '
            f'WHERE {where} '
            f'ORDER BY {order} '
            f'LIMIT {PAGE_SIZE} OFFSET {offset}'
        )
        print(f"  Fetching offset {offset}...", end=" ", flush=True)
        try:
            records = ckan_sql(sql)
        except Exception as e:
            print(f"ERROR: {e}")
            break
        print(f"{len(records)} records")
        if not records:
            break
        all_records.extend(records)
        if len(records) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.5)  # Be polite to the API
    return pd.DataFrame(all_records)


# ── Main ──────────────────────────────────────────────────────────────────────

def build_chemistry_cache() -> pd.DataFrame:
    """Fetch and deduplicate chemistry data."""
    print("\n=== Chemistry 2025 ===")
    analyte_list = "'" + "','".join(a.replace("'", "''") for a in PEARL_ANALYTES.keys()) + "'"
    where = (
        f'"DataQuality" NOT IN (\'MetaData\',\'Reject\') '
        f'AND "Analyte" IN ({analyte_list}) '
        f'AND "Latitude" > 0'  # exclude -88 unknowns
    )
    df = fetch_paginated(CHEM_2025, CHEM_COLS, where)

    if df.empty:
        print("  No chemistry records found, trying augmentation dataset...")
        df = fetch_paginated(CHEM_AUG, CHEM_COLS, where + ' AND "SampleDate" >= \'2022-01-01\'')

    if df.empty:
        print("  WARNING: No chemistry data fetched")
        return pd.DataFrame()

    # Clean up
    df["Result"] = pd.to_numeric(df["Result"], errors="coerce")
    df["Latitude"] = pd.to_numeric(df["Latitude"], errors="coerce")
    df["Longitude"] = pd.to_numeric(df["Longitude"], errors="coerce")
    df = df.dropna(subset=["Result", "Latitude", "Longitude"])
    df = df[df["Latitude"] > 0]  # drop -88 sentinel values

    # Map to PEARL keys
    df["pearl_key"] = df["Analyte"].map(PEARL_ANALYTES)
    df = df.dropna(subset=["pearl_key"])

    # Deduplicate: keep latest per station + pearl_key
    df = df.sort_values("SampleDate", ascending=False)
    df = df.drop_duplicates(subset=["StationCode", "pearl_key"], keep="first")

    # Add grid key
    df["grid"] = df.apply(lambda r: grid_key(r["Latitude"], r["Longitude"]), axis=1)

    print(f"  Deduplicated: {len(df)} records across {df['grid'].nunique()} grid cells, {df['StationCode'].nunique()} stations")
    return df


def build_toxicity_cache() -> pd.DataFrame:
    """Fetch and deduplicate toxicity data (recent only)."""
    print("\n=== Toxicity (2022+) ===")
    where = (
        '"DataQuality" NOT IN (\'MetaData\',\'Reject\') '
        'AND "SampleDate" >= \'2022-01-01\' '
        'AND "Latitude" > 0'
    )
    df = fetch_paginated(TOX, TOX_COLS, where)

    if df.empty:
        print("  WARNING: No toxicity data fetched")
        return pd.DataFrame()

    # Clean up
    df["Result"] = pd.to_numeric(df["Result"], errors="coerce")
    df["Mean"] = pd.to_numeric(df["Mean"], errors="coerce")
    df["Latitude"] = pd.to_numeric(df["Latitude"], errors="coerce")
    df["Longitude"] = pd.to_numeric(df["Longitude"], errors="coerce")
    df = df.dropna(subset=["Latitude", "Longitude"])
    df = df[df["Latitude"] > 0]

    # Deduplicate: keep latest per station + organism
    df = df.sort_values("SampleDate", ascending=False)
    df = df.drop_duplicates(subset=["StationCode", "OrganismName"], keep="first")

    # Add grid key
    df["grid"] = df.apply(lambda r: grid_key(r["Latitude"], r["Longitude"]), axis=1)

    print(f"  Deduplicated: {len(df)} records across {df['grid'].nunique()} grid cells")
    return df


def build_cache():
    """Build the full cache and write to JSON."""
    start = time.time()

    chem_df = build_chemistry_cache()
    tox_df = build_toxicity_cache()

    # Build spatial index
    print("\n=== Building spatial index ===")
    cache = {
        "_meta": {
            "built": datetime.utcnow().isoformat() + "Z",
            "chemistry_records": len(chem_df),
            "toxicity_records": len(tox_df),
            "grid_resolution": GRID_RES,
            "chemistry_stations": int(chem_df["StationCode"].nunique()) if not chem_df.empty else 0,
            "toxicity_stations": int(tox_df["StationCode"].nunique()) if not tox_df.empty else 0,
        },
        "grid": {},
    }

    # Chemistry by grid cell
    if not chem_df.empty:
        for grid_id, group in chem_df.groupby("grid"):
            cell = cache["grid"].setdefault(grid_id, {"chemistry": [], "toxicity": []})
            for _, row in group.iterrows():
                cell["chemistry"].append({
                    "stn": row["StationCode"],
                    "name": row["StationName"],
                    "date": str(row["SampleDate"])[:10] if pd.notna(row["SampleDate"]) else None,
                    "key": row["pearl_key"],
                    "analyte": row["Analyte"],
                    "val": round(float(row["Result"]), 4) if pd.notna(row["Result"]) else None,
                    "unit": row["Unit"],
                    "lat": round(float(row["Latitude"]), 5),
                    "lng": round(float(row["Longitude"]), 5),
                    "agency": row.get("SampleAgency", ""),
                })

    # Toxicity by grid cell
    if not tox_df.empty:
        for grid_id, group in tox_df.groupby("grid"):
            cell = cache["grid"].setdefault(grid_id, {"chemistry": [], "toxicity": []})
            for _, row in group.iterrows():
                cell["toxicity"].append({
                    "stn": row["StationCode"],
                    "name": row["StationName"],
                    "date": str(row["SampleDate"])[:10] if pd.notna(row["SampleDate"]) else None,
                    "organism": row.get("OrganismName", ""),
                    "analyte": row.get("Analyte", ""),
                    "val": round(float(row["Result"]), 4) if pd.notna(row["Result"]) else None,
                    "mean": round(float(row["Mean"]), 4) if pd.notna(row["Mean"]) else None,
                    "unit": row.get("Unit", ""),
                    "sig": row.get("SigEffectCode", ""),
                    "lat": round(float(row["Latitude"]), 5),
                    "lng": round(float(row["Longitude"]), 5),
                })

    # Write
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(cache, f, separators=(",", ":"))  # compact JSON

    file_size = OUT_FILE.stat().st_size / (1024 * 1024)
    elapsed = time.time() - start
    grid_count = len(cache["grid"])

    print(f"\n=== Done ===")
    print(f"  Output: {OUT_FILE}")
    print(f"  File size: {file_size:.1f} MB")
    print(f"  Grid cells: {grid_count}")
    print(f"  Chemistry: {cache['_meta']['chemistry_records']} records, {cache['_meta']['chemistry_stations']} stations")
    print(f"  Toxicity: {cache['_meta']['toxicity_records']} records, {cache['_meta']['toxicity_stations']} stations")
    print(f"  Elapsed: {elapsed:.1f}s")


if __name__ == "__main__":
    try:
        build_cache()
    except KeyboardInterrupt:
        print("\nAborted.")
        sys.exit(1)
    except Exception as e:
        print(f"\nFATAL: {e}", file=sys.stderr)
        sys.exit(1)
