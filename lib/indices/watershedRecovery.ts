import type { IndexScore } from './types';
import type { HucData } from './hucDataCollector';
import { computeConfidence, applyConfidenceRegression } from './confidence';

/**
 * Category credit: maps EPA IR categories to a 0-1 recovery credit.
 * Cat 1-2 = full credit (attaining), Cat 3 = partial, Cat 4 = moderate, Cat 5 = zero (impaired, no plan)
 */
function categoryCredit(category: string): number {
  const cat = category?.trim();
  if (!cat) return 0.5;
  if (cat.startsWith('1') || cat.startsWith('2')) return 1.0;
  if (cat.startsWith('3')) return 0.6;
  if (cat.startsWith('4')) return 0.4;  // 4a=TMDL, 4b=other, 4c=not pollutant
  return 0; // Cat 5 = impaired, needs TMDL
}

/**
 * Watershed Recovery Rate Index (0-100, higher = faster recovery / better)
 *
 * Components:
 *   TMDL Coverage (35%): tmdlCompleted / (tmdlCompleted + tmdlNeeded)
 *   Impairment Ratio (30%): 1 - (impaired / total) — inverse
 *   Category Distribution (20%): weighted category credit
 *   Cause Concentration (15%): fewer unique causes = more tractable
 */
export function computeWatershedRecovery(data: HucData): IndexScore {
  const now = new Date().toISOString();
  const { attainsWaterbodies } = data;
  const total = attainsWaterbodies.length;

  if (total === 0) {
    return {
      value: 50, // neutral when no data
      confidence: 0,
      trend: 'unknown',
      lastCalculated: now,
      dataPoints: 0,
      tidalModified: false,
    };
  }

  // 1. TMDL Coverage (35%)
  const tmdlCompleted = attainsWaterbodies.filter(wb => wb.tmdlStatus === 'completed' || wb.tmdlStatus === 'alternative').length;
  const tmdlNeeded = attainsWaterbodies.filter(wb => wb.tmdlStatus === 'needed').length;
  const tmdlTotal = tmdlCompleted + tmdlNeeded;
  const tmdlCoverage = tmdlTotal > 0
    ? (tmdlCompleted / tmdlTotal) * 100
    : 50; // neutral if no TMDLs applicable

  // 2. Impairment Ratio (30%) — inverse: fewer impaired = better
  const impaired = attainsWaterbodies.filter(wb => {
    const cat = wb.category?.trim();
    return cat?.startsWith('4') || cat?.startsWith('5');
  }).length;
  const impairmentScore = (1 - impaired / total) * 100;

  // 3. Category Distribution (20%) — weighted credit
  const avgCategoryCredit = attainsWaterbodies.reduce((sum, wb) =>
    sum + categoryCredit(wb.category), 0
  ) / total;
  const categoryScore = avgCategoryCredit * 100;

  // 4. Cause Concentration (15%) — fewer unique causes = more tractable
  const allCauses = new Set<string>();
  let totalCauseCount = 0;
  for (const wb of attainsWaterbodies) {
    for (const cause of (wb.causes || [])) {
      allCauses.add(cause);
    }
    totalCauseCount += wb.causeCount || 0;
  }
  const avgCauseCount = totalCauseCount / total;
  const causeScore = (1 - Math.min(1, avgCauseCount / 5)) * 100;

  // Weighted composite
  const rawScore =
    tmdlCoverage * 0.35 +
    impairmentScore * 0.30 +
    categoryScore * 0.20 +
    causeScore * 0.15;

  const confidence = computeConfidence('watershedRecovery', total, [], allCauses.size > 0 ? 1 : 0);
  const value = Math.round(Math.max(0, Math.min(100, applyConfidenceRegression(rawScore, confidence))));

  // Trend from TMDL coverage
  let trend: IndexScore['trend'] = 'unknown';
  if (tmdlTotal >= 3) {
    const coverage = tmdlCompleted / tmdlTotal;
    trend = coverage > 0.6 ? 'improving' : coverage < 0.3 ? 'declining' : 'stable';
  }

  return {
    value,
    confidence,
    trend,
    lastCalculated: now,
    dataPoints: total,
    tidalModified: false,
  };
}
