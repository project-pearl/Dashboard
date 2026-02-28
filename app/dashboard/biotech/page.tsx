'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const BiotechManagementCenter = dynamic(
  () => import('@/components/BiotechManagementCenter').then((m) => m.BiotechManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function BiotechPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
      <BiotechManagementCenter />
    </Suspense>
  );
}
