#!/usr/bin/env python3
"""
PEARL Station Discovery v3 — Python Data Pipeline

Discovers ALL active water quality monitoring stations per state from:
  1. USGS Water Services (real-time gauges with WQ params)
  2. WQP (state, tribal, local providers via STORET/STEWARDS)

Outputs:
  lib/station-registry.json  — consumed by Next.js at build time
  lib/station-registry.ts    — TypeScript wrapper with types

Usage:
  python scripts/discover_stations.py
  python scripts/discover_stations.py --state US:49
  python scripts/discover_stations.py --max-per-state 20
  python scripts/discover_stations.py --dry-run
"""

import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests --quiet")
    import requests

try:
    import pandas as pd
except ImportError:
    print("Installing pandas...")
    os.system(f"{sys.executable} -m pip install pandas --quiet")
    import pandas as pd

from io import StringIO

# ─── Configuration ──────────────────────────────────────────────────────────

MAX_PER_STATE = 15
RATE_LIMIT_SEC = 0.4
USGS_LOOKBACK_MONTHS = 24
WQP_LOOKBACK_MONTHS = 36
REQUEST_TIMEOUT = 30

USGS_WQ_PARAMS = ['00300', '00010', '00400', '00665', '00600', '00530', '63680', '00095']

PARAM_NAMES = {
    '00300': 'Dissolved Oxygen',
    '00010': 'Temperature',
    '00400': 'pH',
    '00665': 'Phosphorus',
    '00600': 'Nitrogen',
    '00530': 'TSS',
    '63680': 'Turbidity',
    '00095': 'Specific Conductance',
}

ALL_STATES = {
    'US:01': ('01', 'Alabama'),
    'US:02': ('02', 'Alaska'),
    'US:04': ('04', 'Arizona'),
    'US:05': ('05', 'Arkansas'),
    'US:06': ('06', 'California'),
    'US:08': ('08', 'Colorado'),
    'US:09': ('09', 'Connecticut'),
    'US:10': ('10', 'Delaware'),
    'US:11': ('11', 'District of Columbia'),
    'US:12': ('12', 'Florida'),
    'US:13': ('13', 'Georgia'),
    'US:15': ('15', 'Hawaii'),
    'US:16': ('16', 'Idaho'),
    'US:17': ('17', 'Illinois'),
    'US:18': ('18', 'Indiana'),
    'US:19': ('19', 'Iowa'),
    'US:20': ('20', 'Kansas'),
    'US:21': ('21', 'Kentucky'),
    'US:22': ('22', 'Louisiana'),
    'US:23': ('23', 'Maine'),
    'US:24': ('24', 'Maryland'),
    'US:25': ('25', 'Massachusetts'),
    'US:26': ('26', 'Michigan'),
    'US:27': ('27', 'Minnesota'),
    'US:28': ('28', 'Mississippi'),
    'US:29': ('29', 'Missouri'),
    'US:30': ('30', 'Montana'),
    'US:31': ('31', 'Nebraska'),
    'US:32': ('32', 'Nevada'),
    'US:33': ('33', 'New Hampshire'),
    'US:34': ('34', 'New Jersey'),
    'US:35': ('35', 'New Mexico'),
    'US:36': ('36', 'New York'),
    'US:37': ('37', 'North Carolina'),
    'US:38': ('38', 'North Dakota'),
    'US:39': ('39', 'Ohio'),
    'US:40': ('40', 'Oklahoma'),
    'US:41': ('41', 'Oregon'),
    'US:42': ('42', 'Pennsylvania'),
    'US:44': ('44', 'Rhode Island'),
    'US:45': ('45', 'South Carolina'),
    'US:46': ('46', 'South Dakota'),
    'US:47': ('47', 'Tennessee'),
    'US:48': ('48', 'Texas'),
    'US:49': ('49', 'Utah'),
    'US:50': ('50', 'Vermont'),
    'US:51': ('51', 'Virginia'),
    'US:53': ('53', 'Washington'),
    'US:54': ('54', 'West Virginia'),
    'US:55': ('55', 'Wisconsin'),
    'US:56': ('56', 'Wyoming'),
}


# ─── Helpers ────────────────────────────────────────────────────────────────

def clean_waterbody_name(raw: str) -> str:
    """
    Clean USGS station names into readable waterbody names.
    'JONES FALLS AT STN MERRYMAN LA, BALTIMORE' → 'Jones Falls'
    """
    name = raw.strip()

    # Split at location descriptors — keep the waterbody part
    for sep in [' AT ', ' NR ', ' NEAR ', ' ABV ', ' ABOVE ', ' BLW ', ' BELOW ', ' @ ', ', ']:
        idx = name.upper().find(sep)
        if idx > 3:
            name = name[:idx]
            break

    # Expand common abbreviations
    abbrevs = {
        r'\bCR\b\.?': 'Creek',
        r'\bRV?\b\.?': 'River',
        r'\bBR\b\.?': 'Branch',
        r'\bFK\b\.?': 'Fork',
        r'\bLK\b\.?': 'Lake',
        r'\bMT\b\.?': 'Mount',
        r'\bFT\b\.?': 'Fort',
        r'\bST\b\.?': 'St.',
        r'\bN\b\.?': 'North',
        r'\bS\b\.?': 'South',
        r'\bE\b\.?': 'East',
        r'\bW\b\.?': 'West',
    }
    for pattern, replacement in abbrevs.items():
        name = re.sub(pattern, replacement, name, flags=re.IGNORECASE)

    # Title case
    name = name.strip().title()

    # Remove trailing state abbreviations or numbers
    name = re.sub(r',?\s+[A-Z]{2}\s*$', '', name, flags=re.IGNORECASE).strip()
    name = re.sub(r'\s+\d+$', '', name).strip()

    return name if len(name) >= 3 else raw.strip().title()


def make_region_id(state_name: str, waterbody_name: str) -> str:
    """Generate a region ID: 'Utah', 'Jordan River' → 'utah_jordan_river'"""
    state = re.sub(r'\s+', '', state_name.lower())
    wb = re.sub(r'[^a-z0-9\s]', '', waterbody_name.lower())
    wb = re.sub(r'\s+', '_', wb).strip('_')
    return f"{state}_{wb}"


def fetch_rdb(url: str) -> pd.DataFrame:
    """Fetch USGS RDB (tab-separated) format and return as DataFrame."""
    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        # Skip comment lines starting with #
        lines = [l for l in resp.text.strip().split('\n') if not l.startswith('#')]
        if len(lines) < 3:
            return pd.DataFrame()
        # Line 0 = headers, line 1 = format descriptors, line 2+ = data
        header = lines[0]
        data_lines = lines[2:]  # Skip format line
        csv_text = header + '\n' + '\n'.join(data_lines)
        return pd.read_csv(StringIO(csv_text), sep='\t', dtype=str, on_bad_lines='skip')
    except Exception as e:
        print(f"    ⚠ RDB fetch error: {str(e)[:80]}")
        return pd.DataFrame()


def fetch_csv(url: str, timeout: int = REQUEST_TIMEOUT) -> pd.DataFrame:
    """Fetch CSV from URL and return as DataFrame."""
    try:
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        return pd.read_csv(StringIO(resp.text), dtype=str, on_bad_lines='skip')
    except Exception as e:
        print(f"    ⚠ CSV fetch error: {str(e)[:80]}")
        return pd.DataFrame()


# ─── USGS Queries ───────────────────────────────────────────────────────────

def find_usgs_wq_sites(state_fips: str) -> list[dict]:
    """Find all active USGS gauges with WQ parameters in a state."""
    url = (
        f"https://waterservices.usgs.gov/nwis/site?format=rdb"
        f"&stateCd={state_fips}"
        f"&siteType=ST,LK,ES"
        f"&siteStatus=active"
        f"&hasDataTypeCd=iv"
        f"&parameterCd={','.join(USGS_WQ_PARAMS)}"
    )
    df = fetch_rdb(url)
    if df.empty:
        return []

    sites = []
    for _, row in df.iterrows():
        try:
            lat = float(row.get('dec_lat_va', ''))
            lng = float(row.get('dec_long_va', ''))
        except (ValueError, TypeError):
            continue

        site_id = str(row.get('site_no', '')).strip()
        raw_name = str(row.get('station_nm', '')).strip()
        huc = str(row.get('huc_cd', '')).strip()
        site_type = str(row.get('site_tp_cd', 'ST')).strip()

        if not site_id or not raw_name:
            continue

        sites.append({
            'siteId': site_id,
            'rawName': raw_name,
            'waterbodyName': clean_waterbody_name(raw_name),
            'lat': round(lat, 4),
            'lng': round(lng, 4),
            'source': 'USGS',
            'siteType': site_type,
            'huc8': huc[:8] if len(huc) >= 8 else huc,
            'wqParamCount': 0,
            'wqParams': [],
        })

    return sites


def score_usgs_site(site_id: str) -> tuple[int, list[str]]:
    """Get WQ parameter count for a USGS site (data richness score)."""
    url = (
        f"https://waterservices.usgs.gov/nwis/site?format=rdb"
        f"&sites={site_id}"
        f"&seriesCatalogOutput=true"
        f"&outputDataTypeCd=iv"
    )
    df = fetch_rdb(url)
    if df.empty or 'parm_cd' not in df.columns:
        return 0, []

    wq_params = [p for p in df['parm_cd'].unique() if p in USGS_WQ_PARAMS]
    return len(wq_params), wq_params


# ─── WQP Queries ────────────────────────────────────────────────────────────

def find_wqp_sites(state_code: str, organization: Optional[str] = None) -> list[dict]:
    """Find WQP stations (state/tribal/local) with recent data in a state.
    If organization is set (e.g., 'CEDEN'), filters to that org and allows all site types.
    """
    lookback = datetime.now() - timedelta(days=WQP_LOOKBACK_MONTHS * 30)
    start_date = lookback.strftime('%m-%d-%Y')  # WQP requires MM-DD-YYYY

    # Build URL manually — WQP is picky about encoding
    sc = state_code.replace(':', '%3A')  # US:32 → US%3A32
    if organization:
        # Organization-specific query: skip providers/sampleMedia/siteType filters
        # (they can conflict with org filter and cause 500 errors)
        url = (
            f"https://www.waterqualitydata.us/data/Station/search"
            f"?statecode={sc}"
            f"&organization={organization}"
            f"&mimeType=csv"
            f"&zip=no"
            f"&sorted=no"
        )
    else:
        url = (
            f"https://www.waterqualitydata.us/data/Station/search"
            f"?statecode={sc}"
            f"&startDateLo={start_date}"
            f"&siteType=Stream"
            f"&sampleMedia=Water"
            f"&providers=STORET"
            f"&providers=STEWARDS"
            f"&mimeType=csv"
            f"&zip=no"
        )

    try:
        print(f"\n    WQP URL: {url[:150]}")
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        df = pd.read_csv(StringIO(resp.text), dtype=str, on_bad_lines='skip')
    except Exception as e:
        # Retry with just STORET (simpler query)
        print(f"    ⚠ WQP attempt 1 failed ({str(e)[:50]}), retrying simpler query...")
        try:
            if organization:
                url_retry = (
                    f"https://www.waterqualitydata.us/data/Station/search"
                    f"?statecode={sc}"
                    f"&organization={organization}"
                    f"&mimeType=csv"
                    f"&zip=no"
                )
            else:
                url_retry = (
                    f"https://www.waterqualitydata.us/data/Station/search"
                    f"?statecode={sc}"
                    f"&siteType=Stream"
                    f"&sampleMedia=Water"
                    f"&providers=STORET"
                    f"&mimeType=csv"
                    f"&zip=no"
                )
            resp = requests.get(url_retry, timeout=60)
            resp.raise_for_status()
            df = pd.read_csv(StringIO(resp.text), dtype=str, on_bad_lines='skip')
        except Exception as e2:
            print(f"    ⚠ WQP error: {str(e2)[:80]}")
            return []
        resp.raise_for_status()
        df = pd.read_csv(StringIO(resp.text), dtype=str, on_bad_lines='skip')
    except Exception as e:
        print(f"    ⚠ WQP error: {str(e)[:80]}")
        return []

    if df.empty:
        return []

    sites = []
    for _, row in df.iterrows():
        try:
            lat = float(row.get('LatitudeMeasure', ''))
            lng = float(row.get('LongitudeMeasure', ''))
        except (ValueError, TypeError):
            continue

        loc_id = str(row.get('MonitoringLocationIdentifier', '')).strip()
        loc_name = str(row.get('MonitoringLocationName', '')).strip()
        org_id = str(row.get('OrganizationIdentifier', '')).strip()
        huc = str(row.get('HUCEightDigitCode', '')).strip()
        site_type_raw = str(row.get('MonitoringLocationTypeName', '')).strip()

        # Skip USGS (we get those from USGS API)
        if loc_id.startswith('USGS-') or loc_id.startswith('NWIS-'):
            continue
        if not loc_id or not loc_name:
            continue

        # Map site type
        if 'Stream' in site_type_raw:
            site_type = 'ST'
        elif 'Lake' in site_type_raw or 'Reservoir' in site_type_raw:
            site_type = 'LK'
        else:
            site_type = 'ES'

        sites.append({
            'siteId': loc_id,
            'rawName': loc_name or loc_id,
            'waterbodyName': clean_waterbody_name(loc_name) if loc_name else loc_id,
            'lat': round(lat, 4),
            'lng': round(lng, 4),
            'source': 'WQP',
            'provider': org_id,
            'siteType': site_type,
            'huc8': huc[:8] if len(huc) >= 8 else huc,
            'wqParamCount': 1,  # Default score — USGS with actual param counts should rank higher
            'wqParams': [],
        })

    return sites


# ─── Ranking & Dedup ────────────────────────────────────────────────────────

def rank_and_dedup(
    usgs_sites: list[dict],
    wqp_sites: list[dict],
    state_name: str,
    max_per_state: int,
) -> list[dict]:
    """
    Merge USGS + WQP, deduplicate by proximity, rank by data richness,
    and return top N per state with generated region IDs.
    """
    all_sites = usgs_sites + wqp_sites

    # Deduplicate: group stations within ~1 mile OR with same waterbody name
    groups: list[list[dict]] = []
    used = set()

    for i, site_a in enumerate(all_sites):
        if i in used:
            continue
        group = [site_a]
        used.add(i)

        for j, site_b in enumerate(all_sites):
            if j in used or j <= i:
                continue
            d_lat = abs(site_a['lat'] - site_b['lat'])
            d_lng = abs(site_a['lng'] - site_b['lng'])
            same_name = site_a['waterbodyName'].lower() == site_b['waterbodyName'].lower()
            # Group if within ~1 mile OR same waterbody name within ~30 miles
            if (d_lat < 0.015 and d_lng < 0.015) or (same_name and d_lat < 0.5 and d_lng < 0.5):
                group.append(site_b)
                used.add(j)

        groups.append(group)

    # Pick best from each group
    best = []
    for group in groups:
        # Sort: USGS first, then by param count
        group.sort(key=lambda s: (0 if s['source'] == 'USGS' else 1, -s['wqParamCount']))
        winner = group[0].copy()

        # If group has WQP entry, note the provider
        wqp_entry = next((s for s in group if s['source'] == 'WQP'), None)
        if wqp_entry and winner['source'] == 'USGS':
            winner['wqpProvider'] = wqp_entry.get('provider', '')
            winner['wqpSiteId'] = wqp_entry.get('siteId', '')

        best.append(winner)

    # Sort by richness
    best.sort(key=lambda s: -s['wqParamCount'])

    # Generate unique region IDs
    used_ids = set()
    result = []

    for site in best[:max_per_state]:
        region_id = make_region_id(state_name, site['waterbodyName'])

        # Handle duplicate names
        if region_id in used_ids:
            region_id += f"_{site['siteType'].lower()}"
        if region_id in used_ids:
            region_id += f"_{site['siteId'][-4:]}"

        used_ids.add(region_id)
        site['regionId'] = region_id
        result.append(site)

    return result


# ─── Output Generation ──────────────────────────────────────────────────────

def generate_json(all_stations: dict[str, list[dict]]) -> dict:
    """Generate the station-registry.json structure."""
    registry = {
        '_meta': {
            'generated': datetime.now().isoformat(),
            'generator': 'discover_stations.py v3',
            'totalWaterbodies': sum(len(v) for v in all_stations.values()),
            'stateCount': len(all_stations),
        },
        'regions': {},
        'usgsSiteMap': {},
        'wqpStationMap': {},
        'coverage': {},
    }

    for state_code, stations in sorted(all_stations.items()):
        for s in stations:
            rid = s['regionId']

            # Region metadata
            registry['regions'][rid] = {
                'lat': s['lat'],
                'lng': s['lng'],
                'huc8': s['huc8'],
                'stateCode': state_code,
                'name': s['waterbodyName'],
            }

            # USGS site map
            if s['source'] == 'USGS':
                registry['usgsSiteMap'][rid] = s['siteId']

            # WQP station map
            if s['source'] == 'WQP':
                registry['wqpStationMap'][rid] = {
                    'siteId': s['siteId'],
                    'provider': s.get('provider', ''),
                    'name': s['waterbodyName'],
                }
            elif s.get('wqpSiteId'):
                registry['wqpStationMap'][rid] = {
                    'siteId': s['wqpSiteId'],
                    'provider': s.get('wqpProvider', ''),
                    'name': s['waterbodyName'],
                }

            # Coverage
            sources = []
            if s['source'] == 'USGS':
                sources.extend(['USGS_IV', 'USGS_QW'])
            if s['source'] == 'WQP' or s.get('wqpSiteId'):
                sources.append('WQP')
            registry['coverage'][rid] = {
                'hasData': True,
                'sources': sources,
                'wqParams': s.get('wqParams', []),
                'paramCount': s['wqParamCount'],
            }

    return registry


def generate_ts_wrapper(json_path: str) -> str:
    """Generate a TypeScript wrapper that imports and re-exports the JSON."""
    return f"""// lib/station-registry.ts
// AUTO-GENERATED — do not edit manually
// Re-run: python scripts/discover_stations.py
// Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}

import registryData from './station-registry.json';

export interface RegionMeta {{
  lat: number;
  lng: number;
  huc8: string;
  stateCode: string;
  name: string;
}}

export interface WqpStationInfo {{
  siteId: string;
  provider: string;
  name: string;
}}

export interface CoverageInfo {{
  hasData: boolean;
  sources: string[];
  wqParams: string[];
  paramCount: number;
}}

// Typed exports from the JSON registry
export const REGION_META: Record<string, RegionMeta> = registryData.regions as any;
export const USGS_SITE_MAP: Record<string, string> = registryData.usgsSiteMap as any;
export const WQP_STATION_MAP: Record<string, WqpStationInfo> = registryData.wqpStationMap as any;
export const COVERAGE_MAP: Record<string, CoverageInfo> = registryData.coverage as any;

/** Check if a waterbody has confirmed monitoring data */
export function hasConfirmedData(regionId: string): boolean {{
  return COVERAGE_MAP[regionId]?.hasData ?? false;
}}

/** Get all waterbody IDs with confirmed data */
export function getWaterbodiesWithData(): string[] {{
  return Object.keys(COVERAGE_MAP);
}}

/** Get waterbodies for a specific state, sorted by name */
export function getWaterbodiesByState(stateCode: string): {{ id: string; name: string }}[] {{
  return Object.entries(REGION_META)
    .filter(([_, meta]) => meta.stateCode === stateCode)
    .map(([id, meta]) => ({{ id, name: meta.name }}))
    .sort((a, b) => a.name.localeCompare(b.name));
}}

/** Get all states that have confirmed waterbody data */
export function getStatesWithData(): {{ code: string; count: number }}[] {{
  const states = new Map<string, number>();
  for (const meta of Object.values(REGION_META)) {{
    states.set(meta.stateCode, (states.get(meta.stateCode) || 0) + 1);
  }}
  return Array.from(states.entries())
    .map(([code, count]) => ({{ code, count }}))
    .sort((a, b) => a.code.localeCompare(b.code));
}}
"""


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='PEARL Station Discovery v3')
    parser.add_argument('--state', help='Filter to one state (e.g., US:49)')
    parser.add_argument('--max-per-state', type=int, default=MAX_PER_STATE)
    parser.add_argument('--organization', help='WQP organization filter (e.g., CEDEN). Skips USGS, allows all site types.')
    parser.add_argument('--append', action='store_true', help='Append to existing public/data/station-registry.json instead of regenerating')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--verbose', action='store_true')
    args = parser.parse_args()

    # When filtering by organization, raise per-state limit unless explicitly set
    if args.organization and args.max_per_state == MAX_PER_STATE:
        args.max_per_state = 9999

    print('🔍 PEARL Station Discovery v3 — Python')
    print('══════════════════════════════════════════════════════════')
    if args.organization:
        print(f'🏢 Organization filter: {args.organization}')
    if args.append:
        print(f'📎 Append mode: will merge into existing registry')
    print(f'📊 Max {args.max_per_state} waterbodies per state')

    states = dict(ALL_STATES)
    if args.state:
        if args.state not in states:
            print(f'❌ Unknown state: {args.state}')
            sys.exit(1)
        states = {args.state: states[args.state]}
        print(f'🔎 Filtering to: {args.state}')

    print(f'🏛️  {len(states)} states to query\n')

    if args.dry_run:
        for code, (fips, name) in states.items():
            print(f'  {code} {name} (FIPS: {fips})')
        return

    all_stations: dict[str, list[dict]] = {}
    total_wb = 0
    total_usgs = 0
    total_wqp = 0

    for state_code, (fips, state_name) in states.items():
        print(f'\n── {state_name} ({state_code}) ──')

        usgs_with_wq = []
        if not args.organization:
            # 1. USGS: all active WQ gauges (skip when filtering by org)
            print('  USGS IV gauges... ', end='', flush=True)
            usgs_sites = find_usgs_wq_sites(fips)
            print(f'{len(usgs_sites)} found')
            time.sleep(RATE_LIMIT_SEC)

            # 2. Score top USGS sites
            if usgs_sites:
                top_n = min(len(usgs_sites), 30)
                print(f'  Scoring {top_n} USGS sites... ', end='', flush=True)
                for i, site in enumerate(usgs_sites[:top_n]):
                    count, params = score_usgs_site(site['siteId'])
                    site['wqParamCount'] = count
                    site['wqParams'] = params
                    if (i + 1) % 10 == 0:
                        print(f'{i+1}..', end='', flush=True)
                    time.sleep(0.2)
                print(f' done')

            # Filter to sites with at least 1 WQ param
            usgs_with_wq = [s for s in usgs_sites if s['wqParamCount'] >= 1]
            if args.verbose:
                print(f'  → {len(usgs_with_wq)}/{len(usgs_sites)} USGS sites have WQ params')
        else:
            print(f'  ⏭️  Skipping USGS (org-specific import: {args.organization})')

        # 3. WQP: state/tribal/local providers
        print(f'  WQP stations{" (" + args.organization + ")" if args.organization else ""}... ', end='', flush=True)
        wqp_sites = find_wqp_sites(state_code, organization=args.organization)
        print(f'{len(wqp_sites)} found')
        time.sleep(RATE_LIMIT_SEC)

        # 4. Rank, dedup, pick best
        ranked = rank_and_dedup(usgs_with_wq, wqp_sites, state_name, args.max_per_state)
        all_stations[state_code] = ranked

        usgs_count = len([s for s in ranked if s['source'] == 'USGS'])
        wqp_count = len([s for s in ranked if s['source'] == 'WQP'])
        total_wb += len(ranked)
        total_usgs += usgs_count
        total_wqp += wqp_count

        # Print results
        for s in ranked:
            src = f"USGS:{s['siteId']}" if s['source'] == 'USGS' else f"WQP:{s.get('provider', '?')}"
            params = ', '.join(PARAM_NAMES.get(p, p) for p in s.get('wqParams', []))
            param_str = f' ({params})' if params else f' ({s["wqParamCount"]} results)'
            print(f'  ✅ {s["waterbodyName"]} → {src}{param_str}')

        if not ranked:
            print('  ❌ No stations with WQ data found')

    # ─── Summary ──────────────────────────────────────────────────────────
    print('\n══════════════════════════════════════════════════════════')
    print(f'✅ {total_wb} waterbodies with confirmed data')
    print(f'   {total_usgs} from USGS | {total_wqp} from WQP (state/tribal/local)')
    print(f'   across {len(states)} states (max {args.max_per_state} per state)')

    # ─── Write outputs ────────────────────────────────────────────────────
    project_root = Path(__file__).resolve().parent.parent
    lib_dir = project_root / 'lib'
    lib_dir.mkdir(exist_ok=True)

    # 1. JSON registry
    registry = generate_json(all_stations)

    if args.append:
        # Append mode: merge into existing public/data/station-registry.json
        public_json = project_root / 'public' / 'data' / 'station-registry.json'
        if public_json.exists():
            print(f'\n📎 Loading existing registry: {public_json}')
            with open(public_json) as f:
                existing = json.load(f)
            before = len(existing.get('regions', {}))
            # Merge new entries into existing (new entries override on collision)
            for section in ['regions', 'usgsSiteMap', 'wqpStationMap', 'coverage']:
                existing.setdefault(section, {}).update(registry.get(section, {}))
            existing['_meta']['totalWaterbodies'] = len(existing['regions'])
            existing['_meta']['lastAppended'] = datetime.now().isoformat()
            existing['_meta']['lastAppendedOrg'] = args.organization or ''
            after = len(existing['regions'])
            registry = existing
            print(f'   Merged: {before} → {after} waterbodies (+{after - before} new)')
        else:
            print(f'\n⚠️  No existing registry at {public_json}, creating new one')
        json_path = public_json
    else:
        json_path = lib_dir / 'station-registry.json'

    with open(json_path, 'w') as f:
        json.dump(registry, f, indent=2)
    print(f'\n📄 JSON registry: {json_path}')

    # 2. TypeScript wrapper (skip for append mode — existing wrapper still valid)
    if not args.append:
        ts_content = generate_ts_wrapper(str(json_path))
        ts_path = lib_dir / 'station-registry.ts'
        with open(ts_path, 'w') as f:
            f.write(ts_content)
        print(f'📄 TypeScript wrapper: {ts_path}')

    # 3. Raw discovery data (for debugging)
    debug_path = project_root / 'station-discovery.json'
    with open(debug_path, 'w') as f:
        json.dump({
            code: [s for s in stations]
            for code, stations in all_stations.items()
        }, f, indent=2)
    print(f'📄 Debug data: {debug_path}')

    # 4. Per-state summary
    print('\n── Per-State Coverage ──')
    for code in sorted(states.keys()):
        info = states[code]
        stations = all_stations.get(code, [])
        name = info[1]
        bar = '█' * min(len(stations), 20) + '░' * max(0, 10 - len(stations))
        print(f'  {code} {name:<20} {bar} {len(stations)} waterbodies')

    print(f'\n✨ Done! {total_wb} waterbodies across {len(states)} states.')
    print(f'   Next: import from lib/station-registry.ts into your Next.js app')


if __name__ == '__main__':
    main()
