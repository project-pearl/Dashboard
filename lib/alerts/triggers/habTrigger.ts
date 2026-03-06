/* ------------------------------------------------------------------ */
/*  PIN Alerts — HABSOS Harmful Algal Bloom Trigger                   */
/*                                                                    */
/*  Evaluates HAB observations for dangerous cell counts and          */
/*  generates alerts based on genus-specific thresholds.              */
/*                                                                    */
/*  Cooldown: 7 days per state+genus.                                 */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { ensureWarmed, getHabsosAll, type HabObservation } from '../../habsosCache';

/* ------------------------------------------------------------------ */
/*  Genus-Specific Thresholds (cells/L)                               */
/* ------------------------------------------------------------------ */

interface GenusThreshold {
  warning: number;
  critical: number;
  risk: string;
}

const GENUS_THRESHOLDS: Record<string, GenusThreshold> = {
  'Karenia':           { warning: 100_000, critical: 1_000_000, risk: 'Respiratory/neurotoxin (brevetoxin)' },
  'Karenia brevis':    { warning: 100_000, critical: 1_000_000, risk: 'Respiratory/neurotoxin (brevetoxin)' },
  'Microcystis':       { warning:  20_000, critical:   100_000, risk: 'Cyanotoxin (microcystin)' },
  'Pseudo-nitzschia':  { warning:  50_000, critical:   200_000, risk: 'Domoic acid' },
};

const FALLBACK_THRESHOLD: GenusThreshold = {
  warning:  500_000,
  critical: 2_000_000,
  risk: 'General HAB',
};

function getThreshold(genus: string): GenusThreshold {
  // Check exact match first, then prefix match
  if (GENUS_THRESHOLDS[genus]) return GENUS_THRESHOLDS[genus];
  for (const [key, val] of Object.entries(GENUS_THRESHOLDS)) {
    if (genus.toLowerCase().startsWith(key.toLowerCase())) return val;
  }
  return FALLBACK_THRESHOLD;
}

/* ------------------------------------------------------------------ */
/*  Snapshot — tracks which state+genus combos we've alerted on       */
/* ------------------------------------------------------------------ */

interface HabAlertSnapshot {
  /** state_genus → last alert ISO timestamp */
  lastAlertedAt: Record<string, string>;
  takenAt: string;
}

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluateHabAlerts(): Promise<AlertEvent[]> {
  await ensureWarmed();

  const observations = getHabsosAll();
  if (observations.length === 0) return [];

  const previousSnapshot = await loadCacheFromBlob<HabAlertSnapshot>(BLOB_PATHS.habSnapshot);
  const prevAlerted = previousSnapshot?.lastAlertedAt ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const events: AlertEvent[] = [];
  const newAlerted: Record<string, string> = { ...prevAlerted };

  // Aggregate: find max cell count per state+genus
  const stateGenusMax = new Map<string, { obs: HabObservation; maxCount: number }>();

  for (const obs of observations) {
    if (!obs.genus || obs.cellCount <= 0) continue;
    const key = `${obs.state}_${obs.genus}`;
    const existing = stateGenusMax.get(key);
    if (!existing || obs.cellCount > existing.maxCount) {
      stateGenusMax.set(key, { obs, maxCount: obs.cellCount });
    }
  }

  for (const [key, { obs, maxCount }] of stateGenusMax) {
    const threshold = getThreshold(obs.genus);

    // Skip if below warning threshold
    if (maxCount < threshold.warning) continue;

    // Cooldown check
    const lastAlerted = prevAlerted[key];
    if (lastAlerted && (now.getTime() - new Date(lastAlerted).getTime()) < COOLDOWN_MS) {
      continue;
    }

    const severity = maxCount >= threshold.critical ? 'critical' : 'warning';
    const countStr = maxCount.toLocaleString();

    events.push({
      id: crypto.randomUUID(),
      type: 'hab',
      severity,
      title: `${obs.genus} HAB ${severity === 'critical' ? 'crisis' : 'alert'} — ${obs.state}`,
      body: `${obs.genus} cell count ${countStr} cells/L in ${obs.state} ` +
        `(threshold: ${threshold.warning.toLocaleString()} warning, ${threshold.critical.toLocaleString()} critical). ` +
        `Risk: ${threshold.risk}.`,
      entityId: `${obs.state}:${obs.genus}`,
      entityLabel: `${obs.genus} in ${obs.state}`,
      dedupKey: `hab:${obs.state}:${obs.genus}:${severity}`,
      createdAt: nowIso,
      channel: 'email',
      recipientEmail: '',
      sent: false,
      sentAt: null,
      error: null,
      ruleId: null,
      metadata: {
        genus: obs.genus,
        cellCount: maxCount,
        warningThreshold: threshold.warning,
        criticalThreshold: threshold.critical,
        risk: threshold.risk,
        lat: obs.lat,
        lng: obs.lng,
        sampleDate: obs.sampleDate,
      },
    });

    newAlerted[key] = nowIso;
  }

  // Save updated snapshot
  await saveCacheToBlob(BLOB_PATHS.habSnapshot, {
    lastAlertedAt: newAlerted,
    takenAt: nowIso,
  });

  return events;
}
