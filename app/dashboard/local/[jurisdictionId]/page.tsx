'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Skeleton } from '@/components/ui/skeleton';

const LocalManagementCenter = dynamic(
  () => import('@/components/LocalManagementCenter').then((m) => m.LocalManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function LocalPage() {
  const params = useParams();
  const jurisdictionId = (params.jurisdictionId as string) || 'default';
  const { user } = useAuth();

  const stateAbbr = user?.state || 'MD';

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
      <LocalManagementCenter
        jurisdictionId={jurisdictionId}
        stateAbbr={stateAbbr}
        onSelectRegion={() => {}}
        onToggleDevMode={() => {}}
      />
    </Suspense>
  );
}
