'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

const MS4CommandCenter = dynamic(
  () => import('@/components/MS4CommandCenter').then((m) => m.MS4CommandCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function MS4Page() {
  const params = useParams();
  const permitId = (params.permitId as string) || 'default';

  return (
    <MS4CommandCenter
      stateAbbr="MD"
      ms4Jurisdiction={permitId !== 'default' ? permitId : undefined}
    />
  );
}
