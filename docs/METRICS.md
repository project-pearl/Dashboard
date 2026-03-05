# PIN Sentinel — Validation Metrics

> Auto-generated on 2026-03-05 by `scripts/validate-sentinel.ts`

## System Description

PIN Sentinel is a real-time water-quality threat detection pipeline that ingests change events from 12 federal data sources, scores HUC-8 basins using time-decayed compound patterns, detects spatial coordination across HUC-6 clusters, and classifies anomalies as attack vs. benign using rule-based confounder analysis.

## Aggregate Metrics

| Metric | Value |
|--------|-------|
| Precision | 1 |
| Recall | 1 |
| F1 Score | 1 |
| Accuracy | 1 |
| Mean Detection Latency | 2ms |
| Scenarios Passed | 6/6 |

## Scenario Results

| # | Scenario | Expected | Actual | Coord | Latency | Result |
|---|----------|----------|--------|-------|---------|--------|
| 1 | single-point-contamination | likely_attack | likely_attack | 0.000 | 5ms | **PASS** |
| 2 | coordinated-multi-site | likely_attack | likely_attack | 0.917 | 2ms | **PASS** |
| 3 | slow-roll-poisoning | possible_attack | possible_attack | 0.000 | 1ms | **PASS** |
| 4 | bio-threat-with-nwss | likely_attack | likely_attack | 0.642 | 2ms | **PASS** |
| 5 | single-basin-false-positive | likely_benign | likely_benign | 0.000 | 1ms | **PASS** |
| 6 | weather-confounded-multi-site | likely_benign | likely_benign | 0.743 | 1ms | **PASS** |

## Per-Scenario Detail

### single-point-contamination

**Description:** Single HUC-8 — 3 parameters spike simultaneously within 2 hours (chemical dump pattern)

- Events generated: 3
- HUCs scored: 1
- Threat score: 1
- Classification: likely_attack (expected: likely_attack)
- Coordination: 0.000 (expected range: [0, 0.3])
- Detection latency: 5ms

**Reasoning chain:**

- [boost] CHEMICAL_DUMP: Chemical Contamination: Simultaneous conductivity + pH/DO shifts suggest chemical contamination

**Result:** PASS

### coordinated-multi-site

**Description:** 4 adjacent HUC-8s in same HUC-6 — 3 parameters spike staggered 30 min apart (coordinated attack)

- Events generated: 12
- HUCs scored: 4
- Threat score: 1
- Classification: likely_attack (expected: likely_attack)
- Coordination: 0.917 (expected range: [0.6, 1])
- Detection latency: 2ms

**Reasoning chain:**

- [boost] CHEMICAL_DUMP: Chemical Contamination: Simultaneous conductivity + pH/DO shifts suggest chemical contamination

**Result:** PASS

### slow-roll-poisoning

**Description:** Single HUC-8 — gradual contamination over 12 hours, subtle (2-3σ) deviations

- Events generated: 2
- HUCs scored: 1
- Threat score: 0.4
- Classification: possible_attack (expected: possible_attack)
- Coordination: 0.000 (expected range: [0, 0.3])
- Detection latency: 1ms

**Reasoning chain:**

- [boost] CHEMICAL_DUMP: Chemical Contamination: Simultaneous conductivity + pH/DO shifts suggest chemical contamination

**Result:** PASS

### bio-threat-with-nwss

**Description:** NWSS pathogen spike in wastewater + downstream WQ anomalies in 3 HUCs 24h later

- Events generated: 7
- HUCs scored: 3
- Threat score: 1
- Classification: likely_attack (expected: likely_attack)
- Coordination: 0.642 (expected range: [0.5, 0.9])
- Detection latency: 2ms

**Reasoning chain:**

- [boost] compound_patterns: 1 active compound pattern(s): bio-threat-correlation
- [boost] BIO_MARKER_SPIKE: Bio-Marker Spike: DO crash with turbidity spike indicates biological contamination event

**Result:** PASS

### single-basin-false-positive

**Description:** Single HUC-8, single parameter, minor (1.2x) conductivity blip — tests specificity

- Events generated: 1
- HUCs scored: 1
- Threat score: 0.1
- Classification: likely_benign (expected: likely_benign)
- Coordination: 0.000 (expected range: [0, 0.1])
- Detection latency: 1ms

**Result:** PASS

### weather-confounded-multi-site

**Description:** 4 HUCs with turbidity+conductivity spikes, but heavy rainfall confounds — tests weather separation

- Events generated: 12
- HUCs scored: 4
- Threat score: 0.4
- Classification: likely_benign (expected: likely_benign)
- Coordination: 0.743 (expected range: [0.5, 1])
- Detection latency: 1ms

**Reasoning chain:**

- [reduce] RAINFALL_CONFOUNDER: Heavy Rainfall: Recent rainfall: 3.5 inches in 24h

**Result:** PASS

## Methodology

1. Each scenario defines a set of simulated `ChangeEvent` objects with known deviations, geographies, and timing.
2. Events are injected into a clean event queue, scored by the Tier-2 scoring engine, analyzed for spatial coordination, and classified by the rule-based classification engine.
3. Results are compared against expected classifications and coordination score ranges.
4. Precision/recall/F1 are computed using standard binary classification where "positive" = `likely_attack` or `possible_attack`.

## Limitations

- **Synthetic data only.** Scenarios use simulated events with idealized timing and parameter values. Real-world data would exhibit noise, missing values, and partial coverage.
- **No historical replay.** Validation does not replay historical contamination events — it uses pre-defined attack patterns.
- **Deterministic confounders.** Weather confounders are injected directly rather than fetched from live APIs.
- **In-process execution.** Validation runs in-process without network I/O, so latency numbers reflect compute time only.
