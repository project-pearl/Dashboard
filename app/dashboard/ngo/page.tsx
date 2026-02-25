'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const NGOManagementCenter = dynamic(
  () => import('@/components/NGOManagementCenter').then((m) => m.NGOManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function NGOPage() {
  return <NGOManagementCenter stateAbbr="MD" />;
}
