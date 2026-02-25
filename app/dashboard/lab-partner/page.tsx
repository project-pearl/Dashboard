'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/authContext';
import { Skeleton } from '@/components/ui/skeleton';

const LabPartnerManagementCenter = dynamic(
  () => import('@/components/LabPartnerManagementCenter').then((m) => m.LabPartnerManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function LabPartnerPage() {
  const { user } = useAuth();
  const stateAbbr = user?.state || 'MD';

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
      <LabPartnerManagementCenter stateAbbr={stateAbbr} />
    </Suspense>
  );
}
