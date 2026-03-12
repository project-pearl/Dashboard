'use client';

import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import type { DraggableSectionProps } from '@/components/DraggableSection';

interface Props {
  lens: any;
  attainsAggregation: any;
  regionData: any;
  nationalAIData: any;
  DS: (content: React.ReactNode) => DraggableSectionProps;
}

export function AIWaterIntelligenceSection({
  lens,
  attainsAggregation,
  regionData,
  nationalAIData,
  DS
}: Props) {
  return DS(
    <>
      {/* ── AI Water Intelligence — Claude-powered, ATTAINS-fed ── */}
      {lens.showAIInsights && (
        <AIInsightsEngine
          key={`national-${attainsAggregation.totalAssessed}`}
          role="Federal"
          stateAbbr="US"
          regionData={regionData as any}
          nationalData={nationalAIData}
        />
      )}
    </>
  );
}