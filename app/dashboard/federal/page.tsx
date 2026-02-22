'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const NationalCommandCenter = dynamic(
  () => import('@/components/NationalCommandCenter').then((m) => m.NationalCommandCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function FederalPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
      <NationalCommandCenter
        onClose={() => {}}
        onSelectRegion={() => {}}
        federalMode
      />
    </Suspense>
  );
}
