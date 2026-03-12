// app/api/burn-pit/monitoring/route.ts
// Real-time burn pit atmospheric monitoring for all installations with burn pit history.
// Provides risk assessment, alerts, and operational recommendations for force protection.

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import {
  getBurnPitMonitoringDashboard,
  assessBurnPitRisk,
  shouldSuspendBurnPitOps,
  generateBurnPitAlerts,
  getBurnPitInstallations,
} from '@/lib/burnPitMonitoring';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const installationId = searchParams.get('installation');
  const action = searchParams.get('action') || 'dashboard';

  try {
    switch (action) {
      case 'dashboard':
        // Full monitoring dashboard with all installations
        const dashboard = await getBurnPitMonitoringDashboard();
        return NextResponse.json(dashboard);

      case 'installations':
        // List all burn pit installations
        const installations = getBurnPitInstallations();
        return NextResponse.json({ installations });

      case 'assessment':
        // Risk assessment for specific installation
        if (!installationId) {
          return NextResponse.json({ error: 'Installation ID required' }, { status: 400 });
        }
        const timeOfDay = searchParams.get('timeOfDay') as 'day' | 'night' || 'day';
        const assessment = await assessBurnPitRisk(installationId, timeOfDay);
        if (!assessment) {
          return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
        }
        return NextResponse.json(assessment);

      case 'suspension-check':
        // Check if burn pit operations should be suspended
        if (!installationId) {
          return NextResponse.json({ error: 'Installation ID required' }, { status: 400 });
        }
        const suspensionStatus = await shouldSuspendBurnPitOps(installationId);
        return NextResponse.json(suspensionStatus);

      case 'alerts':
        // Current alerts for all installations
        const alerts = await generateBurnPitAlerts();
        return NextResponse.json({ alerts, timestamp: new Date() });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Burn pit monitoring error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve burn pit monitoring data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, installationId } = body;

    switch (action) {
      case 'force-assessment':
        // Force immediate assessment of installation conditions
        if (!installationId) {
          return NextResponse.json({ error: 'Installation ID required' }, { status: 400 });
        }
        const assessment = await assessBurnPitRisk(installationId);
        const suspensionStatus = await shouldSuspendBurnPitOps(installationId);

        return NextResponse.json({
          assessment,
          suspensionStatus,
          timestamp: new Date(),
        });

      case 'bulk-assessment':
        // Assess all installations
        const dashboard = await getBurnPitMonitoringDashboard();
        return NextResponse.json(dashboard);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Burn pit monitoring POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process burn pit monitoring request' },
      { status: 500 }
    );
  }
}