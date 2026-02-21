'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const K12CommandCenter = dynamic(
  () => import('@/components/K12CommandCenter').then((m) => m.K12CommandCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function K12Page() {
  return <K12CommandCenter stateAbbr="MD" />;
}
