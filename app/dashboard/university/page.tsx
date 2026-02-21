'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const UniversityCommandCenter = dynamic(
  () => import('@/components/UniversityCommandCenter').then((m) => m.UniversityCommandCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function UniversityPage() {
  return <UniversityCommandCenter stateAbbr="MD" />;
}
