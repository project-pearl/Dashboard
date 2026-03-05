/* ------------------------------------------------------------------ */
/*  PIN Deployments — Current Readings API                            */
/*  Returns DeploymentInput[] for the deployment alert trigger.       */
/*  Currently mock data; will be replaced by real sonde telemetry.    */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import type { DeploymentInput } from '@/lib/alerts/triggers/deploymentTrigger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Mock deployments — same data as PEARLManagementCenter
  // Replace with real sonde API when telemetry goes live
  const deployments: DeploymentInput[] = [
    {
      id: 'dep-milton-fl-001',
      name: 'Milton FL Pilot',
      reading: {
        deploymentId: 'dep-milton-fl-001',
        deploymentName: 'Milton FL Pilot',
        timestamp: now,
        do_mgl: 7.2,
        temp_c: 18.4,
        ph: 7.1,
        turbidity_ntu: 4.2,
        tss_mgl: 8.5,
        flow_gpm: 340,
        salinity_psu: 0.3,
      },
      baseline: {
        do_mgl: 5.8,
        temp_c: 16.2,
        ph: 6.9,
        turbidity_ntu: 18.6,
        tss_mgl: 85.0,
        flow_gpm: 380,
        salinity_psu: 0.3,
      },
    },
    {
      id: 'dep-aa-county-001',
      name: 'Anne Arundel Demo',
      reading: null,  // not yet deployed
      baseline: {
        do_mgl: null,
        temp_c: null,
        ph: null,
        turbidity_ntu: null,
        tss_mgl: null,
        flow_gpm: null,
        salinity_psu: null,
      },
    },
  ];

  return NextResponse.json({ deployments });
}
