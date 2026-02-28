'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Skeleton } from '@/components/ui/skeleton';

const MS4ManagementCenter = dynamic(
  () => import('@/components/MS4ManagementCenter').then((m) => m.MS4ManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function MS4Page() {
  const params = useParams();
  const permitId = (params.permitId as string) || 'default';
  const { user } = useAuth();

  const stateAbbr = user?.state || 'MD';
  const ms4Jurisdiction = (user as any)?.ms4Jurisdiction || (permitId !== 'default' ? permitId : undefined);

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
      <MS4ManagementCenter
        stateAbbr={stateAbbr}
        ms4Jurisdiction={ms4Jurisdiction}
        onSelectRegion={() => {}}
        onToggleDevMode={() => {}}
      />
    </Suspense>
  );
}
