# API Reference

This document covers all 113 API routes in the PIN Dashboard, organized by category.

---

## Auth & Validation Preamble

All protected routes use one of these patterns:

- **`isAuthorized(request)`** — validates Supabase session token for user-facing routes
- **`isCronAuthorized(request)`** — validates `CRON_SECRET` bearer token for cron routes
- **`parseBody(request, schema)`** — parses JSON body against a Zod schema (from `lib/validateRequest.ts`); returns `{ success, data }` or a 400 error response with field-level errors

Schemas are defined in `lib/schemas.ts`.

---

## Data Retrieval (40 routes)

### National & State Summaries

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/national-summary` | GET | None | Aggregated ATTAINS impairment counts, NWIS IV site count, state rollup |
| `/api/icis/national-summary` | GET | None | National ICIS stats: permit, violation, DMR, enforcement totals |
| `/api/nwis-gw/national-summary` | GET | None | National groundwater monitoring: total sites and recent levels |
| `/api/pfas/national-summary` | GET | None | National PFAS monitoring: detection counts and remediation status |
| `/api/federal-briefing-metrics` | GET | None | Federal role briefing: infrastructure, compliance, and threat metrics |
| `/api/tri-releases/emergency-summary` | GET | None | TRI emergency release hotspots and cumulative toxics |
| `/api/fema-declarations` | GET | None | FEMA disaster declarations by state and flood hazard zones |

### Location-Based Reports

| Route | Method | Auth | Params | Description |
|-------|--------|------|--------|-------------|
| `/api/location-report` | GET | None | `lat`, `lng`, `zip`, `state` | Fan-out spatial query returning WQP, SDWIS, ICIS, ECHO, PFAS, NWIS-GW, NWIS-IV, FRS, TRI, NDBC, NARS, ATTAINS, state reports, and EJScreen data. `maxDuration: 30` |
| `/api/waterbody-search` | GET | None | `q` (name) | Search waterbodies by name; returns coordinates for location-report |
| `/api/site-intelligence` | GET | None | `lat`, `lng` | Detailed site profile: measurements, trends, outliers, historical context. `maxDuration: 30` |
| `/api/nldi/[siteId]` | GET | None | Path: `siteId` | NLDI upstream/downstream tracing for USGS sites. `maxDuration: 30` |

### Water Quality & Environmental Data

| Route | Method | Auth | Params | Description |
|-------|--------|------|--------|-------------|
| `/api/water-data` | GET | `isAuthorized` | `source`, `state`, `lat`, `lng` | Unified proxy for Water Reporter, CBP DataHub, USGS IV/samples/daily, MARACOOS ERDDAP, ATTAINS, ECHO, CEDEN |
| `/api/air-quality/latest` | GET | None | `state` | State AQI values, PM2.5/O3 concentrations, forecast |
| `/api/firms/latest` | GET | `isAuthorized` | `state` | Latest NASA FIRMS fire detections (MODIS/VIIRS) by region |
| `/api/flood-forecast` | GET | None | `state` | NWS flood forecasts and river stage predictions |
| `/api/flood-risk-overview` | GET | None | `state` | State flood risk summary: stream reaches, USACE impoundments, FEMA zones |
| `/api/deployments/readings` | GET | None | `deploymentId` | Real-time PEARL unit sensor readings |
| `/api/nws-alerts` | GET | None | `state` | NWS marine/coastal alerts by state |
| `/api/nws-weather-alerts` | GET | None | `state` | NWS severe weather alerts (wind, tornadoes, flooding) with severity |

### Threat & Risk Scoring

| Route | Method | Auth | Params | Description |
|-------|--------|------|--------|-------------|
| `/api/water-risk-score` | GET | None | `lat`, `lng` | Water supply risk index combining infrastructure age, compliance, drought, source quality. `maxDuration: 30` |
| `/api/waterfront-exposure` | GET | None | `lat`, `lng` | Coastal/waterfront climate exposure: flood risk, sea level rise, storm surge |
| `/api/fire-aq/installation-risk` | GET | `isAuthorized` | `state` | Military installation fire/AQ risk: nearby detections, smoke dispersion |
| `/api/fire-aq/map-data` | GET | `isAuthorized` | `state` | Combined fire + AQ map data: FIRMS detections, installations, AQI, wind vectors |
| `/api/ntas` | GET | None | — | DHS NTAS threat advisory feed (30-min cache). Returns advisory type and expiration |
| `/api/sentinel-status` | GET | None | — | Sentinel threat monitoring status: queue depth, active HUCs, critical/watch/advisory counts |
| `/api/sentinel-validate` | GET | None | `huc` | Debug endpoint validating Sentinel HUC scoring logic. `maxDuration: 120` |
| `/api/incidents/gulf-crosscheck` | GET | None | `incidentId` | Verifies incident reports against Gulf regional data sources |

### Infrastructure & Compliance

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/superfund-sites` | GET | None | Superfund (CERCLIS) site inventory and remediation status |
| `/api/indices` | GET | None | National environmental indices: air quality, water, ecological health |

### Session & Utility

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/session/validate` | GET | None | Validates Supabase session; returns user profile, roles, permissions |
| `/api/source-health` | GET | None | Health checks all federal APIs (HTTP status, response time); identifies online/degraded/offline sources |
| `/api/demo-grid` | GET | None | Sample spatial grid data for demo/tutorial |
| `/api/prefetch` | GET | None | Login-triggered cache warming by role + state. `maxDuration: 60` |

---

## Alerts (9 routes)

All alert routes require `isAuthorized` and have `export const dynamic = 'force-dynamic'`.

| Route | Method(s) | Schema | Description |
|-------|-----------|--------|-------------|
| `/api/alerts/rules` | GET, POST, DELETE | `alertRuleCreateSchema`, `alertRuleDeleteSchema` | CRUD for custom alert rules (trigger conditions, severity, enabled state) |
| `/api/alerts/history` | GET | — | Recent alert log (default limit=50, max 500); includes sent/suppressed/throttled/error counts |
| `/api/alerts/recipients` | GET, POST, PUT, DELETE | `alertRecipientCreateSchema`, `alertRecipientUpdateSchema`, `alertRecipientDeleteSchema` | Manage alert recipients (email, role, state filter, trigger types, severity thresholds) |
| `/api/alerts/suppress` | GET, POST, DELETE | `alertSuppressCreateSchema`, `alertSuppressDeleteSchema` | Add/remove alert suppressions by dedupKey; supports expiration timestamps |
| `/api/alerts/test` | POST | `alertTestSchema` | Send test alert email to verify delivery setup |
| `/api/alerts/throttle-stats` | GET | — | Live throttle state: sites in cooldown, pending, recovered; hourly email cap |
| `/api/alerts/deployment-alerts` | GET, POST, PUT | `deploymentAlertSchema`, `deploymentAlertUpdateSchema` | Supabase-backed CRUD for deployment sensor alerts, acknowledgments, timeline |
| `/api/alerts/fusion-ingest` | POST | `fusionIngestSchema` | Ingest external anomaly detection events from fusion engine |
| `/api/alerts/configure` | GET, POST | — | Alert system configuration (feature flags, delivery settings) |

---

## Admin (3 routes)

| Route | Method | Auth | Schema | Description |
|-------|--------|------|--------|-------------|
| `/api/admin/cron-health` | GET | `isAuthorized` | — | Cron run history, success/failure counts, last run timestamps per source |
| `/api/admin/grant-role-admin` | POST | Supabase token | `grantRoleAdminSchema` | Grant or revoke role-admin privileges; super_admin only |
| `/api/admin/users/[uid]` | DELETE | Supabase token | Path: `uid` | Delete user auth + profile; admin access required; prevents self-deletion |

---

## AI / LLM (5 routes)

All AI routes are rate-limited via Upstash Redis.

| Route | Method | Auth | Schema | maxDuration | Description |
|-------|--------|------|--------|-------------|-------------|
| `/api/ai/ask-pin` | POST | Rate limit | `askPinSchema` | 30s | Conversational QA about dashboard cards; GPT-4o-mini; 500 token max |
| `/api/ai/briefing-qa` | POST | Rate limit | `briefingQaSchema` | 30s | Role-specific briefing Q&A; fetches national-summary, source-health, sentinel data in parallel |
| `/api/ai/resolution-plan` | POST | None | `resolutionPlanSchema` | 300s | Water quality resolution plan generation; GPT-4o; 6000 token max |
| `/api/ai-categorize` | POST | None | `aiCategorizeSchema` | — | JSON categorization of modules/partners/events; GPT-4o-mini |
| `/api/ai-insights` | POST | Rate limit | `aiInsightsSchema` | — | LLM-powered insights; cache-first with on-demand OpenAI fallback |

---

## Uploads (6 routes)

| Route | Method | Auth | Schema | Description |
|-------|--------|------|--------|-------------|
| `/api/uploads` | POST | Role check | FormData | Main upload endpoint; accepts CSV/XLSX/PDF; role check (PROGRAM_MANAGER, DATA_STEWARD, FIELD_INSPECTOR) |
| `/api/uploads/csv` | POST | None | `csvUploadSchema` | CSV parser with auto-detected column mapping to PEARL parameters |
| `/api/uploads/submit` | POST | None | `uploadSubmitSchema` | Submit validated single-sample upload for approval |
| `/api/uploads/pending` | GET | Role check | — | List pending upload batches awaiting approval (PROGRAM_MANAGER only) |
| `/api/uploads/approve` | POST | None | `uploadApproveSchema` | Approve pending batch; inserts records into production |
| `/api/uploads/samples` | GET | None | — | Sample data structure for CSV template generation |

---

## Invites (2 routes)

| Route | Method | Schema | Description |
|-------|--------|--------|-------------|
| `/api/invites/create` | POST | `inviteCreateSchema` | Create shareable invite token (24h TTL) with pre-assigned role/scope |
| `/api/invites/resolve` | POST | `inviteResolveSchema` | Redeem invite token; creates Supabase user + profile |

---

## Cache Management (2 routes)

| Route | Method | Auth | Schema | Description |
|-------|--------|------|--------|-------------|
| `/api/cache-status` | GET | `isAuthorized` | — | Unified status for 45+ cache modules: last built, staleness, record counts, delta summary, sentinel health. `maxDuration: 120` |
| `/api/cache-refresh` | POST | `isAuthorized` | `cacheRefreshSchema` | Force-refresh a single cache by `source` + `scopeKey`. `maxDuration: 120` |

---

## Cron (52 routes)

All cron routes use `isCronAuthorized`, `export const dynamic = 'force-dynamic'`, and are scheduled via `vercel.json`.

### Cache Rebuild — Heavy (maxDuration: 300)

| Route | Schedule | Data Source |
|-------|----------|-------------|
| `/api/cron/rebuild-wqp` | `0 5 * * *` (daily 5 AM UTC) | Water Quality Portal — samples for DO, pH, temperature, turbidity, nutrients, bacteria, TSS, conductivity, chlorophyll |
| `/api/cron/rebuild-attains` | `30 * * * *` (every 30 min) | EPA ATTAINS — water quality assessments, HUC-12 summaries, impairment data, TMDLs |
| `/api/cron/rebuild-icis` | `0 6 * * *` (daily 6 AM UTC) | EPA ICIS — NPDES permits, violations, DMR records, enforcement actions |
| `/api/cron/rebuild-sdwis` | `0 7 * * *` (daily 7 AM UTC) | EPA SDWIS — community water systems, violations, enforcement |
| `/api/cron/rebuild-nwis-gw` | `0 8 * * *` (daily 8 AM UTC) | USGS NWIS — groundwater levels (gwlevels, IV-GW, DV-GW) |
| `/api/cron/rebuild-echo` | `0 9 * * *` (daily 9 AM UTC) | EPA ECHO — regulated facilities, compliance tracking |
| `/api/cron/rebuild-frs` | `0 10 * * *` (daily 10 AM UTC) | EPA FRS — facility registry and system coordinates |
| `/api/cron/rebuild-pfas` | `0 11 * * *` (daily 11 AM UTC) | EPA UCMR — PFAS monitoring results from drinking water systems |
| `/api/cron/rebuild-ceden` | `0 4 * * *` (daily 4 AM UTC) | California CEDEN — water quality chemistry and toxicity records |
| `/api/cron/rebuild-nwis-iv` | `*/5 * * * *` (every 5 min) | USGS NWIS IV — instantaneous surface water data (streamflow, temperature) |
| `/api/cron/rebuild-coops` | `0 */6 * * *` (every 6 hrs) | NOAA CO-OPS — coastal tide/water level stations |
| `/api/cron/rebuild-coops-derived` | `0 15 * * 0` (weekly Sun 3 PM UTC) | Derived metrics from CO-OPS data (tidal trends, anomalies) |
| `/api/cron/rebuild-ndbc` | `0 14 * * *` (daily 2 PM UTC) | NOAA NDBC — buoy observations (wind, waves, water temp) |
| `/api/cron/rebuild-erddap-sat` | `0 15 * * *` (daily 3 PM UTC) | ERDDAP satellite data — sea surface temperature, ocean color |
| `/api/cron/rebuild-firms` | `0 */4 * * *` (every 4 hrs) | NASA FIRMS — fire detections (MODIS/VIIRS) |
| `/api/cron/rebuild-nars` | `0 16 * * 0` (weekly Sun 4 PM UTC) | EPA NARS — national aquatic resource survey sites and results |
| `/api/cron/rebuild-sam` | `0 20 * * 0` (weekly Sun 8 PM UTC) | SAM.gov — federal awards (grants, contracts) |
| `/api/cron/rebuild-usaspending` | `0 21 * * 0` (weekly Sun 9 PM UTC) | USAspending.gov — federal spending data |
| `/api/cron/rebuild-tri` | `0 18 * * *` (daily 6 PM UTC) | EPA TRI — toxic releases and transfers |
| `/api/cron/rebuild-superfund` | `15 3 * * *` (daily 3:15 AM UTC) | EPA Superfund — CERCLIS, national priority list sites |
| `/api/cron/rebuild-usace` | `0 16 * * *` (daily 4 PM UTC) | USACE — reservoir storage, water control data |
| `/api/cron/rebuild-nasa-cmr` | `0 15 * * *` (daily 3 PM UTC) | NASA CMR — dataset metadata for water-related collections |
| `/api/cron/rebuild-nasa-stream` | `30 15 * * 0` (weekly Sun 3:30 PM UTC) | NASA STREAM — streamflow and flood forecasts (GEFS-based) |
| `/api/cron/rebuild-nwm` | `0 */6 * * *` (every 6 hrs) | NOAA NWM — national water model predictions |
| `/api/cron/rebuild-ssocso` | `30 15 * * *` (daily 3:30 PM UTC) | NSF SSO/CSO — stormwater/combined sewer overflow data |
| `/api/cron/rebuild-grants-gov` | `0 19 * * *` (daily 7 PM UTC) | Grants.gov — federal grant opportunities |
| `/api/cron/rebuild-state-reports` | `30 5 * * *` (daily 5:30 AM UTC) | Aggregated state water quality report data |
| `/api/cron/rebuild-cdc-nwss` | `0 13 * * *` (daily 1 PM UTC) | CDC NWSS — wastewater surveillance data |
| `/api/cron/build-assessments` | `30 19 * * *` (daily 7:30 PM UTC) | State assessment indices from ATTAINS, WQP, and other sources |
| `/api/cron/rebuild-ipac` | `0 16 * * 0` (weekly Sun 4 PM UTC) | IPAC (EPA) — integrated pollution assessment capabilities |
| `/api/cron/rebuild-ncei` | `30 16 * * *` (daily 4:30 PM UTC) | NOAA NCEI — climate and water data archive |

### Cache Rebuild — Light (maxDuration: 120)

| Route | Schedule | Data Source |
|-------|----------|-------------|
| `/api/cron/rebuild-fema` | `0 3 * * *` (daily 3 AM UTC) | FEMA — disaster declarations, flood hazards |
| `/api/cron/rebuild-bwb` | `0 12 * * *` (daily 12 PM UTC) | Water Reporter — crowdsourced water quality observations |
| `/api/cron/rebuild-beacon` | `0 16 * * *` (daily 4 PM UTC) | Data.gov — BEACON environmental justice data |
| `/api/cron/rebuild-snotel` | `0 12 * * *` (daily 12 PM UTC) | NRCS SNOTEL — snow water equivalent and precipitation |
| `/api/cron/rebuild-nwps` | `*/30 * * * *` (every 30 min) | NWS — point observations and marine forecasts |
| `/api/cron/rebuild-nws-alerts` | `*/10 * * * *` (every 10 min) | NWS — weather alerts (flood, wind, tornadoes) |
| `/api/cron/rebuild-air-quality` | `*/30 * * * *` (every 30 min) | AirNow — air quality index data |
| `/api/cron/rebuild-mde` | `30 9 * * *` (daily 9:30 AM UTC) | Maryland DNR/MDE — state-specific water monitoring |
| `/api/cron/rebuild-datagov` | `0 17 * * 0` (weekly Sun 5 PM UTC) | Data.gov — federal datasets index |
| `/api/cron/rebuild-glerl` | `30 17 * * *` (daily 5:30 PM UTC) | NOAA GLERL — Great Lakes data and forecasts |
| `/api/cron/rebuild-habsos` | `0 17 * * *` (daily 5 PM UTC) | HABsos — harmful algal bloom reporting |
| `/api/cron/rebuild-hefs` | `30 */6 * * *` (every 6 hrs) | NOAA HEFS — hydrologic ensemble forecasts |
| `/api/cron/rebuild-usdm` | `0 14 * * *` (daily 2 PM UTC) | US Drought Monitor — drought severity classifications |
| `/api/cron/rebuild-usgs-dv` | `30 14 * * *` (daily 2:30 PM UTC) | USGS Daily Values — daily discharge and parameter stats |
| `/api/cron/rebuild-indices` | `30 18 * * *` (daily 6:30 PM UTC) | Environmental quality indices (computed from cache data) |

### AI & Insights Crons

| Route | Schedule | maxDuration | Description |
|-------|----------|-------------|-------------|
| `/api/cron/generate-insights` | `0 */6 * * *` (every 6 hrs) | 300s | Pre-generates LLM insights for all state/role combos; delta detection via signalsHash; semaphore-limited concurrency (4 states) |
| `/api/cron/generate-urgent-insights` | `30 1,3,5,...,23 * * *` (every 2 hrs) | 120s | Generates urgent AI insights for critical Sentinel events |

### Alert & Event Processing Crons

| Route | Schedule | maxDuration | Description |
|-------|----------|-------------|-------------|
| `/api/cron/dispatch-alerts` | `2/5 * * * *` (every 5 min) | 60s | Evaluates all trigger sources (sentinel, USGS, delta, NWSS, flood, deployment, HAB, beacon, fusion, FIRMS, ATTAINS, NWS); dispatches via email |
| `/api/cron/dispatch-attains-diff` | `45 * * * *` (hourly at :45) | 120s | Detects ATTAINS data changes and dispatches delta alerts |
| `/api/cron/nwss-poll` | `0 7 * * 3,6` (Wed/Sat 7 AM UTC) | 300s | Polls CDC NWSS for new wastewater surveillance data |
| `/api/cron/sentinel-poll` | `*/5 * * * *` (every 5 min) | 120s | Polls external threat sources and updates Sentinel event queue |
| `/api/cron/sentinel-score` | `*/5 * * * *` (every 5 min) | 120s | Scores HUC-12 basins by cumulative threat level; triggers alerts on threshold crossings |
