'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import type { DraggableSectionProps } from '@/components/DraggableSection';

// Loading skeleton for lazy sections
function SectionSkeleton() {
  return (
    <div className="animate-pulse bg-slate-100 dark:bg-slate-800/50 rounded-xl h-48 flex items-center justify-center">
      <span className="text-xs text-slate-400">Loading section...</span>
    </div>
  );
}

// Lazy-loaded section components
const sections = {
  'ai-water-intelligence': dynamic(() =>
    import('./AIWaterIntelligenceSection').then(m => ({ default: m.AIWaterIntelligenceSection })),
    { loading: SectionSkeleton }
  ),
  'national-briefing': dynamic(() =>
    import('./NationalBriefingSection').then(m => ({ default: m.NationalBriefingSection })),
    { loading: SectionSkeleton }
  ),
  'icis': dynamic(() =>
    import('./ICISSection').then(m => ({ default: m.ICISSection })),
    { loading: SectionSkeleton }
  ),
  // Add more sections as they are extracted...
};

interface SectionLoaderProps {
  sectionId: string;
  props: any;
}

export function SectionLoader({ sectionId, props }: SectionLoaderProps) {
  const SectionComponent = sections[sectionId as keyof typeof sections];

  if (!SectionComponent) {
    return null; // Section not yet extracted, fallback to inline implementation
  }

  return (
    <Suspense fallback={<SectionSkeleton />}>
      <SectionComponent {...props} />
    </Suspense>
  );
}

// Helper to check if a section has been extracted
export function isSectionExtracted(sectionId: string): boolean {
  return sectionId in sections;
}

export type ExtractedSectionId = keyof typeof sections;