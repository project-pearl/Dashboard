'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Loading skeleton for lazy sections
function SectionSkeleton() {
  return (
    <div className="animate-pulse bg-slate-100 dark:bg-slate-800/50 rounded-xl h-48 flex items-center justify-center">
      <span className="text-xs text-slate-400">Loading section...</span>
    </div>
  );
}

// Lazy-loaded section components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sections = {
  'ai-water-intelligence': dynamic<any>(() =>
    import('./AIWaterIntelligenceSection').then(m => ({ default: m.AIWaterIntelligenceSection as any })),
    { loading: SectionSkeleton }
  ),
  'national-briefing': dynamic<any>(() =>
    import('./NationalBriefingSection').then(m => ({ default: m.NationalBriefingSection as any })),
    { loading: SectionSkeleton }
  ),
  'icis': dynamic<any>(() =>
    import('./ICISSection').then(m => ({ default: m.ICISSection as any })),
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