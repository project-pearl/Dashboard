/**
 * PIN Alerts — Triage Queue Auto-Population
 *
 * Called after dispatch to queue critical/anomaly alerts into the
 * Supabase triage_items table for persistent workflow tracking.
 */

import { createClient } from '@supabase/supabase-js';
import type { AlertEvent } from './types';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

const SEVERITY_PRIORITY: Record<string, number> = {
  anomaly: 4,
  critical: 3,
  warning: 2,
  info: 1,
};

/**
 * Extract a 2-letter state abbreviation from an AlertEvent.
 * Checks multiple patterns across metadata, entityLabel, and dedupKey.
 */
function extractState(event: AlertEvent): string | null {
  // 1. Explicit metadata.state
  const metaState = event.metadata?.state;
  if (typeof metaState === 'string' && /^[A-Z]{2}$/.test(metaState)) return metaState;

  // 2. Parse (XX) from entityLabel — e.g., "Potomac River (MD)"
  const labelMatch = event.entityLabel.match(/\(([A-Z]{2})\)/);
  if (labelMatch) return labelMatch[1];

  // 3. Parse from dedupKey patterns
  //    fusion|*|STATE|*, attains:STATE:*, hab:STATE:*, delta|STATE|*
  const keyParts = event.dedupKey.split(/[:|]/);
  for (const part of keyParts) {
    if (/^[A-Z]{2}$/.test(part)) return part;
  }

  return null;
}

/**
 * Queue critical/anomaly AlertEvents into the triage_items table.
 * Uses UPSERT with ignoreDuplicates on alert_dedup_key so already-triaged
 * items are not overwritten.
 *
 * @returns Number of items successfully queued (0 if Supabase unavailable)
 */
export async function queueTriageItems(candidateEvents: AlertEvent[]): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  // Only queue anomaly and critical severity
  const triageable = candidateEvents.filter(
    e => e.severity === 'anomaly' || e.severity === 'critical',
  );
  if (triageable.length === 0) return 0;

  const rows = triageable.map(e => ({
    alert_dedup_key: e.dedupKey,
    alert_type: e.type,
    alert_severity: e.severity,
    title: e.title,
    body: e.body,
    entity_id: e.entityId,
    entity_label: e.entityLabel,
    state: extractState(e),
    priority: SEVERITY_PRIORITY[e.severity] ?? 0,
    metadata: e.metadata ?? {},
  }));

  const { data, error } = await supabase
    .from('triage_items')
    .upsert(rows, { onConflict: 'alert_dedup_key', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.error('[triage-queue] Supabase upsert error:', error.message);
    return 0;
  }

  return data?.length ?? 0;
}
