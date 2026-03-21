/**
 * HUC-14 Premium Tier API
 *
 * GET /api/huc14-premium?huc14=... - Get specific HUC-14 analysis
 * GET /api/huc14-premium?huc12=... - Get all HUC-14s within HUC-12
 * GET /api/huc14-premium?summary=true - Get premium tier overview
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ensureWarmed,
  getIndicesForHuc14,
  getHuc14sForHuc12,
  getAllHuc14Indices,
  getRawDataForHuc14,
  getHuc14History,
  getHuc14CacheStatus,
  getPremiumTierStats
} from '@/lib/indices/huc14Cache';
import { getRegionsForHuc12, isHuc14Eligible, HIGH_VALUE_REGIONS } from '@/lib/indices/huc14Regions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const huc14 = searchParams.get('huc14');
  const huc12 = searchParams.get('huc12');
  const summary = searchParams.get('summary') === 'true';
  const history = searchParams.get('history') === 'true';
  const raw = searchParams.get('raw') === 'true';

  try {
    await ensureWarmed();

    // Premium tier summary
    if (summary) {
      return handleSummaryRequest();
    }

    // Specific HUC-14 lookup
    if (huc14) {
      return handleHuc14Request(huc14, history, raw);
    }

    // All HUC-14s within HUC-12
    if (huc12) {
      return handleHuc12Request(huc12);
    }

    // Default: return all premium regions overview
    return handleOverviewRequest();

  } catch (error) {
    console.error('[HUC-14 Premium API] Error:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Handle premium tier summary request
 */
function handleSummaryRequest() {
  const cacheStatus = getHuc14CacheStatus();
  const premiumStats = getPremiumTierStats();

  const regionCounts = {
    metropolitan: HIGH_VALUE_REGIONS.filter(r => r.type === 'metropolitan').length,
    infrastructure: HIGH_VALUE_REGIONS.filter(r => r.type === 'infrastructure').length,
    superfund: HIGH_VALUE_REGIONS.filter(r => r.type === 'superfund').length,
    military: HIGH_VALUE_REGIONS.filter(r => r.type === 'military').length
  };

  return NextResponse.json({
    status: 'success',
    premiumTier: {
      available: cacheStatus.built,
      coverage: cacheStatus.coverage,
      statistics: premiumStats,
      regionTypes: regionCounts,
      dataQuality: {
        avgSpatialResolution: premiumStats?.dataQuality?.avgSpatialResolution || null,
        avgTemporalResolution: premiumStats?.dataQuality?.avgTemporalResolution || null,
        refreshFrequency: '6 hours'
      },
      pricing: {
        tierName: 'PIN Precision+',
        annualCost: '$150,000 per region',
        totalMarketValue: regionCounts.metropolitan + regionCounts.infrastructure +
                         regionCounts.superfund + regionCounts.military * 150_000
      }
    },
    cache: {
      loaded: cacheStatus.loaded,
      built: cacheStatus.built,
      lastBuild: cacheStatus.lastBuild,
      huc14Count: cacheStatus.huc14Count
    },
    capabilities: [
      'Sub-subwatershed analysis (1-10 sq miles)',
      'Facility-level contamination tracking',
      'Enhanced monitoring network analysis',
      'Emergency response capability assessment',
      'Stakeholder engagement indexing',
      'Real-time data integration',
      'Premium composite scoring'
    ]
  });
}

/**
 * Handle specific HUC-14 request
 */
function handleHuc14Request(huc14: string, includeHistory: boolean, includeRaw: boolean) {
  const indices = getIndicesForHuc14(huc14);

  if (!indices) {
    return NextResponse.json({
      status: 'not_found',
      message: `HUC-14 ${huc14} not found in premium cache`,
      suggestion: 'Verify HUC-14 code or check if region qualifies for premium tier'
    }, { status: 404 });
  }

  const response: any = {
    status: 'success',
    huc14: indices.huc14,
    huc12: indices.huc12,
    indices,
    regionInfo: {
      type: indices.regionType,
      priority: indices.priority,
      regions: getRegionsForHuc12(indices.huc12)
    },
    premiumFeatures: {
      facilityRisk: indices.facilityRiskIndex,
      contaminantMobility: indices.contaminantMobilityIndex,
      monitoringAdequacy: indices.monitoringAdequacyIndex,
      emergencyResponse: indices.emergencyResponseIndex,
      stakeholderEngagement: indices.stakeholderEngagementIndex
    },
    scores: {
      standard: indices.composite,
      premium: indices.premiumScore,
      confidence: {
        standard: indices.compositeConfidence,
        premium: indices.premiumConfidence
      }
    },
    dataQuality: {
      overall: indices.dataQuality,
      spatialResolution: indices.spatialResolution,
      temporalResolution: indices.temporalResolution,
      lastCalculated: indices.lastCalculated
    }
  };

  // Include history if requested
  if (includeHistory) {
    response.history = getHuc14History(huc14);
  }

  // Include raw data if requested
  if (includeRaw) {
    response.rawData = getRawDataForHuc14(huc14);
  }

  return NextResponse.json(response);
}

/**
 * Handle HUC-12 request (all HUC-14s within)
 */
function handleHuc12Request(huc12: string) {
  if (!isHuc14Eligible(huc12)) {
    return NextResponse.json({
      status: 'not_eligible',
      message: `HUC-12 ${huc12} is not eligible for premium HUC-14 analysis`,
      eligibleRegions: HIGH_VALUE_REGIONS
        .filter(r => r.premiumTier)
        .map(r => ({
          name: r.name,
          type: r.type,
          priority: r.priority,
          huc12Coverage: r.huc12Coverage
        }))
    }, { status: 400 });
  }

  const huc14Indices = getHuc14sForHuc12(huc12);
  const regions = getRegionsForHuc12(huc12);

  if (huc14Indices.length === 0) {
    return NextResponse.json({
      status: 'no_data',
      message: `No HUC-14 data available for HUC-12 ${huc12}`,
      regions,
      suggestion: 'Premium data may still be processing. Check back later.'
    }, { status: 404 });
  }

  // Calculate summary statistics
  const avgPremiumScore = huc14Indices.reduce((sum, idx) => sum + idx.premiumScore, 0) / huc14Indices.length;
  const avgConfidence = huc14Indices.reduce((sum, idx) => sum + idx.premiumConfidence, 0) / huc14Indices.length;

  const facilityRiskStats = {
    min: Math.min(...huc14Indices.map(idx => idx.facilityRiskIndex.value)),
    max: Math.max(...huc14Indices.map(idx => idx.facilityRiskIndex.value)),
    avg: huc14Indices.reduce((sum, idx) => sum + idx.facilityRiskIndex.value, 0) / huc14Indices.length
  };

  return NextResponse.json({
    status: 'success',
    huc12,
    regions,
    huc14Count: huc14Indices.length,
    summary: {
      avgPremiumScore: Math.round(avgPremiumScore),
      avgConfidence: Math.round(avgConfidence),
      facilityRiskStats: {
        min: facilityRiskStats.min,
        max: facilityRiskStats.max,
        avg: Math.round(facilityRiskStats.avg)
      },
      riskDistribution: {
        critical: huc14Indices.filter(idx => idx.priority === 'critical').length,
        high: huc14Indices.filter(idx => idx.priority === 'high').length,
        medium: huc14Indices.filter(idx => idx.priority === 'medium').length
      }
    },
    huc14Indices: huc14Indices.map(idx => ({
      huc14: idx.huc14,
      premiumScore: idx.premiumScore,
      confidence: idx.premiumConfidence,
      priority: idx.priority,
      facilityRisk: idx.facilityRiskIndex.value,
      contaminantMobility: idx.contaminantMobilityIndex.value,
      monitoringAdequacy: idx.monitoringAdequacyIndex.value
    }))
  });
}

/**
 * Handle overview request
 */
function handleOverviewRequest() {
  const allIndices = getAllHuc14Indices();
  const cacheStatus = getHuc14CacheStatus();

  const typeBreakdown = {
    metropolitan: allIndices.filter(idx => idx.regionType === 'metropolitan').length,
    infrastructure: allIndices.filter(idx => idx.regionType === 'infrastructure').length,
    superfund: allIndices.filter(idx => idx.regionType === 'superfund').length,
    military: allIndices.filter(idx => idx.regionType === 'military').length
  };

  const priorityBreakdown = {
    critical: allIndices.filter(idx => idx.priority === 'critical').length,
    high: allIndices.filter(idx => idx.priority === 'high').length,
    medium: allIndices.filter(idx => idx.priority === 'medium').length
  };

  const topRegions = allIndices
    .sort((a, b) => b.premiumScore - a.premiumScore)
    .slice(0, 10)
    .map(idx => ({
      huc14: idx.huc14,
      huc12: idx.huc12,
      premiumScore: idx.premiumScore,
      regionType: idx.regionType,
      priority: idx.priority
    }));

  const bottomRegions = allIndices
    .sort((a, b) => a.premiumScore - b.premiumScore)
    .slice(0, 10)
    .map(idx => ({
      huc14: idx.huc14,
      huc12: idx.huc12,
      premiumScore: idx.premiumScore,
      regionType: idx.regionType,
      priority: idx.priority
    }));

  return NextResponse.json({
    status: 'success',
    overview: {
      totalHuc14s: allIndices.length,
      cache: cacheStatus,
      typeBreakdown,
      priorityBreakdown,
      performanceStats: {
        avgPremiumScore: allIndices.length > 0
          ? Math.round(allIndices.reduce((sum, idx) => sum + idx.premiumScore, 0) / allIndices.length)
          : 0,
        avgConfidence: allIndices.length > 0
          ? Math.round(allIndices.reduce((sum, idx) => sum + idx.premiumConfidence, 0) / allIndices.length)
          : 0
      }
    },
    topPerformers: topRegions,
    needsAttention: bottomRegions,
    capabilities: [
      'Facility-level risk assessment',
      'Contaminant mobility analysis',
      'Monitoring network adequacy',
      'Emergency response capabilities',
      'Stakeholder engagement tracking'
    ]
  });
}