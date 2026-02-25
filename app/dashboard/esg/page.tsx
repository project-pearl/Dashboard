'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ESGManagementCenter = dynamic(
  () => import('@/components/ESGManagementCenter').then((m) => m.ESGManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function ESGPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
      <ESGManagementCenter />
    </Suspense>
  );
}
