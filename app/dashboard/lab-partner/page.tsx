'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/authContext';
import { Skeleton } from '@/components/ui/skeleton';

const LabPartnerCommandCenter = dynamic(
  () => import('@/components/LabPartnerCommandCenter').then((m) => m.LabPartnerCommandCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function LabPartnerPage() {
  const { user } = useAuth();
  const stateAbbr = user?.state || 'MD';

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
      <LabPartnerCommandCenter stateAbbr={stateAbbr} />
    </Suspense>
  );
}
