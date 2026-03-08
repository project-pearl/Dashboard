// app/api/alerts/fusion-ingest/route.ts
// Webhook receiver for Fusion Engine coordinated anomaly alerts.
// Transforms CoordinatedAnomaly → AlertEvent and dispatches via the existing alert engine.

import { NextRequest, NextResponse } from 'next/server';
import { dispatchAlerts } from '@/lib/alerts/engine';
import { isAuthorized } from '@/lib/apiAuth';
import type { AlertEvent, AlertSeverity } from '@/lib/alerts/types';
import { fusionIngestSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';

export const dynamic = 'force-dynamic';

/** Map fusion severity to alert severity */
function mapSeverity(fusionSeverity: string): AlertSeverity {
  switch (fusionSeverity) {
    case 'CRITICAL': return 'critical';
    case 'HIGH': return 'critical';
    case 'MODERATE': return 'warning';
    default: return 'info';
  }
}

interface FusionAnomaly {
  id: string;
  detectedAt: string;
  affectedBasins: string[];
  triggers: Array<{
    huc8: string;
    parameter: string;
    zScore: number;
    severity: string;
  }>;
  statisticalEvidence: {
    confidence: number;
    correlatedBasins: string[];
  };
  confidence: number;
  severity: string;
  narrative: string;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = await parseBody(request, fusionIngestSchema);
    if (!parsed.success) return parsed.error;
    const { source, anomaly } = parsed.data;

    const severity = mapSeverity(anomaly.severity);
    const entityId = anomaly.affectedBasins.join(',');

    const event: AlertEvent = {
      id: crypto.randomUUID(),
      type: 'fusion',
      severity,
      title: `Coordinated Water Quality Anomaly — ${anomaly.severity}`,
      body: anomaly.narrative,
      entityId,
      entityLabel: `${anomaly.affectedBasins.length} basins (${anomaly.affectedBasins.slice(0, 3).join(', ')}${anomaly.affectedBasins.length > 3 ? '...' : ''})`,
      dedupKey: `fusion|${entityId}|${severity}`,
      createdAt: anomaly.detectedAt || new Date().toISOString(),
      channel: 'email',
      recipientEmail: '', // Filled by dispatchAlerts per recipient
      sent: false,
      sentAt: null,
      error: null,
      ruleId: null,
      metadata: {
        fusionId: anomaly.id,
        confidence: anomaly.confidence,
        triggerCount: anomaly.triggers.length,
        parameterCount: new Set(anomaly.triggers.map(t => t.parameter)).size,
        basinCount: anomaly.affectedBasins.length,
      },
    };

    const result = await dispatchAlerts([event]);

    return NextResponse.json({
      status: 'ok',
      anomalyId: anomaly.id,
      dispatched: result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[fusion-ingest] Error:', msg);
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}
