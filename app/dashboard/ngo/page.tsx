'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const NGOCommandCenter = dynamic(
  () => import('@/components/NGOCommandCenter').then((m) => m.NGOCommandCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function NGOPage() {
  return <NGOCommandCenter stateAbbr="MD" />;
}
