'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const FederalManagementCenter = dynamic(
  () => import('@/components/FederalManagementCenter').then((m) => m.FederalManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function FederalPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
      <FederalManagementCenter
        onClose={() => {}}
        onSelectRegion={() => {}}
        federalMode
      />
    </Suspense>
  );
}
