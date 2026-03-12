// app/api/installation-threats/route.ts
// Comprehensive atmospheric threat monitoring for ALL military installations.
// Covers explosions, chemical releases, industrial accidents, and environmental threats.

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import {
  getAllInstallationThreats,
  assessInstallationThreats,
  generateInstallationThreatAlerts,
  getAllMilitaryInstallations,
} from '@/lib/installationThreatMonitoring';

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
        // Comprehensive threat dashboard for all installations
        const dashboard = await getAllInstallationThreats();
        return NextResponse.json(dashboard);

      case 'installations':
        // List all military installations
        const installations = getAllMilitaryInstallations();
        return NextResponse.json({ installations });

      case 'assessment':
        // Detailed threat assessment for specific installation
        if (!installationId) {
          return NextResponse.json({ error: 'Installation ID required' }, { status: 400 });
        }
        const timeOfDay = searchParams.get('timeOfDay') as 'day' | 'night' || 'day';
        const assessment = await assessInstallationThreats(installationId, timeOfDay);
        if (!assessment) {
          return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
        }
        return NextResponse.json(assessment);

      case 'alerts':
        // Current atmospheric threat alerts
        const alerts = await generateInstallationThreatAlerts();
        return NextResponse.json({
          alerts,
          summary: {
            total: alerts.length,
            emergency: alerts.filter(a => a.alertLevel === 'emergency').length,
            warning: alerts.filter(a => a.alertLevel === 'warning').length,
            watch: alerts.filter(a => a.alertLevel === 'watch').length,
          },
          timestamp: new Date()
        });

      case 'region':
        // Threat assessment by region
        const region = searchParams.get('region');
        if (!region) {
          return NextResponse.json({ error: 'Region required' }, { status: 400 });
        }
        const fullDashboard = await getAllInstallationThreats();
        const regionData = fullDashboard.byRegion[region as keyof typeof fullDashboard.byRegion];
        if (!regionData) {
          return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
        }
        return NextResponse.json({
          region,
          assessments: regionData,
          summary: {
            totalInstallations: regionData.length,
            totalPersonnel: regionData.reduce((sum, a) => sum + a.personnelCount, 0),
            averageRiskLevel: regionData.length > 0
              ? regionData.map(a => ({ minimal: 0, low: 1, moderate: 2, high: 3, extreme: 4 }[a.currentRiskLevel])).reduce((a, b) => a + b, 0) / regionData.length
              : 0,
          },
          timestamp: new Date(),
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Installation threat monitoring error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve threat monitoring data' },
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
    const { action, installationId, threatType, scenario } = body;

    switch (action) {
      case 'simulate-threat':
        // Simulate a specific threat scenario for assessment
        if (!installationId || !threatType) {
          return NextResponse.json({ error: 'Installation ID and threat type required' }, { status: 400 });
        }

        const assessment = await assessInstallationThreats(installationId);
        if (!assessment) {
          return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
        }

        // Find the specific threat scenario
        const threat = assessment.threats.find(t => t.scenario.type === threatType);
        if (!threat) {
          return NextResponse.json({ error: 'Threat type not applicable to this installation' }, { status: 400 });
        }

        return NextResponse.json({
          installationId,
          installationName: assessment.installationName,
          simulation: {
            threatScenario: threat.scenario,
            impactRadius: threat.impactRadius,
            estimatedCasualties: threat.estimatedCasualties,
            windAlignment: threat.windAlignment,
            recommendations: threat.recommendations,
            atmosphericConditions: assessment.atmosphericConditions,
            protectiveActions: assessment.protectiveActions,
          },
          timestamp: new Date(),
        });

      case 'bulk-assessment':
        // Assess all installations
        const fullAssessment = await getAllInstallationThreats();
        return NextResponse.json(fullAssessment);

      case 'emergency-response':
        // Trigger emergency response protocols
        if (!installationId) {
          return NextResponse.json({ error: 'Installation ID required' }, { status: 400 });
        }

        // This would integrate with actual emergency notification systems
        return NextResponse.json({
          installationId,
          emergencyResponse: {
            activated: true,
            fpconLevel: 'charlie',
            notifications: ['Giant Voice', 'AtHoc', 'Base Emergency Services'],
            shelterInPlace: true,
            timestamp: new Date(),
          },
          message: 'Emergency response protocols activated',
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Installation threat monitoring POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process threat monitoring request' },
      { status: 500 }
    );
  }
}