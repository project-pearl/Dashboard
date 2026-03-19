/**
 * HUC-8 Coverage Validation
 *
 * Validates that all 2,456 HUC-8 watersheds are being processed
 * by the 14-layer composite index system.
 */

import { getAllHuc8s } from './hucDataCollector';
import { getIndicesForHuc, getCacheStatus } from './indicesCache';

export interface CoverageReport {
  totalHucs: number;
  processedHucs: number;
  coveragePercent: number;
  missingHucs: string[];
  lowConfidenceHucs: Array<{ huc8: string; confidence: number }>;
  avgConfidence: number;
  lastUpdated: string;
}

/**
 * Generate comprehensive coverage report for all HUC-8 watersheds
 */
export function generateCoverageReport(): CoverageReport {
  const allHucs = getAllHuc8s();
  const totalHucs = allHucs.length;
  const missingHucs: string[] = [];
  const lowConfidenceHucs: Array<{ huc8: string; confidence: number }> = [];
  let totalConfidence = 0;
  let processedCount = 0;

  for (const huc8 of allHucs) {
    const indices = getIndicesForHuc(huc8);
    if (!indices) {
      missingHucs.push(huc8);
    } else {
      processedCount++;
      totalConfidence += indices.compositeConfidence;

      // Flag low confidence HUCs (< 40% confidence)
      if (indices.compositeConfidence < 40) {
        lowConfidenceHucs.push({
          huc8,
          confidence: indices.compositeConfidence
        });
      }
    }
  }

  const coveragePercent = Math.round((processedCount / totalHucs) * 100);
  const avgConfidence = processedCount > 0 ? Math.round(totalConfidence / processedCount) : 0;

  return {
    totalHucs,
    processedHucs: processedCount,
    coveragePercent,
    missingHucs,
    lowConfidenceHucs: lowConfidenceHucs.sort((a, b) => a.confidence - b.confidence),
    avgConfidence,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Check if full 14-layer coverage is achieved (>= 95% processed)
 */
export function hasFullCoverage(): boolean {
  const report = generateCoverageReport();
  return report.coveragePercent >= 95;
}

/**
 * Get states with incomplete HUC coverage
 */
export function getStatesWithGaps(): Record<string, number> {
  const report = generateCoverageReport();
  const stateGaps: Record<string, number> = {};

  // This would need state-to-HUC mapping to be fully implemented
  // For now, return overall gap count
  if (report.missingHucs.length > 0) {
    stateGaps['OVERALL'] = report.missingHucs.length;
  }

  return stateGaps;
}