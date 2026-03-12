// app/api/cron/rebuild-myhealthfinder/route.ts
// Daily MyHealthfinder API data refresh for health guidance and prevention intelligence
// Critical for public health guidance and military health recommendations

export const dynamic = 'force-dynamic';
export const maxDuration = 180; // 3 minutes for health topic processing

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  setMyHealthfinderCache,
  setBuildInProgress,
  isBuildInProgress,
  buildMyHealthfinderCacheData,
  getMyHealthfinderCacheStatus,
  fetchMyHealthfinderData,
  processMyHealthfinderData,
} from '@/lib/myhealthfinderCache';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isBuildInProgress()) {
    return NextResponse.json({
      message: 'MyHealthfinder cache build already in progress',
      status: getMyHealthfinderCacheStatus(),
    });
  }

  try {
    setBuildInProgress(true);
    console.log('Starting MyHealthfinder health guidance cache rebuild...');

    // Fetch health topic data from MyHealthfinder API
    console.log('Fetching MyHealthfinder health topics...');
    const rawTopics = await fetchMyHealthfinderData();

    if (rawTopics.length === 0) {
      console.warn('No MyHealthfinder data retrieved');
      return NextResponse.json({
        error: 'No MyHealthfinder data available',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    console.log(`Processing ${rawTopics.length} health topics from MyHealthfinder...`);

    // Process health topic data
    const processedRecords = processMyHealthfinderData(rawTopics);
    console.log(`Processed ${processedRecords.length} health topic records`);

    // Build comprehensive cache data with health guidance analysis
    const cacheData = await buildMyHealthfinderCacheData(processedRecords);

    // Analyze for critical health guidance
    const criticalGuidance = analyzeCriticalHealthGuidance(cacheData);

    // Update cache
    await setMyHealthfinderCache(cacheData);

    const status = getMyHealthfinderCacheStatus();
    console.log('MyHealthfinder cache rebuild completed successfully');

    return NextResponse.json({
      success: true,
      message: 'MyHealthfinder cache rebuilt successfully',
      stats: {
        total_topics: cacheData.records.length,
        category_breakdown: cacheData.summary.categoryCounts,
        evidence_distribution: cacheData.summary.evidenceDistribution,
        audience_breakdown: cacheData.summary.audienceBreakdown,
        water_safety_topics: cacheData.summary.waterSafetyTopics,
        emergency_preparedness_topics: cacheData.summary.emergencyPreparednessTopics,
        military_relevant_topics: cacheData.summary.militaryRelevantTopics,
        urgent_recommendations: cacheData.summary.urgentRecommendations,
        critical_guidance: criticalGuidance,
      },
      cache_status: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('MyHealthfinder cache rebuild failed:', error);

    return NextResponse.json({
      error: 'Failed to rebuild MyHealthfinder cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });

  } finally {
    setBuildInProgress(false);
  }
}

// ─── Critical Health Guidance Analysis ──────────────────────────────────────

/**
 * Analyze MyHealthfinder data for critical health guidance requiring immediate attention
 */
function analyzeCriticalHealthGuidance(cacheData: any): {
  grade_a_recommendations: any[];
  water_safety_guidance: any[];
  emergency_preparedness_topics: any[];
  military_health_guidance: any[];
} {
  const gradeARecommendations = identifyGradeARecommendations(cacheData.records);
  const waterSafetyGuidance = identifyWaterSafetyGuidance(cacheData.records);
  const emergencyPreparednessTopics = identifyEmergencyPreparednessTopics(cacheData.records);
  const militaryHealthGuidance = identifyMilitaryHealthGuidance(cacheData.records);

  return {
    grade_a_recommendations: gradeARecommendations,
    water_safety_guidance: waterSafetyGuidance,
    emergency_preparedness_topics: emergencyPreparednessTopics,
    military_health_guidance: militaryHealthGuidance,
  };
}

function identifyGradeARecommendations(records: any[]): any[] {
  // Identify Grade A evidence recommendations
  const gradeATopics = records.filter(record => record.healthfinderSpecific.evidenceLevel === 'A');

  return gradeATopics
    .map(record => ({
      topic_id: record.healthfinderSpecific.topicId,
      title: record.healthfinderSpecific.title,
      category: record.healthfinderSpecific.category,
      audience_type: record.healthfinderSpecific.audienceType,
      age_groups: record.healthfinderSpecific.ageGroup,
      recommendation_text: record.healthfinderSpecific.recommendationText,
      urgency_level: record.healthfinderSpecific.urgencyLevel,
      water_related: record.healthfinderSpecific.waterSafetyRelated,
      military_relevant: record.healthfinderSpecific.militaryRelevance,
      last_reviewed: record.healthfinderSpecific.lastReviewed,
    }))
    .sort((a, b) => {
      // Prioritize by urgency and relevance
      const urgencyOrder = { critical: 4, urgent: 3, important: 2, routine: 1 };
      const aUrgency = urgencyOrder[a.urgency_level as keyof typeof urgencyOrder] || 0;
      const bUrgency = urgencyOrder[b.urgency_level as keyof typeof urgencyOrder] || 0;

      if (aUrgency !== bUrgency) return bUrgency - aUrgency;
      if (a.water_related && !b.water_related) return -1;
      if (!a.water_related && b.water_related) return 1;
      if (a.military_relevant && !b.military_relevant) return -1;
      if (!a.military_relevant && b.military_relevant) return 1;

      return a.title.localeCompare(b.title);
    })
    .slice(0, 15);
}

function identifyWaterSafetyGuidance(records: any[]): any[] {
  // Identify water safety related health guidance
  const waterSafetyTopics = records.filter(record => record.healthfinderSpecific.waterSafetyRelated);

  return waterSafetyTopics
    .map(record => ({
      topic_id: record.healthfinderSpecific.topicId,
      title: record.healthfinderSpecific.title,
      category: record.healthfinderSpecific.category,
      evidence_level: record.healthfinderSpecific.evidenceLevel,
      recommendation_text: record.healthfinderSpecific.recommendationText,
      urgency_level: record.healthfinderSpecific.urgencyLevel,
      audience_type: record.healthfinderSpecific.audienceType,
      related_topics: record.healthfinderSpecific.relatedTopics,
      website_url: record.healthfinderSpecific.websiteUrl,
    }))
    .sort((a, b) => {
      // Sort by evidence level and urgency
      const evidenceOrder = { A: 5, B: 4, C: 3, D: 2, I: 1 };
      const aEvidence = evidenceOrder[a.evidence_level as keyof typeof evidenceOrder] || 0;
      const bEvidence = evidenceOrder[b.evidence_level as keyof typeof evidenceOrder] || 0;

      if (aEvidence !== bEvidence) return bEvidence - aEvidence;

      const urgencyOrder = { critical: 4, urgent: 3, important: 2, routine: 1 };
      const aUrgency = urgencyOrder[a.urgency_level as keyof typeof urgencyOrder] || 0;
      const bUrgency = urgencyOrder[b.urgency_level as keyof typeof urgencyOrder] || 0;

      return bUrgency - aUrgency;
    })
    .slice(0, 10);
}

function identifyEmergencyPreparednessTopics(records: any[]): any[] {
  // Identify emergency preparedness related health guidance
  const emergencyTopics = records.filter(record => record.healthfinderSpecific.emergencyPreparednessRelated);

  return emergencyTopics
    .map(record => ({
      topic_id: record.healthfinderSpecific.topicId,
      title: record.healthfinderSpecific.title,
      category: record.healthfinderSpecific.category,
      evidence_level: record.healthfinderSpecific.evidenceLevel,
      recommendation_text: record.healthfinderSpecific.recommendationText,
      audience_type: record.healthfinderSpecific.audienceType,
      age_groups: record.healthfinderSpecific.ageGroup,
      urgency_level: record.healthfinderSpecific.urgencyLevel,
      related_topics: record.healthfinderSpecific.relatedTopics,
    }))
    .sort((a, b) => {
      // Prioritize by urgency and evidence level
      const urgencyOrder = { critical: 4, urgent: 3, important: 2, routine: 1 };
      const aUrgency = urgencyOrder[a.urgency_level as keyof typeof urgencyOrder] || 0;
      const bUrgency = urgencyOrder[b.urgency_level as keyof typeof urgencyOrder] || 0;

      return bUrgency - aUrgency;
    })
    .slice(0, 8);
}

function identifyMilitaryHealthGuidance(records: any[]): any[] {
  // Identify military-relevant health guidance
  const militaryTopics = records.filter(record => record.healthfinderSpecific.militaryRelevance);

  return militaryTopics
    .map(record => ({
      topic_id: record.healthfinderSpecific.topicId,
      title: record.healthfinderSpecific.title,
      category: record.healthfinderSpecific.category,
      evidence_level: record.healthfinderSpecific.evidenceLevel,
      recommendation_text: record.healthfinderSpecific.recommendationText,
      urgency_level: record.healthfinderSpecific.urgencyLevel,
      audience_type: record.healthfinderSpecific.audienceType,
      water_related: record.healthfinderSpecific.waterSafetyRelated,
      emergency_related: record.healthfinderSpecific.emergencyPreparednessRelated,
    }))
    .sort((a, b) => {
      // Prioritize by evidence level and urgency
      const evidenceOrder = { A: 5, B: 4, C: 3, D: 2, I: 1 };
      const aEvidence = evidenceOrder[a.evidence_level as keyof typeof evidenceOrder] || 0;
      const bEvidence = evidenceOrder[b.evidence_level as keyof typeof evidenceOrder] || 0;

      if (aEvidence !== bEvidence) return bEvidence - aEvidence;

      const urgencyOrder = { critical: 4, urgent: 3, important: 2, routine: 1 };
      const aUrgency = urgencyOrder[a.urgency_level as keyof typeof urgencyOrder] || 0;
      const bUrgency = urgencyOrder[b.urgency_level as keyof typeof urgencyOrder] || 0;

      return bUrgency - aUrgency;
    })
    .slice(0, 12);
}