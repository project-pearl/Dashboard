# PIN Pipeline — Data Source Plan

## Architecture

```
pin-pipeline/
├── registry.json        ← Central source registry (all endpoints, status, health)
├── fetch.py             ← Priority-sorted data fetcher with FETCHER_MAP dispatch
├── health.py            ← Endpoint health checker (probe, status tracking)
├── stale.py             ← Staleness reporter + dead source reviver
├── output.py            ← CSV-to-.ts file generator
├── run.py               ← Pipeline orchestrator (health → fetch → stale → output)
├── state_ir_index.py    ← State Integrated Report master index (56 jurisdictions)
├── state_ir_index.json  ← Exported JSON of the IR index
├── requirements.txt     ← pandas, requests
└── output/              ← Fetched CSV data files
```

---

## Data Segments

### Segment 1: Federal Core (WQP + USGS)
| Source | ID | Priority | Format | Notes |
|---|---|---|---|---|
| Water Quality Portal | `wqp-portal` | 1 | CSV | 430M+ discrete samples, per-state pulls |
| USGS NWIS | `usgs-nwis` | 1 | JSON | Real-time instantaneous values, 1.9M sites |

### Segment 2: Federal Regulatory
| Source | ID | Priority | Format | Notes |
|---|---|---|---|---|
| EPA ATTAINS | `epa-attains` | 2 | JSON | Already cached (51/51 states) |
| EPA SDWIS | `epa-sdwis` | 2 | JSON | Drinking water systems, 150K+ |

### Segment 3: State Portals (Original)
| Source | ID | Priority | Format | Notes |
|---|---|---|---|---|
| FL DBHYDRO | `fl-dbhydro` | 2 | CSV | South Florida, 35M+ records |
| CA CEDEN | `ca-ceden` | 2 | JSON | California WQ via CKAN |
| CBP DataHub | `cbp-datahub` | 2 | JSON | Chesapeake Bay watershed, 20M+ |
| TX TCEQ | `tx-tceq` | 3 | CSV | Degraded — using WQP for TX |

### Segment 4: NOAA Coastal
| Source | ID | Priority | Format | Notes |
|---|---|---|---|---|
| NOAA NDBC | `noaa-ndbc` | 3 | CSV | 1,300+ buoys, water temp/waves |
| NOAA NERRS | `noaa-nerrs` | 3 | JSON | 29 estuarine reserves |

### Segment 5: WQP State-by-State
56 states/territories fetched via WQP with per-state priority queuing.

### Segment 6: Wastewater & Compliance
| Source | ID | Priority | Format | Notes |
|---|---|---|---|---|
| EPA ICIS-NPDES | `icis_npdes` | 1 | JSON | Discharge permits, violations, inspections. 400K+ facilities |
| EPA ICIS DMR | `icis_dmr` | 1 | JSON | Discharge monitoring data (BOD, TSS, ammonia, etc). 100M+ |
| EPA ECHO Facilities | `echo_facilities` | 1 | JSON | CWA facility compliance, 800K+ |
| EPA ECHO Violations | `echo_violations` | 1 | JSON | CWA facilities currently in violation |
| EPA FRS WWTPs | `frs_wwtps` | 2 | JSON | WWTP locations, capacities, permit numbers |

### Segment 7: Emerging Contaminants
| Source | ID | Priority | Format | Notes |
|---|---|---|---|---|
| EPA UCMR (PFAS) | `pfas_ucmr` | 2 | JSON | PFAS screening from UCMR4, 2M+ results |
| CDC NWSS | `cdc_nwss` | 3 | JSON | Wastewater pathogen surveillance (COVID, RSV, flu) |

### Segment 8: Catalogs & Discovery
| Source | ID | Priority | Format | Notes |
|---|---|---|---|---|
| Data.gov WQ | `datagov_wq` | 3 | JSON | CKAN meta-catalog, dataset discovery |
| NASA CMR | `nasa_cmr` | 3 | JSON | Satellite collection discovery |
| NPS WQ | `nps_wq` | 3 | JSON | National Park Service via WQP |

### Segment 9: Mid-Atlantic State APIs
| Source | ID | Priority | Format | Notes |
|---|---|---|---|---|
| NY Open Data | `state_ny` | 3 | JSON | Socrata, no auth |
| NJ Open Data | `state_nj` | 3 | JSON | Socrata, no auth |
| PA Open Data | `state_pa` | 3 | JSON | Socrata, no auth |
| VA Open Data | `state_va` | 3 | JSON | Socrata, no auth |

---

## Output Structure

```
lib/
├── pin/                     ← Existing WQP/NWIS/SDWIS output
│   ├── wqp-MD.ts
│   ├── nwis-MD.ts
│   ├── sdwis-MD.ts
│   └── index.ts
├── icis/
│   ├── permits.ts
│   ├── violations.ts
│   └── dmr/
│       └── by-state/
│           ├── MD.ts
│           └── ...
├── echo/
│   └── facilities.ts
├── frs/
│   └── wwtps.ts
├── pfas/
│   └── ucmr.ts
├── cdc/
│   └── wastewater.ts
└── state-reports/
    └── (PDFs downloaded by state_ir_index.py)
```

---

## Pipeline Phases

### Phase 1: Health Check (health.py)
Probe all registered endpoints. Update status/last_checked/error_count.

### Phase 2: Priority Fetch (fetch.py)
Fetch data ordered by priority. FETCHER_MAP dispatches to per-source handlers.

### Phase 3: Staleness Report (stale.py)
Report dead, stale, never-fetched sources. Industry-standard age brackets.

### Phase 4: Output Generation (output.py)
Convert fetched CSVs to typed .ts files for the dashboard.

### Phase 5: Dead Source Revival (stale.py --revive)
Try alt_urls for dead sources. Restore if reachable.

### Phase 6: Cron Automation
Hourly/daily cron triggers run.py for continuous freshness.

### Phase 7: State Integrated Report PDF Extraction
- `state_ir_index.py` maintains a master index of 56 state IR reports
- Tracks: agency, landing page, direct PDF link, reporting cycle, EPA approval date
- 5 states confirmed (MA, MD, VA, CA, IN), 3 with direct PDF links
- Next: automated PDF download to `lib/state-reports/`, text extraction, 303(d) list parsing

---

## Numbers

| Metric | Count |
|---|---|
| Total sources in registry | 24 (10 original + 14 new) |
| Federal sources | 14 |
| State sources | 8 |
| NOAA sources | 2 |
| Supplemental sources | 2 (catalog/discovery) |
| WQP state endpoints | 56 |
| Fetch handlers in FETCHER_MAP | 16 |
| Total unique data endpoints | 80+ |

---

## API Patterns

| Pattern | Sources | Rate Limit |
|---|---|---|
| EPA Envirofacts REST | SDWIS, ICIS, FRS, UCMR | 1s between requests |
| EPA ECHO REST | echo_facilities, echo_violations | 1s between requests |
| Socrata Open Data | CDC NWSS, NY, NJ, PA, VA | 0.5s between requests |
| WQP REST | wqp-portal, nps_wq | 2s between requests |
| USGS Water Services | usgs-nwis | 2s between requests |
| CKAN Catalog | Data.gov, CA CEDEN | 0.5s between requests |
| NASA CMR | nasa_cmr | 0.5s between requests |
