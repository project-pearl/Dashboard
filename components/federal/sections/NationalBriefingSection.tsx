'use client';

import { AMSAlertMonitor } from '@/ams/components/AMSAlertMonitor';
import type { DraggableSectionProps } from '@/components/DraggableSection';

interface Props {
  amsSummary: any;
  setViewLens: (lens: any) => void;
  DS: (content: React.ReactNode) => DraggableSectionProps;
}

export function NationalBriefingSection({
  amsSummary,
  setViewLens,
  DS
}: Props) {
  return DS(
    <>
      {/* ── AMS Alert Monitor ── */}
      <AMSAlertMonitor
        summary={amsSummary}
        role="FEDERAL_OVERSIGHT"
        onOpenResponsePlanner={() => setViewLens('disaster-emergency' as any)}
      />
    </>
  );
}