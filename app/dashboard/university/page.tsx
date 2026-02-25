'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const UniversityManagementCenter = dynamic(
  () => import('@/components/UniversityManagementCenter').then((m) => m.UniversityManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function UniversityPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
      <UniversityManagementCenter stateAbbr="MD" />
    </Suspense>
  );
}
