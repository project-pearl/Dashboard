# PIN Sentinel Threat Detection System — Architecture Reference

Last updated: March 4, 2026

## Overview

The Sentinel system is a real-time water quality threat detection pipeline built for DARPA evaluation. It ingests data from 11 federal/state sources, scores watersheds (HUC-8 basins) for anomalies, detects coordinated multi-site attacks, classifies events as attack vs. benign (with weather exclusion), correlates wastewater pathogen data with water quality signals, and dispatches enriched alert emails.

```
Data Sources → Adapters → Event Queue → Scoring → Coordination → Classification → Alerts → Email
  (11 crons)   (11 adapters)  (48h rolling)  (Tier-2)    (HUC-6 cluster)  (attack/benign)   (8 triggers)  (enriched)
```

---

## Data Flow

### Phase 1: Ingest (sentinel-poll cron, every 5 min)

Each adapter reads from an existing cache or live API and produces `ChangeEvent[]`. Events are deduplicated and pushed into a 48-hour rolling event queue (disk + Vercel Blob).

| Adapter | Source Type | Data Source | Poll Interval |
|---------|------------|-------------|---------------|
| `nwsAdapter` | NWS_ALERTS | `nwsAlertCache` | 5 min |
| `nwpsFloodAdapter` | NWPS_FLOOD | `nwsAlertCache` (flood-filtered) | 5 min |
| `usgsAdapter` | USGS_IV | `nwisIvCache` | 15 min |
| `npdesAdapter` | NPDES_DMR | `icisCache` | 30 min |
| `echoAdapter` | ECHO_ENFORCEMENT | `echoCache` | Daily |
| `attainsAdapter` | ATTAINS | `attainsCache` | Daily |
| `nwssAdapter` | CDC_NWSS | `nwssCache` | Weekly |
| `femaAdapter` | FEMA_DISASTER | FEMA API (live) | Hourly |
| `qpeAdapter` | QPE_RAINFALL | NRCS AWDB SNOTEL (live) | 30 min |
| `ssoAdapter` | SSO_CSO | ECHO SSO endpoint (live) | 30 min |
| `stateDischargeAdapter` | STATE_DISCHARGE | Stub (TODO) | Daily |
| `nwpsForecastAdapter` | NWPS_FORECAST | `nwpsCache` + `nwpsGaugeLookup` | 30 min |

Each source cache is populated by its own rebuild cron (e.g., `rebuild-nws-alerts`, `rebuild-nwis-iv`). The sentinel adapters read from these caches — they do not fetch external data themselves (except FEMA, QPE, SSO which call live APIs).

The **NWPS_FORECAST adapter** is the flood prediction engine. It reads stageflow forecast data from `nwpsCache` (populated every 30 min by `rebuild-nwps`) and compares predicted stage heights against flood thresholds from `nwpsGaugeLookup` (parsed from the NWPS all-gauges CSV report). It emits `THRESHOLD_CROSSED` events when a gauge is predicted to exceed action/minor/moderate/major flood stage, along with lead time estimates.

### Phase 2: Scoring (sentinel-score cron, every 5 min)

`scoreAllHucs()` processes all events in the queue:

1. **Base scoring**: Each event gets a score from `BASE_SCORES[source][severity]`
2. **Time decay**: Scores decay linearly over 48h (floor 0.1)
3. **Compound pattern matching**: 6 patterns that multiply scores when multiple sources co-occur:
   - `potomac-crisis` (NWS + SSO/NPDES, 2.5x)
   - `infrastructure-stress` (SSO + rainfall/flood, 2.0x)
   - `spreading-contamination` (NPDES/SSO/ECHO across 2+ HUCs, 3.0x)
   - `regulatory-escalation` (NPDES + ECHO same HUC, 1.8x)
   - `enforcement-cascade` (ECHO + NPDES, 2.2x)
   - `bio-threat-correlation` (CDC_NWSS + USGS/SSO/NPDES, 3.5x)
4. **Geographic correlation**: 1.5x bonus when adjacent HUC-8s (same HUC-6 parent) have activity
5. **Level assignment**: Score → NOMINAL/ADVISORY/WATCH/CRITICAL

### Phase 3: Coordination Detection (sentinel-score cron)

`detectCoordination()` looks for multi-site attacks:

1. Groups events by HUC-6 parent (first 6 chars of HUC-8)
2. Expands clusters to include adjacent HUC-8s
3. Scores each cluster on three axes:
   - **Cluster size** (more HUCs = more suspicious)
   - **Parameter breadth** (more distinct parameters = more suspicious, with bonus for known attack indicator pairs like conductivity+pH+DO)
   - **Temporal tightness** (events closer together = more suspicious)
4. Coordination score > 0.6 → emits `CoordinatedEvent`, dispatches critical alert

### Phase 4: Classification (sentinel-score cron)

`classifyEvent()` determines if an anomaly is an attack or weather noise:

1. Base threat score from HUC level (CRITICAL=0.7, WATCH=0.5, ADVISORY=0.3)
2. **Confounder reduction** — checks for:
   - `RAINFALL_CONFOUNDER`: QPE rainfall >2 inches in 24h → reduces score for turbidity/conductivity
   - `FLOOD_CONFOUNDER`: Active NWS flood warning → reduces score for all non-bio parameters
   - `SEASONAL_CONFOUNDER`: Summer DO/temperature patterns → reduces score
   - `COVARIANCE_CONFOUNDER`: Temperature↔DO natural correlation → reduces score
3. **Attack signal boost** — checks for:
   - `CHEMICAL_DUMP`: Simultaneous conductivity + pH/DO shifts
   - `BIO_MARKER_SPIKE`: DO crash + turbidity spike
4. Result: `likely_attack` (>0.7), `possible_attack` (0.4-0.7), `likely_benign` (<0.4)

**The classification gates alert dispatch**: `likely_benign` HUCs are suppressed in the sentinel trigger and USGS trigger. This prevents storm-driven false positives.

### Phase 5: NWSS Correlation (sentinel-score cron)

`correlateNwssWithWQ()` links wastewater pathogen spikes to downstream water quality anomalies:

1. For each NWSS anomaly (≥2σ), resolves sewershed → HUC-8 via FIPS crosswalk
2. Finds WQ events in same/adjacent HUCs within 72h
3. Scores on temporal proximity, spatial proximity, and bio-proxy parameter match
4. Correlation score > 0.5 → metadata attached to NWSS alerts

### Phase 6: Alert Dispatch (dispatch-alerts cron, every 5 min offset +2)

Evaluates 6 triggers in order, then dispatches:

```
Sentinel → USGS → Delta → NWSS → Custom Rules
```

(Coordination alerts dispatch directly from sentinel-score cron.)

Each candidate goes through: suppression check → cooldown check → recipient matching → rate limit → email send.

---

## Alert Triggers

| Trigger | Type | What it detects | Classification gated? |
|---------|------|-----------------|----------------------|
| `sentinelTrigger` | `sentinel` | HUC level escalation (WATCH/CRITICAL) + source health (OFFLINE/recovery) | Yes — suppresses `likely_benign` |
| `usgsTrigger` | `usgs` | USGS IV threshold breaches (low DO, high pH, high turbidity, etc.) | Yes — suppresses weather-sensitive params during rainfall/flood |
| `deltaTrigger` | `delta` | Cache rebuild swings >10% (WQP, ICIS, ECHO, SDWIS, NWIS-GW, CEDEN, ATTAINS) | No |
| `nwssTrigger` | `nwss` | NWSS pathogen anomalies ≥3σ | No (but includes correlation metadata) |
| `coordinationTrigger` | `coordination` | Multi-site coordinated anomalies (score >0.6) | No (inherently high-signal) |
| `attainsTrigger` | `attains` | ATTAINS impairment status changes | No |
| `floodForecastTrigger` | `flood_forecast` | Predicted flood stage exceedances from NWPS forecasts | No |
| Custom rules | `custom` | User-defined metric thresholds | No |

### Delta Trigger

The delta trigger (`lib/alerts/triggers/deltaTrigger.ts`) compares cache rebuild metrics before/after each cron cycle. If a cache's record count, state count, or violation count swings by >10%, it fires a warning alert. If a metric drops by >50%, it fires critical (possible data source failure). This catches things like "SDWIS violations doubled overnight" or "ECHO lost 40% of its records."

The delta trigger reads from `computeCacheDelta()` in `lib/cacheUtils.ts`, which most caches call during their `set*Cache()` functions.

### Fusion Ingest

The fusion engine (`app/api/alerts/fusion-ingest/route.ts`) is a webhook receiver, not a cron-driven trigger. An external fusion service POSTs coordinated anomaly data to this endpoint:

```
POST /api/alerts/fusion-ingest/
{
  source: 'fusion-engine',
  anomaly: {
    id, detectedAt, affectedBasins: string[],
    triggers: [{ huc8, parameter, zScore, severity }],
    severity: 'CRITICAL'|'HIGH'|'MODERATE',
    confidence: number, narrative: string
  }
}
```

It maps the fusion anomaly → `AlertEvent` with `type: 'fusion'` and dispatches through the standard engine. This is for future integration with an external multi-basin anomaly detection service.

---

## Alert Email Enrichment

When a sentinel, USGS, coordination, or NWSS alert fires, the email includes:

1. **Affected HUCs table** — HUC-8 codes, names, states
2. **Parameter deviations table** — parameter code, current value, baseline mean, z-score, status
3. **Coordination summary** — coordination score, cluster size, temporal spread, member HUCs
4. **Classification badge** — LIKELY ATTACK / POSSIBLE ATTACK / LIKELY BENIGN with threat score and reasoning bullets
5. **Map link** — direct link to dashboard map centered on affected HUC
6. **Related events** — last 24h events in same/adjacent HUCs

---

## Cron Schedule (vercel.json)

| Cron | Schedule (UTC) | Max Duration |
|------|---------------|-------------|
| `sentinel-poll` | `*/5 * * * *` | 120s |
| `sentinel-score` | `*/5 * * * *` | 120s |
| `dispatch-alerts` | `2/5 * * * *` | 60s |

---

## Key File Paths

### Sentinel Core
- `lib/sentinel/types.ts` — ChangeEvent, ScoredHuc, CoordinatedEvent, AttackClassification, NwssCorrelation, EnrichedAlert
- `lib/sentinel/config.ts` — BASE_SCORES, COMPOUND_PATTERNS, POLL_INTERVALS, SCORE_THRESHOLDS, feature flags
- `lib/sentinel/eventQueue.ts` — 48h rolling queue with HUC index, dedup, disk+blob persistence
- `lib/sentinel/scoringEngine.ts` — Tier-2 scoring: time decay, compound patterns, geographic correlation
- `lib/sentinel/coordinationEngine.ts` — HUC-6 spatial clustering, multivariate detection
- `lib/sentinel/classificationEngine.ts` — Attack vs. benign classification, confounder gathering
- `lib/sentinel/classificationConfig.ts` — Confounder rules, attack signals, thresholds
- `lib/sentinel/coordinationConfig.ts` — Clustering weights, attack indicator pairs
- `lib/sentinel/parameterBaselines.ts` — 30-day rolling baselines per HUC-8+param (Welford's algorithm)
- `lib/sentinel/nwssCorrelationEngine.ts` — NWSS pathogen ↔ WQ event correlation
- `lib/sentinel/nwssCorrelationConfig.ts` — Bio-proxy parameter links, correlation weights
- `lib/sentinel/deduplication.ts` — 5 dedup rules applied at enqueue time
- `lib/sentinel/sentinelHealth.ts` — Per-source health tracking (HEALTHY/DEGRADED/OFFLINE)
- `lib/sentinel/hucAdjacency.ts` — Static HUC-8 adjacency from `data/huc8-adjacency.json`

### Sentinel Adapters
- `lib/sentinel/adapters/nwsAdapter.ts` — NWS_ALERTS
- `lib/sentinel/adapters/nwpsFloodAdapter.ts` — NWPS_FLOOD (flood-filtered NWS alerts)
- `lib/sentinel/adapters/usgsAdapter.ts` — USGS_IV
- `lib/sentinel/adapters/npdesAdapter.ts` — NPDES_DMR
- `lib/sentinel/adapters/echoAdapter.ts` — ECHO_ENFORCEMENT
- `lib/sentinel/adapters/attainsAdapter.ts` — ATTAINS
- `lib/sentinel/adapters/nwssAdapter.ts` — CDC_NWSS
- `lib/sentinel/adapters/femaAdapter.ts` — FEMA_DISASTER
- `lib/sentinel/adapters/qpeAdapter.ts` — QPE_RAINFALL
- `lib/sentinel/adapters/ssoAdapter.ts` — SSO_CSO
- `lib/sentinel/adapters/stateDischargeAdapter.ts` — STATE_DISCHARGE (stub)
- `lib/sentinel/adapters/nwpsForecastAdapter.ts` — NWPS_FORECAST (flood prediction)

### Alert Pipeline
- `lib/alerts/types.ts` — AlertEvent, AlertTriggerType (sentinel|usgs|delta|attains|nwss|coordination|fusion|custom)
- `lib/alerts/config.ts` — Feature flags, cooldowns, rate limits, blob paths
- `lib/alerts/engine.ts` — Core dispatch: dedup, cooldown, rate limit, recipient matching, enrichment
- `lib/alerts/enrichment.ts` — Gathers HUC context, deviations, classification, map links
- `lib/alerts/channels/email.ts` — Resend email with enrichment HTML sections
- `lib/alerts/recipients.ts` — Recipient management (blob-persisted)
- `lib/alerts/suppressions.ts` — Pattern-based suppression with expiry
- `lib/alerts/rules.ts` — Custom alert rules engine

### Alert Triggers
- `lib/alerts/triggers/sentinelTrigger.ts` — HUC escalation + source health (classification-gated)
- `lib/alerts/triggers/usgsTrigger.ts` — USGS IV thresholds (weather-confounder-gated)
- `lib/alerts/triggers/deltaTrigger.ts` — Cache rebuild delta detection
- `lib/alerts/triggers/nwssTrigger.ts` — NWSS pathogen anomalies with correlation metadata
- `lib/alerts/triggers/coordinationTrigger.ts` — Coordinated multi-site anomalies
- `lib/alerts/triggers/attainsTrigger.ts` — ATTAINS impairment changes
- `lib/alerts/triggers/floodForecastTrigger.ts` — Flood forecast predictions from NWPS
- `app/api/alerts/fusion-ingest/route.ts` — Fusion engine webhook receiver

### Cron Routes
- `app/api/cron/sentinel-poll/route.ts` — Adapter polling
- `app/api/cron/sentinel-score/route.ts` — Scoring + coordination + classification + NWSS correlation + LLM escalation
- `app/api/cron/dispatch-alerts/route.ts` — Alert evaluation + dispatch

### Frontend
- `components/SentinelStatusBadge.tsx` — Corner indicator (CRITICAL/WATCH counts)
- `components/SentinelBriefingCard.tsx` — National briefing (active HUCs + resolutions)
- `components/SentinelAlertPanel.tsx` — HUC detail overlay
- `components/AlertsManagementPanel.tsx` — Admin UI (recipients, rules, suppressions, history)
- `hooks/useSentinelAlerts.ts` — Polls `/api/sentinel-status` every 60s
- `components/FloodForecastCard.tsx` — Predicted flood exceedances with sparklines and lead times
- `hooks/useFloodForecast.ts` — Polls `/api/flood-forecast` every 2 min
- `app/api/flood-forecast/route.ts` — Returns predicted flood exceedances from NWPS gauge forecasts
- `lib/nwpsGaugeLookup.ts` — Flood stage thresholds from NWPS CSV (action/minor/moderate/major)

### Test Infrastructure
- `lib/sentinel/__tests__/attackSimulator.ts` — Generates simulated attack events
- `lib/sentinel/__tests__/scenarios.ts` — 4 pre-built scenarios
- `scripts/simulate-attack.ts` — CLI runner (`npx tsx scripts/simulate-attack.ts --scenario <name> [--dry-run]`)

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SENTINEL_ENABLED` | No | `true` | Master kill switch for sentinel polling/scoring |
| `SENTINEL_SCORING` | No | `true` | Enable Tier-2 scoring |
| `SENTINEL_LLM` | No | `false` | Enable LLM escalation for WATCH/CRITICAL HUCs |
| `SENTINEL_LOG_ONLY` | No | `false` | Log events without dispatching |
| `PIN_ALERTS_ENABLED` | Yes | `false` | Must be `true` for alerts to dispatch |
| `PIN_ALERTS_EMAIL` | No | `true` | Enable email channel |
| `PIN_ALERTS_LOG_ONLY` | No | `false` | Log alerts without sending emails |
| `RESEND_API_KEY` | Yes (for email) | — | Resend API key for email delivery |
| `ALERT_FROM_EMAIL` | No | `alerts@pin-dashboard.com` | Sender address |
| `CRON_SECRET` | Yes | — | Auth header for cron routes |

---

## Known Limitations

- **STATE_DISCHARGE adapter is a stub** — returns empty events. Waiting on MDE/state data integration.
- **Parameter baselines are lazy-loaded** — first classification cycle may have incomplete z-scores until baselines accumulate (~30 days of data).
- **Fusion engine is webhook-only** — requires external service to POST; no cron-driven trigger.
- **LLM escalation requires SENTINEL_LLM=true** and a working `/api/cron/generate-insights` endpoint.
- **Rate limit**: 20 emails/hour (Resend free tier). Coordinated attack scenario with many HUCs could hit this.
