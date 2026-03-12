// app/api/cron/burn-pit-assessment/route.ts
// Periodic burn pit atmospheric assessment for force protection.
// Evaluates atmospheric conditions at all burn pit installations.

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  getBurnPitInstallations,
  assessBurnPitRisk,
  generateBurnPitAlerts,
} from '@/lib/burnPitMonitoring';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[CRON] Starting burn pit atmospheric assessment...');

  try {
    const installations = getBurnPitInstallations();
    const currentHour = new Date().getUTCHours();
    const timeOfDay = (currentHour >= 6 && currentHour < 18) ? 'day' : 'night';

    console.log(`[CRON] Assessing ${installations.length} burn pit installations (time: ${timeOfDay})`);

    // Assess all installations in parallel
    const assessmentPromises = installations.map(inst =>
      assessBurnPitRisk(inst.id, timeOfDay)
    );

    const assessments = await Promise.all(assessmentPromises);
    const validAssessments = assessments.filter(Boolean);

    // Generate alerts
    const alerts = await generateBurnPitAlerts();
    const criticalAlerts = alerts.filter(a => a.severity === 'extreme' || a.severity === 'high');

    // Summary statistics
    const riskCounts = {
      minimal: validAssessments.filter(a => a?.riskLevel === 'minimal').length,
      low: validAssessments.filter(a => a?.riskLevel === 'low').length,
      moderate: validAssessments.filter(a => a?.riskLevel === 'moderate').length,
      high: validAssessments.filter(a => a?.riskLevel === 'high').length,
      extreme: validAssessments.filter(a => a?.riskLevel === 'extreme').length,
    };

    const totalPersonnelAtRisk = validAssessments.reduce((sum, a) => sum + (a?.personnelAtRisk || 0), 0);
    const suspensionRequired = riskCounts.high + riskCounts.extreme;

    const result = {
      success: true,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      statistics: {
        totalInstallations: installations.length,
        assessmentsCompleted: validAssessments.length,
        alertsGenerated: alerts.length,
        criticalAlerts: criticalAlerts.length,
        totalPersonnelAtRisk,
        installationsRequiringSuspension: suspensionRequired,
        riskDistribution: riskCounts,
      },
      criticalAlerts: criticalAlerts.map(alert => ({
        installation: alert.installationName,
        severity: alert.severity,
        message: alert.message,
        exposureRadius: alert.estimatedExposureRadius,
      })),
    };

    // Log critical alerts
    if (criticalAlerts.length > 0) {
      console.log(`[CRON] ⚠️  ${criticalAlerts.length} CRITICAL burn pit alerts generated:`);
      criticalAlerts.forEach(alert => {
        console.log(`[CRON]   - ${alert.installationName}: ${alert.severity.toUpperCase()} - ${alert.message}`);
      });
    }

    console.log(`[CRON] ✅ Burn pit assessment completed in ${Date.now() - startTime}ms`);
    console.log(`[CRON]   - Assessed: ${validAssessments.length}/${installations.length} installations`);
    console.log(`[CRON]   - Alerts: ${alerts.length} total, ${criticalAlerts.length} critical`);
    console.log(`[CRON]   - Personnel at risk: ${totalPersonnelAtRisk.toLocaleString()}`);
    console.log(`[CRON]   - Requiring suspension: ${suspensionRequired} installations`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[CRON] ❌ Burn pit assessment failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}