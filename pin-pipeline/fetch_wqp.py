#!/usr/bin/env python3
"""
==============================================================================
PIN Data Pipeline — WQP Fetcher (Region 3)
==============================================================================

Fetches water quality observations from the EPA Water Quality Portal for
Region 3 states (DE, DC, MD, PA, VA, WV) — core parameters only.

Outputs:
  - lib/wqp/stations/{state}.json     Station inventories per state
  - lib/wqp/summaries/{state}.json    State-level summary stats
  - lib/wqp/observations/{state}/     Observation files chunked by year
  - lib/wqp/exceedances/{state}.json  Threshold exceedance records
  - lib/wqp/fetch_log.json            Pipeline health / fetch history

Usage:
  python fetch_wqp.py                       # Full Region 3 fetch
  python fetch_wqp.py --state MD            # Single state
  python fetch_wqp.py --state MD --year 2024  # Single state + year
  python fetch_wqp.py --summary-only        # Station counts only (fast)
  python fetch_wqp.py --dry-run             # Show what would be fetched

Estimated volumes (Region 3, core params, last 5 years):
  MD: ~2.5M    VA: ~3.0M    PA: ~4.5M
  WV: ~0.8M    DE: ~0.5M    DC: ~0.2M
  Total: ~11.5M observations

Runtime: 2-6 hours for full backfill (WQP is slow). Incremental after that.

==============================================================================
"""

import os
import sys
import json
import csv
import io
import time
import logging
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode
from typing import Optional

try:
    import requests
except ImportError:
    print("pip install requests --break-system-packages")
    sys.exit(1)

# =============================================================================
# Configuration
# =============================================================================

WQP_BASE = "https://www.waterqualitydata.us"

# Region 3 states
REGION_3 = {
    "DE": {"fips": "US:10", "name": "Delaware"},
    "DC": {"fips": "US:11", "name": "District of Columbia"},
    "MD": {"fips": "US:24", "name": "Maryland"},
    "PA": {"fips": "US:42", "name": "Pennsylvania"},
    "VA": {"fips": "US:51", "name": "Virginia"},
    "WV": {"fips": "US:54", "name": "West Virginia"},
}

# Core parameters that drive impairment assessments
# These map to WQP CharacteristicName values (exact match required)
CORE_PARAMETERS = [
    "Dissolved oxygen (DO)",
    "pH",
    "Temperature, water",
    "Specific conductance",
    "Turbidity",
    "Total Nitrogen, mixed forms",
    "Nitrogen",
    "Nitrate",
    "Nitrite",
    "Ammonia",
    "Phosphorus",
    "Total suspended solids",
    "Escherichia coli",
    "Enterococcus",
    "Fecal Coliform",
    "Chlorophyll a",
    "Salinity",
    "Conductivity",
]

# Thresholds for exceedance detection (parameter → max acceptable value)
# These are general screening levels — state-specific criteria vary
EXCEEDANCE_THRESHOLDS = {
    "Dissolved oxygen (DO)": {"threshold": 5.0, "direction": "below", "unit": "mg/l"},
    "pH": {"threshold_low": 6.5, "threshold_high": 8.5, "direction": "range", "unit": "std units"},
    "Total Nitrogen, mixed forms": {"threshold": 3.0, "direction": "above", "unit": "mg/l"},
    "Nitrogen": {"threshold": 3.0, "direction": "above", "unit": "mg/l"},
    "Phosphorus": {"threshold": 0.1, "direction": "above", "unit": "mg/l"},
    "Total suspended solids": {"threshold": 25.0, "direction": "above", "unit": "mg/l"},
    "Escherichia coli": {"threshold": 410.0, "direction": "above", "unit": "MPN/100ml"},
    "Enterococcus": {"threshold": 130.0, "direction": "above", "unit": "MPN/100ml"},
    "Fecal Coliform": {"threshold": 400.0, "direction": "above", "unit": "CFU/100ml"},
    "Turbidity": {"threshold": 50.0, "direction": "above", "unit": "NTU"},
}

# How far back to pull observations (full backfill)
DEFAULT_YEARS_BACK = 5

# WQP request settings
REQUEST_TIMEOUT = 120  # seconds — WQP can be very slow
REQUEST_DELAY = 2.0    # seconds between requests — be a good citizen
MAX_RETRIES = 3
USER_AGENT = "PIN-Water-Intelligence/1.0 (pinwater.org; doug@pinwater.org)"

# Output directory (relative to project root)
OUTPUT_DIR = Path("lib/wqp")

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("wqp")


# =============================================================================
# WQP API Client
# =============================================================================

class WQPClient:
    """Low-level WQP API client with retry + rate limiting."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "text/csv",
        })
        self._last_request_time = 0.0

    def _rate_limit(self):
        """Ensure minimum delay between requests."""
        elapsed = time.time() - self._last_request_time
        if elapsed < REQUEST_DELAY:
            time.sleep(REQUEST_DELAY - elapsed)
        self._last_request_time = time.time()

    def fetch_csv(self, endpoint: str, params: dict) -> list[dict]:
        """
        Fetch CSV data from WQP and parse into list of dicts.
        Returns empty list on failure after retries.
        """
        params["mimeType"] = "csv"
        params["zip"] = "no"
        url = f"{WQP_BASE}/{endpoint}?{urlencode(params, doseq=True)}"

        for attempt in range(MAX_RETRIES):
            self._rate_limit()
            try:
                log.debug(f"  GET {endpoint} (attempt {attempt + 1})")
                resp = self.session.get(url, timeout=REQUEST_TIMEOUT)
                resp.raise_for_status()

                # Parse CSV
                reader = csv.DictReader(io.StringIO(resp.text))
                rows = list(reader)
                return rows

            except requests.exceptions.Timeout:
                log.warning(f"  Timeout on {endpoint} (attempt {attempt + 1}/{MAX_RETRIES})")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(5 * (attempt + 1))
            except requests.exceptions.HTTPError as e:
                log.error(f"  HTTP {e.response.status_code} on {endpoint}: {e}")
                if e.response.status_code == 400:
                    return []  # Bad request — don't retry
                if attempt < MAX_RETRIES - 1:
                    time.sleep(5 * (attempt + 1))
            except Exception as e:
                log.error(f"  Error on {endpoint}: {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(5 * (attempt + 1))

        log.error(f"  Failed after {MAX_RETRIES} attempts: {endpoint}")
        return []

    def fetch_stations(self, statecode: str) -> list[dict]:
        """Fetch all monitoring stations in a state."""
        return self.fetch_csv("data/Station/search", {
            "statecode": statecode,
            "sampleMedia": "Water",
        })

    def fetch_results(self, statecode: str, year: int,
                      parameters: list[str] = None) -> list[dict]:
        """
        Fetch observation results for a state + year + core parameters.
        Chunked by year to avoid WQP timeouts on large queries.
        """
        params = {
            "statecode": statecode,
            "startDateLo": f"01-01-{year}",
            "startDateHi": f"12-31-{year}",
            "sampleMedia": "Water",
            "dataProfile": "narrowResult",
            "sorted": "no",
        }
        if parameters:
            params["characteristicName"] = parameters

        return self.fetch_csv("data/Result/search", params)

    def fetch_summary(self, statecode: str) -> list[dict]:
        """
        Fetch summary (station counts) for a state. Fast endpoint.
        No raw observations — just station locations + result counts.
        """
        return self.fetch_csv("data/summary/monitoringLocation/search", {
            "statecode": statecode,
            "sampleMedia": "Water",
        })


# =============================================================================
# Data Processors
# =============================================================================

def process_stations(raw_stations: list[dict], state_code: str) -> list[dict]:
    """Normalize raw WQP station records to PIN format."""
    stations = []
    for r in raw_stations:
        try:
            stations.append({
                "id": r.get("MonitoringLocationIdentifier", ""),
                "name": r.get("MonitoringLocationName", ""),
                "type": r.get("MonitoringLocationTypeName", ""),
                "lat": safe_float(r.get("LatitudeMeasure")),
                "lon": safe_float(r.get("LongitudeMeasure")),
                "huc8": r.get("HUCEightDigitCode", ""),
                "state": state_code,
                "county": r.get("CountyName", ""),
                "orgId": r.get("OrganizationIdentifier", ""),
                "orgName": r.get("OrganizationFormalName", ""),
                "resultCount": 0,  # Will be enriched from summary
                "lastSampleDate": None,
            })
        except Exception as e:
            log.debug(f"  Skipping bad station record: {e}")
    return stations


def process_observations(raw_results: list[dict]) -> list[dict]:
    """Normalize raw WQP result records to PIN observation format."""
    observations = []
    for r in raw_results:
        value = safe_float(r.get("ResultMeasureValue"))
        if value is None:
            continue  # Skip non-detects and blanks for now

        observations.append({
            "stationId": r.get("MonitoringLocationIdentifier", ""),
            "date": r.get("ActivityStartDate", ""),
            "parameter": r.get("CharacteristicName", ""),
            "value": value,
            "unit": r.get("ResultMeasure/MeasureUnitCode", ""),
            "status": r.get("ResultStatusIdentifier", ""),
            "detection": r.get("DetectionQuantitationLimitTypeName"),
            "detectionLimit": safe_float(
                r.get("DetectionQuantitationLimitMeasure/MeasureValue")
            ),
        })
    return observations


def detect_exceedances(observations: list[dict]) -> list[dict]:
    """Flag observations that exceed screening thresholds."""
    exceedances = []
    for obs in observations:
        param = obs["parameter"]
        value = obs["value"]
        if value is None or param not in EXCEEDANCE_THRESHOLDS:
            continue

        config = EXCEEDANCE_THRESHOLDS[param]
        exceeded = False
        threshold = None

        if config["direction"] == "above":
            threshold = config["threshold"]
            exceeded = value > threshold
        elif config["direction"] == "below":
            threshold = config["threshold"]
            exceeded = value < threshold
        elif config["direction"] == "range":
            if value < config["threshold_low"]:
                threshold = config["threshold_low"]
                exceeded = True
            elif value > config["threshold_high"]:
                threshold = config["threshold_high"]
                exceeded = True

        if exceeded and threshold:
            pct = abs(value - threshold) / threshold if threshold != 0 else 0
            exceedances.append({
                "stationId": obs["stationId"],
                "date": obs["date"],
                "parameter": param,
                "value": value,
                "unit": obs["unit"] or config.get("unit", ""),
                "threshold": threshold,
                "percentOver": round(pct, 4),
            })

    return exceedances


def build_state_summary(state_code: str, state_name: str,
                        stations: list[dict],
                        all_observations: list[dict],
                        exceedances: list[dict]) -> dict:
    """Build state-level summary for state cards."""
    orgs = set()
    param_counts: dict[str, int] = {}
    dates = []

    for obs in all_observations:
        p = obs["parameter"]
        param_counts[p] = param_counts.get(p, 0) + 1
        if obs.get("date"):
            dates.append(obs["date"])

    for s in stations:
        if s.get("orgId"):
            orgs.add(s["orgId"])

    dates_sorted = sorted(dates) if dates else []

    # Top 10 stations by observation count
    station_obs_count: dict[str, int] = {}
    for obs in all_observations:
        sid = obs["stationId"]
        station_obs_count[sid] = station_obs_count.get(sid, 0) + 1

    station_map = {s["id"]: s for s in stations}
    top_station_ids = sorted(station_obs_count, key=station_obs_count.get, reverse=True)[:10]
    top_stations = []
    for sid in top_station_ids:
        if sid in station_map:
            s = station_map[sid].copy()
            s["resultCount"] = station_obs_count[sid]
            top_stations.append(s)

    return {
        "stateCode": state_code,
        "stateName": state_name,
        "stationCount": len(stations),
        "observationCount": len(all_observations),
        "exceedanceCount": len(exceedances),
        "organizations": sorted(orgs),
        "parameterCoverage": dict(sorted(param_counts.items(), key=lambda x: -x[1])),
        "dateRange": {
            "earliest": dates_sorted[0] if dates_sorted else None,
            "latest": dates_sorted[-1] if dates_sorted else None,
        },
        "topStations": top_stations,
        "generatedAt": datetime.now(tz=__import__("datetime").timezone.utc).isoformat() + "Z",
    }


# =============================================================================
# File Writers
# =============================================================================

def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, data, indent=2):
    """Write JSON with count logging."""
    with open(path, "w") as f:
        json.dump(data, f, indent=indent, default=str)
    size_kb = path.stat().st_size / 1024
    log.info(f"  Wrote {path} ({size_kb:.0f} KB)")


def write_observations_chunked(state_code: str, year: int,
                                observations: list[dict], base_dir: Path):
    """Write observations to year-chunked files."""
    obs_dir = base_dir / "observations" / state_code.lower()
    ensure_dir(obs_dir)
    path = obs_dir / f"{year}.json"
    write_json(path, observations, indent=None)  # No indent for data files — smaller


# =============================================================================
# Main Fetch Pipeline
# =============================================================================

def fetch_state(client: WQPClient, state_code: str, state_info: dict,
                years_back: int = DEFAULT_YEARS_BACK,
                target_year: Optional[int] = None,
                summary_only: bool = False,
                dry_run: bool = False,
                base_dir: Path = OUTPUT_DIR) -> dict:
    """
    Fetch all WQP data for a single state.
    Returns fetch result dict for the health log.
    """
    fips = state_info["fips"]
    name = state_info["name"]
    start_time = time.time()

    log.info(f"{'[DRY RUN] ' if dry_run else ''}Fetching {state_code} ({name})")

    result = {
        "stateCode": state_code,
        "stateName": name,
        "startedAt": datetime.now(tz=__import__("datetime").timezone.utc).isoformat() + "Z",
        "stationsFound": 0,
        "observationsFetched": 0,
        "exceedancesFound": 0,
        "errors": [],
        "yearsFetched": [],
    }

    # ── Step 1: Stations ──
    log.info(f"  [{state_code}] Fetching stations...")
    if dry_run:
        log.info(f"  [{state_code}] Would fetch stations from {fips}")
        return result

    raw_stations = client.fetch_stations(fips)
    stations = process_stations(raw_stations, state_code)
    result["stationsFound"] = len(stations)
    log.info(f"  [{state_code}] Found {len(stations)} stations")

    # Write stations
    stations_dir = base_dir / "stations"
    ensure_dir(stations_dir)
    write_json(stations_dir / f"{state_code.lower()}.json", stations)

    if summary_only:
        # Build minimal summary without fetching observations
        summary = build_state_summary(state_code, name, stations, [], [])
        summaries_dir = base_dir / "summaries"
        ensure_dir(summaries_dir)
        write_json(summaries_dir / f"{state_code.lower()}.json", summary)
        result["durationMs"] = int((time.time() - start_time) * 1000)
        return result

    # ── Step 2: Observations by year ──
    current_year = datetime.now().year
    if target_year:
        years = [target_year]
    else:
        years = list(range(current_year - years_back + 1, current_year + 1))

    all_observations = []
    all_exceedances = []

    for year in years:
        log.info(f"  [{state_code}] Fetching {year} observations...")
        raw_results = client.fetch_results(fips, year, CORE_PARAMETERS)

        if not raw_results:
            log.warning(f"  [{state_code}] No results for {year}")
            result["errors"].append(f"No results for {year}")
            continue

        observations = process_observations(raw_results)
        exceedances = detect_exceedances(observations)

        log.info(
            f"  [{state_code}] {year}: {len(observations)} observations, "
            f"{len(exceedances)} exceedances"
        )

        # Write year chunk
        write_observations_chunked(state_code, year, observations, base_dir)

        all_observations.extend(observations)
        all_exceedances.extend(exceedances)
        result["yearsFetched"].append(year)

    result["observationsFetched"] = len(all_observations)
    result["exceedancesFound"] = len(all_exceedances)

    # ── Step 3: Exceedances ──
    if all_exceedances:
        exc_dir = base_dir / "exceedances"
        ensure_dir(exc_dir)
        write_json(exc_dir / f"{state_code.lower()}.json", all_exceedances)

    # ── Step 4: State summary ──
    summary = build_state_summary(
        state_code, name, stations, all_observations, all_exceedances
    )
    summaries_dir = base_dir / "summaries"
    ensure_dir(summaries_dir)
    write_json(summaries_dir / f"{state_code.lower()}.json", summary)

    # ── Step 5: Enrich station result counts ──
    station_obs = {}
    station_dates = {}
    for obs in all_observations:
        sid = obs["stationId"]
        station_obs[sid] = station_obs.get(sid, 0) + 1
        d = obs.get("date", "")
        if d and (sid not in station_dates or d > station_dates[sid]):
            station_dates[sid] = d

    for s in stations:
        s["resultCount"] = station_obs.get(s["id"], 0)
        s["lastSampleDate"] = station_dates.get(s["id"])

    # Re-write stations with enriched counts
    write_json(stations_dir / f"{state_code.lower()}.json", stations)

    duration = time.time() - start_time
    result["durationMs"] = int(duration * 1000)
    result["completedAt"] = datetime.now(tz=__import__("datetime").timezone.utc).isoformat() + "Z"

    log.info(
        f"  [{state_code}] Done: {len(stations)} stations, "
        f"{len(all_observations)} observations, "
        f"{len(all_exceedances)} exceedances in {duration:.1f}s"
    )

    return result


def run_pipeline(states: dict[str, dict], years_back: int,
                 target_year: Optional[int], target_state: Optional[str],
                 summary_only: bool, dry_run: bool,
                 base_dir: Path):
    """Run the full fetch pipeline."""
    client = WQPClient()
    ensure_dir(base_dir)

    # Filter states if --state was specified
    if target_state:
        key = target_state.upper()
        if key not in states:
            log.error(f"Unknown state: {key}. Available: {', '.join(states.keys())}")
            sys.exit(1)
        states = {key: states[key]}

    log.info("=" * 60)
    log.info("PIN WQP Pipeline — Region 3")
    log.info(f"States: {', '.join(states.keys())}")
    log.info(f"Years back: {years_back}")
    log.info(f"Parameters: {len(CORE_PARAMETERS)} core")
    if summary_only:
        log.info("Mode: SUMMARY ONLY (no observations)")
    if dry_run:
        log.info("Mode: DRY RUN")
    log.info("=" * 60)

    results = []
    total_start = time.time()

    for state_code, state_info in states.items():
        try:
            result = fetch_state(
                client, state_code, state_info,
                years_back=years_back,
                target_year=target_year,
                summary_only=summary_only,
                dry_run=dry_run,
                base_dir=base_dir,
            )
            results.append(result)
        except Exception as e:
            log.error(f"FAILED on {state_code}: {e}")
            results.append({
                "stateCode": state_code,
                "error": str(e),
            })

    # Write fetch log
    total_duration = time.time() - total_start
    fetch_log = {
        "pipeline": "wqp_region3",
        "runAt": datetime.now(tz=__import__("datetime").timezone.utc).isoformat() + "Z",
        "durationSeconds": round(total_duration, 1),
        "stateResults": results,
        "totals": {
            "stations": sum(r.get("stationsFound", 0) for r in results),
            "observations": sum(r.get("observationsFetched", 0) for r in results),
            "exceedances": sum(r.get("exceedancesFound", 0) for r in results),
            "errors": sum(len(r.get("errors", [])) for r in results),
        },
    }

    if not dry_run:
        write_json(base_dir / "fetch_log.json", fetch_log)

    log.info("=" * 60)
    log.info(f"COMPLETE in {total_duration:.1f}s")
    log.info(f"  Stations:     {fetch_log['totals']['stations']:,}")
    log.info(f"  Observations: {fetch_log['totals']['observations']:,}")
    log.info(f"  Exceedances:  {fetch_log['totals']['exceedances']:,}")
    log.info(f"  Errors:       {fetch_log['totals']['errors']}")
    log.info("=" * 60)


# =============================================================================
# Helpers
# =============================================================================

def safe_float(val) -> Optional[float]:
    """Safely convert a value to float, returning None on failure."""
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="PIN WQP Fetcher — Region 3 water quality data pipeline"
    )
    parser.add_argument(
        "--state", type=str, default=None,
        help="Fetch single state (e.g., MD, VA). Default: all Region 3."
    )
    parser.add_argument(
        "--year", type=int, default=None,
        help="Fetch single year only. Default: last 5 years."
    )
    parser.add_argument(
        "--years-back", type=int, default=DEFAULT_YEARS_BACK,
        help=f"How many years to fetch. Default: {DEFAULT_YEARS_BACK}."
    )
    parser.add_argument(
        "--summary-only", action="store_true",
        help="Fetch station inventories only, skip observations."
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be fetched without making API calls."
    )
    parser.add_argument(
        "--output-dir", type=str, default=str(OUTPUT_DIR),
        help=f"Output directory. Default: {OUTPUT_DIR}"
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Enable debug logging."
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger("wqp").setLevel(logging.DEBUG)

    run_pipeline(
        states=REGION_3,
        years_back=args.years_back,
        target_year=args.year,
        target_state=args.state,
        summary_only=args.summary_only,
        dry_run=args.dry_run,
        base_dir=Path(args.output_dir),
    )


if __name__ == "__main__":
    main()
