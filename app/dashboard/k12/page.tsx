'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const K12ManagementCenter = dynamic(
  () => import('@/components/K12ManagementCenter').then((m) => m.K12ManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function K12Page() {
  return <K12ManagementCenter stateAbbr="MD" />;
}
