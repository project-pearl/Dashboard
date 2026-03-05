/* ------------------------------------------------------------------ */
/*  PIN Alerts — Flood Forecast Alert Trigger                         */
/*                                                                    */
/*  Maps NWPS forecast exceedances from the sentinel event queue      */
/*  into AlertEvent[] for dispatch.                                   */
/*                                                                    */
/*  Only triggers on forecast floods (not current observations).      */
/*  Uses snapshot-based cooldown to avoid re-alerting on the same     */
/*  gauge at the same flood category.                                 */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertSeverity } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { getAllEvents, ensureWarmed as warmQueue } from '../../sentinel/eventQueue';

/* ------------------------------------------------------------------ */
/*  Snapshot — tracks which forecast alerts we've already dispatched  */
/* ------------------------------------------------------------------ */

interface ForecastSnapshot {
  dispatched: Record<string, string>; // dedupKey → ISO timestamp
  takenAt: string;
}

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours (forecasts don't change rapidly)

/* ------------------------------------------------------------------ */
/*  Severity Mapping                                                  */
/* ------------------------------------------------------------------ */

function mapSeverity(floodCategory: string, hoursUntil: number): AlertSeverity {
  // Major flood predicted soon = critical
  if (floodCategory === 'major') return 'critical';
  if (floodCategory === 'moderate' && hoursUntil < 12) return 'critical';
  if (floodCategory === 'moderate') return 'warning';
  if (floodCategory === 'minor' && hoursUntil < 6) return 'warning';
  return 'info';
}

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluateFloodForecasts(): Promise<AlertEvent[]> {
  await warmQueue();

  const allEvents = getAllEvents();
  // Filter for NWPS_FORECAST events from the last 1 hour
  const cutoff = Date.now() - 60 * 60 * 1000;
  const forecastEvents = allEvents.filter(
    e => e.source === 'NWPS_FORECAST'
      && e.changeType === 'THRESHOLD_CROSSED'
      && new Date(e.detectedAt).getTime() > cutoff,
  );

  if (forecastEvents.length === 0) return [];

  const snapshot = await loadCacheFromBlob<ForecastSnapshot>(BLOB_PATHS.floodForecastSnapshot);
  const prevDispatched = snapshot?.dispatched ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const events: AlertEvent[] = [];
  const newDispatched: Record<string, string> = { ...prevDispatched };

  for (const fe of forecastEvents) {
    const lid = fe.payload?.lid as string || fe.metadata?.sourceRecordId || '';
    const category = fe.payload?.floodCategory as string || 'unknown';
    const dedupKey = `flood-forecast-${lid}-${category}`;

    // Cooldown check
    const lastDispatched = prevDispatched[dedupKey];
    if (lastDispatched && (now.getTime() - new Date(lastDispatched).getTime()) < COOLDOWN_MS) {
      continue;
    }

    const hoursUntil = (fe.payload?.hoursUntil as number) ?? 0;
    const severity = mapSeverity(category, hoursUntil);
    const gaugeName = (fe.payload?.gaugeName as string) || lid;
    const state = fe.geography?.stateAbbr || '';
    const leadTime = (fe.payload?.leadTime as string) || `${Math.round(hoursUntil)}h`;
    const forecastStage = (fe.payload?.forecastStage as number) ?? 0;
    const threshold = (fe.payload?.threshold as number) ?? 0;
    const unit = (fe.payload?.unit as string) || 'ft';
    const currentStage = fe.payload?.currentStage as number | null;

    const stageInfo = currentStage != null
      ? `Current: ${currentStage} ${unit} → Forecast: ${forecastStage} ${unit} (${category} flood stage: ${threshold} ${unit})`
      : `Forecast: ${forecastStage} ${unit} (${category} flood stage: ${threshold} ${unit})`;

    events.push({
      id: crypto.randomUUID(),
      type: 'flood_forecast',
      severity,
      title: `Flood Prediction: ${gaugeName} — ${category} flooding ${leadTime}`,
      body: `${gaugeName} (${state}) is predicted to reach ${category} flood stage ${leadTime}. ${stageInfo}`,
      entityId: lid,
      entityLabel: `${gaugeName} (${state})`,
      dedupKey,
      createdAt: nowIso,
      channel: 'email',
      recipientEmail: '',
      sent: false,
      sentAt: null,
      error: null,
      ruleId: null,
      metadata: {
        lid,
        gaugeName,
        floodCategory: category,
        forecastStage,
        threshold,
        unit,
        hoursUntil,
        leadTime,
        currentStage,
        forecastTime: fe.payload?.forecastTime,
        lat: fe.geography?.lat,
        lng: fe.geography?.lng,
      },
    });

    newDispatched[dedupKey] = nowIso;
  }

  // Expire old entries (>48h)
  const expiryCutoff = now.getTime() - 48 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(newDispatched)) {
    if (new Date(ts).getTime() < expiryCutoff) {
      delete newDispatched[key];
    }
  }

  await saveCacheToBlob(BLOB_PATHS.floodForecastSnapshot, {
    dispatched: newDispatched,
    takenAt: nowIso,
  });

  return events;
}
