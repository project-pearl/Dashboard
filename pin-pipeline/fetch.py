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


def fetch_icis_npdes(state_cd, dry_run=False):
    """Fetch EPA ICIS-NPDES permits for a state."""
    tables = ["ICIS_PERMITS", "ICIS_VIOLATIONS", "ICIS_INSPECTIONS", "ICIS_ENFORCEMENT_ACTIONS"]
    all_rows = []
    for table in tables:
        url = f"https://data.epa.gov/efservice/{table}/STATE_CODE/{state_cd}/rows/0:10000/JSON"
        if dry_run:
            print(f"  [DRY RUN] icis_npdes ({state_cd}/{table}): would fetch")
            print(f"            {url[:120]}...")
            continue
        print(f"  Fetching ICIS {table} for {state_cd}...")
        try:
            r = requests.get(url, timeout=120)
            r.raise_for_status()
            data = r.json()
            for row in data:
                row["_table"] = table
            all_rows.extend(data)
            print(f"    ✅ {table} {state_cd}: {len(data):,} records")
        except Exception as e:
            print(f"    ❌ {table} {state_cd}: {str(e)[:100]}")
        time.sleep(1)  # 1s between EPA requests

    if dry_run:
        return None
    if not all_rows:
        return None
    return pd.DataFrame(all_rows)


def fetch_icis_dmr(state_cd, dry_run=False):
    """Fetch EPA ICIS DMR measurements for a state. VERY large — filtered by state."""
    url = f"https://data.epa.gov/efservice/ICIS_DMR_MEASUREMENTS/STATE_CODE/{state_cd}/rows/0:10000/JSON"
    if dry_run:
        print(f"  [DRY RUN] icis_dmr ({state_cd}): would fetch")
        print(f"            {url[:120]}...")
        return None
    print(f"  Fetching ICIS DMR {state_cd}...")
    try:
        r = requests.get(url, timeout=180)
        r.raise_for_status()
        data = r.json()
        df = pd.DataFrame(data)
        print(f"    ✅ DMR {state_cd}: {len(df):,} measurements")
        return df
    except Exception as e:
        print(f"    ❌ DMR {state_cd}: {str(e)[:100]}")
        return None


def fetch_echo_facilities(state_cd, dry_run=False):
    """Fetch EPA ECHO CWA facility compliance data for a state."""
    url = f"https://echodata.epa.gov/echo/cwa_rest_services.get_facilities?output=JSON&p_st={state_cd}&responseset=10000"
    if dry_run:
        print(f"  [DRY RUN] echo_facilities ({state_cd}): would fetch")
        print(f"            {url[:120]}...")
        return None
    print(f"  Fetching ECHO facilities {state_cd}...")
    try:
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        data = r.json()
        facilities = data.get("Results", {}).get("Facilities", [])
        if not facilities:
            print(f"    ⚠ ECHO facilities {state_cd}: no facilities returned")
            return None
        df = pd.DataFrame(facilities)
        print(f"    ✅ ECHO facilities {state_cd}: {len(df):,} facilities")
        return df
    except Exception as e:
        print(f"    ❌ ECHO facilities {state_cd}: {str(e)[:100]}")
        return None


def fetch_echo_violations(state_cd, dry_run=False):
    """Fetch EPA ECHO CWA facilities in violation for a state."""
    url = f"https://echodata.epa.gov/echo/cwa_rest_services.get_facilities?output=JSON&p_st={state_cd}&p_qiv=Y&responseset=10000"
    if dry_run:
        print(f"  [DRY RUN] echo_violations ({state_cd}): would fetch")
        print(f"            {url[:120]}...")
        return None
    print(f"  Fetching ECHO violations {state_cd}...")
    try:
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        data = r.json()
        facilities = data.get("Results", {}).get("Facilities", [])
        if not facilities:
            print(f"    ⚠ ECHO violations {state_cd}: no violators (or empty response)")
            return None
        df = pd.DataFrame(facilities)
        print(f"    ✅ ECHO violations {state_cd}: {len(df):,} facilities in violation")
        return df
    except Exception as e:
        print(f"    ❌ ECHO violations {state_cd}: {str(e)[:100]}")
        return None


def fetch_frs_wwtps(dry_run=False):
    """Fetch EPA FRS WWTP locations (nationwide — no state filter)."""
    url = "https://data.epa.gov/efservice/FRS_PROGRAM_FACILITY/PGM_SYS_ACRNM/NPDES/rows/0:10000/JSON"
    if dry_run:
        print(f"  [DRY RUN] frs_wwtps: would fetch")
        print(f"            {url[:120]}...")
        return None
    print(f"  Fetching FRS WWTPs...")
    try:
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        data = r.json()
        df = pd.DataFrame(data)
        print(f"    ✅ FRS WWTPs: {len(df):,} facilities")
        return df
    except Exception as e:
        print(f"    ❌ FRS WWTPs: {str(e)[:100]}")
        return None


def fetch_pfas_ucmr(dry_run=False):
    """Fetch EPA UCMR PFAS screening data (nationwide)."""
    url = "https://data.epa.gov/efservice/UCMR4_ALL/rows/0:10000/JSON"
    if dry_run:
        print(f"  [DRY RUN] pfas_ucmr: would fetch")
        print(f"            {url[:120]}...")
        return None
    print(f"  Fetching UCMR PFAS data...")
    try:
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        data = r.json()
        df = pd.DataFrame(data)
        print(f"    ✅ UCMR PFAS: {len(df):,} results")
        return df
    except Exception as e:
        print(f"    ❌ UCMR PFAS: {str(e)[:100]}")
        return None


def fetch_cdc_nwss(dry_run=False):
    """Fetch CDC NWSS wastewater surveillance data."""
    url = "https://data.cdc.gov/resource/2ew6-ywp6.json?$limit=50000&$order=date_end%20DESC"
    if dry_run:
        print(f"  [DRY RUN] cdc_nwss: would fetch")
        print(f"            {url[:120]}...")
        return None
    print(f"  Fetching CDC NWSS wastewater surveillance...")
    try:
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        data = r.json()
        df = pd.DataFrame(data)
        print(f"    ✅ CDC NWSS: {len(df):,} records")
        return df
    except Exception as e:
        print(f"    ❌ CDC NWSS: {str(e)[:100]}")
        return None


def fetch_nps_wq(dry_run=False):
    """Fetch National Park Service water quality data via WQP."""
    url = "https://www.waterqualitydata.us/data/Result/search?organization=NPSTORET&mimeType=json&zip=no&sorted=no"
    if dry_run:
        print(f"  [DRY RUN] nps_wq: would fetch")
        print(f"            {url[:120]}...")
        return None
    print(f"  Fetching NPS water quality via WQP...")
    try:
        r = requests.get(url, timeout=300, stream=True)
        r.raise_for_status()
        data = r.json()
        df = pd.DataFrame(data)
        print(f"    ✅ NPS WQ: {len(df):,} results")
        return df
    except Exception as e:
        print(f"    ❌ NPS WQ: {str(e)[:100]}")
        return None


def fetch_datagov_wq(dry_run=False):
    """Fetch Data.gov water quality catalog metadata."""
    url = "https://catalog.data.gov/api/3/action/package_search?fq=tags:water-quality&rows=200"
    if dry_run:
        print(f"  [DRY RUN] datagov_wq: would fetch catalog metadata")
        print(f"            {url[:120]}...")
        return None
    print(f"  Fetching Data.gov WQ catalog...")
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        data = r.json()
        results = data.get("result", {}).get("results", [])
        if not results:
            print(f"    ⚠ Data.gov: no catalog results")
            return None
        df = pd.DataFrame(results)
        print(f"    ✅ Data.gov catalog: {len(df):,} datasets found")
        return df
    except Exception as e:
        print(f"    ❌ Data.gov catalog: {str(e)[:100]}")
        return None


def fetch_nasa_cmr(dry_run=False):
    """Fetch NASA CMR satellite dataset catalog metadata."""
    url = "https://cmr.earthdata.nasa.gov/search/collections.json?keyword=water+quality&page_size=50"
    if dry_run:
        print(f"  [DRY RUN] nasa_cmr: would fetch catalog metadata")
        print(f"            {url[:120]}...")
        return None
    print(f"  Fetching NASA CMR catalog...")
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        data = r.json()
        entries = data.get("feed", {}).get("entry", [])
        if not entries:
            print(f"    ⚠ NASA CMR: no collections found")
            return None
        df = pd.DataFrame(entries)
        print(f"    ✅ NASA CMR catalog: {len(df):,} collections found")
        return df
    except Exception as e:
        print(f"    ❌ NASA CMR: {str(e)[:100]}")
        return None


def fetch_mde_arcgis(dry_run=False):
    """Fetch MDE ArcGIS water quality assessment data for Maryland.
    Tries three endpoints in order until one works."""
    endpoints = [
        ("MDE GeoData", "https://mde.geodata.md.gov/arcgis/rest/services/Water_Quality"),
        ("MDE Win64", "https://mdewin64.mde.state.md.us/arcgis/rest/services"),
        ("ArcGIS Online", "https://services.arcgis.com/njFNhDsUCentVYJW/ArcGIS/rest/services"),
    ]
    service_keywords = ["water", "quality", "tmdl", "303d", "ir", "assessment", "impair"]

    if dry_run:
        for label, url in endpoints:
            print(f"  [DRY RUN] md-mde-arcgis ({label}): would probe {url}?f=json")
            try:
                r = requests.get(f"{url}?f=json", timeout=15)
                if r.ok:
                    data = r.json()
                    services = data.get("services", [])
                    matched = [s for s in services if any(kw in s.get("name", "").lower() for kw in service_keywords)]
                    print(f"    Found {len(services)} services, {len(matched)} matching WQ keywords")
                    return None
                else:
                    print(f"    HTTP {r.status_code}")
            except Exception as e:
                print(f"    Unreachable: {str(e)[:80]}")
        return None

    all_rows = []
    for label, base_url in endpoints:
        print(f"  Trying {label}: {base_url}")
        try:
            r = requests.get(f"{base_url}?f=json", timeout=30)
            if not r.ok:
                print(f"    HTTP {r.status_code} — skipping")
                continue
            data = r.json()
            services = data.get("services", [])
            matched = [s for s in services
                       if s.get("type") in ("MapServer", "FeatureServer")
                       and any(kw in s.get("name", "").lower() for kw in service_keywords)]

            # Also check folders
            for folder in data.get("folders", []):
                if any(kw in folder.lower() for kw in service_keywords):
                    try:
                        fr = requests.get(f"{base_url}/{folder}?f=json", timeout=15)
                        if fr.ok:
                            for s in fr.json().get("services", []):
                                if s.get("type") in ("MapServer", "FeatureServer"):
                                    matched.append(s)
                    except Exception:
                        pass

            if not matched:
                print(f"    No matching WQ services — skipping")
                continue

            print(f"    Found {len(matched)} WQ services")

            for svc in matched:
                svc_url = f"{base_url}/{svc['name']}/{svc['type']}"
                try:
                    lr = requests.get(f"{svc_url}?f=json", timeout=15)
                    if not lr.ok:
                        continue
                    layers = lr.json().get("layers", [])
                    for layer in layers:
                        lid = layer["id"]
                        lname = layer.get("name", f"Layer {lid}")
                        offset = 0
                        page_count = 0
                        while True:
                            qurl = (f"{svc_url}/{lid}/query?where=1%3D1&outFields=*"
                                    f"&returnGeometry=true&resultOffset={offset}"
                                    f"&resultRecordCount=2000&f=json")
                            qr = requests.get(qurl, timeout=60)
                            if not qr.ok:
                                break
                            qdata = qr.json()
                            features = qdata.get("features", [])
                            if not features:
                                break
                            for feat in features:
                                attrs = feat.get("attributes", {})
                                geom = feat.get("geometry", {})
                                lat = geom.get("y") or attrs.get("LATITUDE") or attrs.get("LAT")
                                lon = geom.get("x") or attrs.get("LONGITUDE") or attrs.get("LON")
                                row = {
                                    "au_id": (attrs.get("AU_ID") or attrs.get("ASSESSMENT_UNIT_ID")
                                              or attrs.get("AUID") or str(attrs.get("OBJECTID", ""))),
                                    "au_name": (attrs.get("AU_NAME") or attrs.get("WATER_NAME")
                                                or attrs.get("NAME") or ""),
                                    "water_type": attrs.get("WATER_TYPE", attrs.get("AU_TYPE", "unknown")),
                                    "category": (attrs.get("IR_CATEGORY") or attrs.get("CATEGORY") or ""),
                                    "cause": (attrs.get("CAUSE") or attrs.get("CAUSES")
                                              or attrs.get("POLLUTANT") or ""),
                                    "tmdl_status": attrs.get("TMDL_STATUS", "na"),
                                    "tmdl_date": attrs.get("TMDL_DATE") or attrs.get("TMDL_APPROVAL_DATE"),
                                    "lat": lat,
                                    "lon": lon,
                                    "source_layer": lname,
                                }
                                all_rows.append(row)
                            offset += len(features)
                            page_count += 1
                            if qdata.get("exceededTransferLimit") is False or len(features) < 2000:
                                break
                            time.sleep(2)
                        if page_count > 0:
                            print(f"      {lname}: {offset} features ({page_count} pages)")
                except Exception as e:
                    print(f"      Error on {svc['name']}: {str(e)[:80]}")
                time.sleep(5)

            if all_rows:
                break  # Success — stop trying other endpoints
        except Exception as e:
            print(f"    {label} failed: {str(e)[:80]}")

    if not all_rows:
        print(f"    ⚠ md-mde-arcgis: no features from any endpoint")
        return None

    df = pd.DataFrame(all_rows)
    print(f"    ✅ md-mde-arcgis: {len(df):,} total features")
    return df


def fetch_socrata_state(source_id, base_url, dry_run=False):
    """Fetch Socrata-based state open data. Generic handler for NY, NJ, PA, VA."""
    url = f"{base_url}?$limit=10000&$order=:id"
    if dry_run:
        print(f"  [DRY RUN] {source_id}: would fetch")
        print(f"            {url[:120]}...")
        return None
    print(f"  Fetching {source_id}...")
    try:
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        data = r.json()
        df = pd.DataFrame(data)
        print(f"    ✅ {source_id}: {len(df):,} records")
        return df
    except Exception as e:
        print(f"    ❌ {source_id}: {str(e)[:100]}")
        return None


# Socrata base URLs for state open data portals
STATE_SOCRATA_URLS = {
    "state_ny": "https://data.ny.gov/resource/4k4g-s9hz.json",
    "state_nj": "https://data.nj.gov/resource/6khm-yny7.json",
    "state_pa": "https://data.pa.gov/resource/3brs-52mh.json",
    "state_va": "https://data.virginia.gov/resource/7rig-bfxy.json",
}

# ── FETCHER_MAP ──
# Maps source IDs to (handler_fn, needs_state, needs_start_date)
# needs_state: True if handler takes state_cd as first arg
# needs_start_date: True if handler takes start_date arg
FETCHER_MAP = {
    "usgs-nwis":        (fetch_usgs_nwis,       True,  True),
    "epa-sdwis":        (fetch_sdwis,            True,  False),
    "icis_npdes":       (fetch_icis_npdes,       True,  False),
    "icis_dmr":         (fetch_icis_dmr,         True,  False),
    "echo_facilities":  (fetch_echo_facilities,  True,  False),
    "echo_violations":  (fetch_echo_violations,  True,  False),
    "frs_wwtps":        (fetch_frs_wwtps,        False, False),
    "pfas_ucmr":        (fetch_pfas_ucmr,        False, False),
    "cdc_nwss":         (fetch_cdc_nwss,         False, False),
    "nps_wq":           (fetch_nps_wq,           False, False),
    "datagov_wq":       (fetch_datagov_wq,       False, False),
    "nasa_cmr":         (fetch_nasa_cmr,         False, False),
    "md-mde-arcgis":    (fetch_mde_arcgis,       False, False),
    # State Socrata sources use the generic handler
    "state_ny":         (None,                   False, False),  # dispatched via STATE_SOCRATA_URLS
    "state_nj":         (None,                   False, False),
    "state_pa":         (None,                   False, False),
    "state_va":         (None,                   False, False),
}


def dispatch_fetch(sid, state_cd=None, start_date=None, dry_run=False):
    """Dispatch a fetch call by source ID using FETCHER_MAP. Returns DataFrame or None."""
    # Handle state Socrata sources via generic handler
    if sid in STATE_SOCRATA_URLS:
        return fetch_socrata_state(sid, STATE_SOCRATA_URLS[sid], dry_run=dry_run)

    entry = FETCHER_MAP.get(sid)
    if not entry:
        print(f"  ⚠ No fetcher registered for {sid}")
        return None

    fn, needs_state, needs_start_date = entry
    args = []
    if needs_state:
        args.append(state_cd or "MD")
    if needs_start_date:
        args.append(start_date)
    return fn(*args, dry_run=dry_run)


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
    parser.add_argument("--segment", choices=["federal", "state", "noaa", "supplemental"], help="Fetch only this segment")
    parser.add_argument("--all-states", action="store_true", help="Fetch WQP for all 56 states/territories")
    parser.add_argument("--states", help="Comma-separated state abbreviations (e.g., MD,FL,CA)")
    parser.add_argument("--state", help="Single state abbreviation for --source (e.g., MD)")
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

                entry = FETCHER_MAP.get(sid)
                if entry and entry[1]:
                    # State-level source: iterate all states
                    for st_abbr in sorted(reg["wqp_states"].keys()):
                        df = dispatch_fetch(sid, state_cd=st_abbr, start_date=start_date, dry_run=args.dry_run)
                        if df is not None:
                            save_csv(df, f"{sid}-{st_abbr}")
                            fetched += 1
                        time.sleep(DELAY_BETWEEN_PULLS)
                    src["last_fetch"] = datetime.utcnow().isoformat() + "Z"
                    src["last_success"] = src["last_fetch"]
                elif sid in FETCHER_MAP or sid in STATE_SOCRATA_URLS:
                    # Non-state source (nationwide or catalog)
                    df = dispatch_fetch(sid, start_date=start_date, dry_run=args.dry_run)
                    if df is not None:
                        save_csv(df, sid)
                        fetched += 1
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

    # ── Source-by-ID mode ──
    if args.source:
        src_list = [s for s in reg["sources"] if s["id"] == args.source]
        if not src_list:
            print(f"  ❌ Unknown source: {args.source}")
            print(f"     Available: {', '.join(s['id'] for s in reg['sources'])}")
            save_registry(reg)
            return
        src = src_list[0]
        sid = src["id"]
        state_cd = args.state or "MD"

        if src["status"] == "dead":
            print(f"  ⏭  {sid}  DEAD — skipping (error_count={src['error_count']})")
            skipped += 1
        elif sid == "wqp-portal":
            print(f"  ⏭  wqp-portal: use --states or --all-states instead")
        elif sid == "epa-attains":
            print(f"  ⏭  epa-attains: already cached (51/51 states in lib/attainsCache.ts)")
            skipped += 1
        elif sid in FETCHER_MAP or sid in STATE_SOCRATA_URLS:
            df = dispatch_fetch(sid, state_cd=state_cd, start_date=start_date, dry_run=args.dry_run)
            if df is not None:
                csv_name = f"{sid}-{state_cd}" if FETCHER_MAP.get(sid, (None, False, False))[1] else sid
                save_csv(df, csv_name)
                src["last_fetch"] = datetime.utcnow().isoformat() + "Z"
                src["last_success"] = src["last_fetch"]
                src["error_count"] = 0
                fetched += 1
            elif not args.dry_run:
                src["error_count"] = src.get("error_count", 0) + 1
        else:
            print(f"  ⚠ No fetcher implemented for {sid}")

        save_registry(reg)
        print(f"\n  {'='*50}")
        print(f"  Fetched: {fetched}  |  Skipped: {skipped}  |  Output dir: {OUTPUT}\n")
        return

    # ── Segment mode: federal, state, noaa, supplemental ──
    if args.segment:
        segment_sources = [s for s in reg["sources"] if s["type"] == args.segment]
        state_cd = args.state or "MD"

        for src in sorted(segment_sources, key=lambda s: s["priority"]):
            if src["status"] == "dead":
                print(f"  ⏭  {src['id']:30s}  DEAD — skipping (error_count={src['error_count']})")
                skipped += 1
                continue

            sid = src["id"]
            if sid == "wqp-portal":
                continue
            elif sid == "epa-attains":
                print(f"  ⏭  epa-attains                     Already cached (51/51 states in lib/attainsCache.ts)")
                skipped += 1
                continue

            if sid in FETCHER_MAP or sid in STATE_SOCRATA_URLS:
                df = dispatch_fetch(sid, state_cd=state_cd, start_date=start_date, dry_run=args.dry_run)
                if df is not None:
                    csv_name = f"{sid}-{state_cd}" if FETCHER_MAP.get(sid, (None, False, False))[1] else sid
                    save_csv(df, csv_name)
                    src["last_fetch"] = datetime.utcnow().isoformat() + "Z"
                    src["last_success"] = src["last_fetch"]
                    src["error_count"] = 0
                    fetched += 1
                elif not args.dry_run:
                    src["error_count"] = src.get("error_count", 0) + 1
            else:
                print(f"  ⚠ No fetcher for {sid} — skipping")
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
