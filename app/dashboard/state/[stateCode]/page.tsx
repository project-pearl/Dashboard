'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

const StateManagementCenter = dynamic(
  () => import('@/components/StateManagementCenter').then((m) => m.StateManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function StatePage() {
  const params = useParams();
  const stateCode = (params.stateCode as string)?.toUpperCase() || 'MD';

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
      <StateManagementCenter stateAbbr={stateCode} />
    </Suspense>
  );
}
