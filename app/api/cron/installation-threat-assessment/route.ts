// app/api/cron/installation-threat-assessment/route.ts
// Comprehensive atmospheric threat assessment for ALL military installations.
// Monitors explosions, chemical releases, industrial accidents, and environmental threats.

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  getAllMilitaryInstallations,
  assessInstallationThreats,
  generateInstallationThreatAlerts,
} from '@/lib/installationThreatMonitoring';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[CRON] Starting comprehensive installation threat assessment...');

  try {
    const installations = getAllMilitaryInstallations();
    const currentHour = new Date().getUTCHours();
    const timeOfDay = (currentHour >= 6 && currentHour < 18) ? 'day' : 'night';

    console.log(`[CRON] Assessing ${installations.length} military installations (time: ${timeOfDay})`);

    // Assess all installations in parallel with batching to avoid timeout
    const batchSize = 10; // Process 10 installations at a time
    const allAssessments = [];

    for (let i = 0; i < installations.length; i += batchSize) {
      const batch = installations.slice(i, i + batchSize);
      console.log(`[CRON] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(installations.length / batchSize)}`);

      const batchAssessments = await Promise.all(
        batch.map(inst => assessInstallationThreats(inst.id, timeOfDay))
      );

      allAssessments.push(...batchAssessments);

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < installations.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const validAssessments = allAssessments.filter(Boolean);

    // Generate alerts
    const alerts = await generateInstallationThreatAlerts();
    const emergencyAlerts = alerts.filter(a => a.alertLevel === 'emergency');
    const warningAlerts = alerts.filter(a => a.alertLevel === 'warning');

    // Calculate threat distribution by type
    const threatTypes = ['explosion', 'chemical_release', 'industrial_accident', 'burn_pit', 'radiological', 'biological'];
    const threatDistribution = threatTypes.reduce((acc, type) => {
      acc[type] = validAssessments.filter(a =>
        a?.threats.some(t => t.scenario.type === type && t.probability > 0.3)
      ).length;
      return acc;
    }, {} as Record<string, number>);

    // Risk level distribution
    const riskCounts = {
      minimal: validAssessments.filter(a => a?.currentRiskLevel === 'minimal').length,
      low: validAssessments.filter(a => a?.currentRiskLevel === 'low').length,
      moderate: validAssessments.filter(a => a?.currentRiskLevel === 'moderate').length,
      high: validAssessments.filter(a => a?.currentRiskLevel === 'high').length,
      extreme: validAssessments.filter(a => a?.currentRiskLevel === 'extreme').length,
    };

    // Personnel statistics
    const totalPersonnel = validAssessments.reduce((sum, a) => sum + (a?.personnelCount || 0), 0);
    const personnelAtRisk = validAssessments
      .filter(a => a?.currentRiskLevel === 'high' || a?.currentRiskLevel === 'extreme')
      .reduce((sum, a) => sum + (a?.personnelCount || 0), 0);

    // Regional breakdown
    const regionalStats = {
      'middle-east': validAssessments.filter(a => a?.region === 'middle-east'),
      'indo-pacific': validAssessments.filter(a => a?.region === 'indo-pacific'),
      africa: validAssessments.filter(a => a?.region === 'africa'),
      europe: validAssessments.filter(a => a?.region === 'europe'),
      conus: validAssessments.filter(a => a?.region === 'conus'),
    };

    const result = {
      success: true,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      statistics: {
        totalInstallations: installations.length,
        assessmentsCompleted: validAssessments.length,
        alertsGenerated: alerts.length,
        emergencyAlerts: emergencyAlerts.length,
        warningAlerts: warningAlerts.length,
        totalPersonnel,
        personnelAtRisk,
        installationsAtRisk: riskCounts.high + riskCounts.extreme,
        riskDistribution: riskCounts,
        threatDistribution,
        regionalBreakdown: Object.keys(regionalStats).reduce((acc, region) => {
          const regionAssessments = regionalStats[region as keyof typeof regionalStats];
          acc[region] = {
            total: regionAssessments.length,
            atRisk: regionAssessments.filter(a => a.currentRiskLevel === 'high' || a.currentRiskLevel === 'extreme').length,
            personnel: regionAssessments.reduce((sum, a) => sum + a.personnelCount, 0),
          };
          return acc;
        }, {} as Record<string, any>),
      },
      criticalSituations: [
        ...emergencyAlerts.map(alert => ({
          installation: alert.installationName,
          threatType: alert.threatType,
          alertLevel: alert.alertLevel,
          message: alert.message,
          affectedArea: alert.affectedArea,
        })),
        ...warningAlerts.slice(0, 5).map(alert => ({ // Top 5 warnings
          installation: alert.installationName,
          threatType: alert.threatType,
          alertLevel: alert.alertLevel,
          message: alert.message,
          affectedArea: alert.affectedArea,
        })),
      ],
    };

    // Log critical alerts
    if (emergencyAlerts.length > 0) {
      console.log(`[CRON] 🚨 ${emergencyAlerts.length} EMERGENCY installation threat alerts:`);
      emergencyAlerts.forEach(alert => {
        console.log(`[CRON]   - ${alert.installationName}: ${alert.threatType.toUpperCase()} - ${alert.message}`);
      });
    }

    if (warningAlerts.length > 0) {
      console.log(`[CRON] ⚠️  ${warningAlerts.length} WARNING installation threat alerts`);
    }

    console.log(`[CRON] ✅ Installation threat assessment completed in ${Date.now() - startTime}ms`);
    console.log(`[CRON]   - Assessed: ${validAssessments.length}/${installations.length} installations`);
    console.log(`[CRON]   - Total alerts: ${alerts.length} (${emergencyAlerts.length} emergency, ${warningAlerts.length} warning)`);
    console.log(`[CRON]   - Personnel monitored: ${totalPersonnel.toLocaleString()}`);
    console.log(`[CRON]   - Personnel at risk: ${personnelAtRisk.toLocaleString()}`);
    console.log(`[CRON]   - Installations at risk: ${riskCounts.high + riskCounts.extreme}/${installations.length}`);

    // Log regional distribution
    Object.entries(regionalStats).forEach(([region, assessments]) => {
      const atRisk = assessments.filter(a => a.currentRiskLevel === 'high' || a.currentRiskLevel === 'extreme').length;
      if (atRisk > 0) {
        console.log(`[CRON]   - ${region}: ${atRisk}/${assessments.length} installations at risk`);
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[CRON] ❌ Installation threat assessment failed:', error);
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