/* ------------------------------------------------------------------ */
/*  PIN Alerts — Coordination Trigger                                 */
/*  Maps CoordinatedEvent[] → AlertEvent[] for the dispatch pipeline. */
/*  Always severity critical (coordinated events are high-priority).  */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from '../types';
import type { CoordinatedEvent } from '../../sentinel/types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';

/* ------------------------------------------------------------------ */
/*  Snapshot                                                          */
/* ------------------------------------------------------------------ */

interface CoordinationSnapshot {
  dispatched: Record<string, string>; // dedupKey → last ISO timestamp
  takenAt: string;
}

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluateCoordinationAlerts(
  coordinated: CoordinatedEvent[],
): Promise<AlertEvent[]> {
  if (coordinated.length === 0) return [];

  const previousSnapshot = await loadCacheFromBlob<CoordinationSnapshot>(
    BLOB_PATHS.coordinationSnapshot,
  );
  const prevDispatched = previousSnapshot?.dispatched ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const events: AlertEvent[] = [];
  const newDispatched: Record<string, string> = { ...prevDispatched };

  for (const coord of coordinated) {
    const dedupKey = `coordination-${coord.huc6}-${Math.floor(Date.now() / COOLDOWN_MS)}`;

    // Cooldown check
    const lastDispatched = prevDispatched[dedupKey];
    if (lastDispatched && (now.getTime() - new Date(lastDispatched).getTime()) < COOLDOWN_MS) {
      continue;
    }

    const hucList = coord.memberHucs.join(', ');
    const spreadMin = Math.round(coord.temporalSpread / 60_000);

    events.push({
      id: crypto.randomUUID(),
      type: 'coordination',
      severity: 'critical',
      title: `Coordinated anomaly detected — HUC-6 ${coord.huc6}`,
      body: `${coord.memberHucs.length} HUC-8 basins (${hucList}) showing correlated anomalies ` +
        `within ${spreadMin} minutes. Coordination score: ${coord.coordinationScore.toFixed(2)}. ` +
        `${coord.parameterBreadth} distinct parameters involved across ${coord.memberEvents.length} events.`,
      entityId: coord.huc6,
      entityLabel: `HUC-6 ${coord.huc6} cluster`,
      dedupKey,
      createdAt: nowIso,
      channel: 'email',
      recipientEmail: '',
      sent: false,
      sentAt: null,
      error: null,
      ruleId: null,
      metadata: {
        coordinationScore: coord.coordinationScore,
        clusterSize: coord.memberHucs.length,
        memberHucs: coord.memberHucs,
        parameterBreadth: coord.parameterBreadth,
        temporalSpreadMs: coord.temporalSpread,
        eventCount: coord.memberEvents.length,
      },
    });

    newDispatched[dedupKey] = nowIso;
  }

  // Expire old entries (>24h)
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(newDispatched)) {
    if (new Date(ts).getTime() < cutoff) delete newDispatched[key];
  }

  await saveCacheToBlob(BLOB_PATHS.coordinationSnapshot, {
    dispatched: newDispatched,
    takenAt: nowIso,
  });

  return events;
}
