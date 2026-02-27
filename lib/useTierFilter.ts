// lib/useTierFilter.ts
// Role-based tier filtering — returns a filtered copy of waterData
// with only parameters and sources visible to the given role
'use client';

import { useMemo } from 'react';
import type { WaterDataResult, DataSourceId, DataConfidenceTier } from '@/lib/useWaterData';
import { DATA_SOURCES, getVisibleTiersForRole } from '@/lib/useWaterData';

function isTierVisible(sourceId: DataSourceId, allowedTiers: DataConfidenceTier[]): boolean {
  const tier = DATA_SOURCES[sourceId]?.tier;
  return tier != null && allowedTiers.includes(tier);
}

export function useTierFilter(waterData: WaterDataResult | null, role: string): WaterDataResult | null {
  const allowedTiers = getVisibleTiersForRole(role);

  return useMemo(() => {
    if (!waterData) return null;

    // Filter parameters by source tier
    const filteredParams: typeof waterData.parameters = {};
    for (const [key, reading] of Object.entries(waterData.parameters)) {
      if (isTierVisible(reading.source, allowedTiers)) {
        filteredParams[key] = reading;
      }
    }

    // Filter active sources
    const filteredSources = waterData.activeSources.filter(s => isTierVisible(s, allowedTiers));

    // Filter source details
    const filteredDetails = waterData.sourceDetails.filter(d => isTierVisible(d.source.id, allowedTiers));

    // Recompute primary source from filtered set
    const primarySource = filteredDetails.length > 0
      ? filteredDetails.reduce((best, d) => d.parameterCount > best.parameterCount ? d : best).source
      : waterData.primarySource;

    return {
      parameters: filteredParams,
      activeSources: filteredSources,
      primarySource,
      stationName: waterData.stationName,
      lastSampled: waterData.lastSampled,
      sourceDetails: filteredDetails,
    };
  }, [waterData, allowedTiers]);
}
