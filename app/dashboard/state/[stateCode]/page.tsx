'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/authContext';

const StateManagementCenter = dynamic(
  () => import('@/components/StateManagementCenter').then((m) => m.StateManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);

export default function StatePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  // Use user's assigned state if available, otherwise use URL param, fallback to MD
  const urlStateCode = (params.stateCode as string)?.toUpperCase();
  const userAssignedState = user?.state?.toUpperCase();
  const stateCode = urlStateCode || userAssignedState || 'MD';

  // Redirect to user's assigned state if they landed on a different state or the default MD
  useEffect(() => {
    if (user && userAssignedState && urlStateCode && urlStateCode !== userAssignedState) {
      // User has an assigned state but is viewing a different state - redirect to their state
      router.push(`/dashboard/state/${userAssignedState.toLowerCase()}`);
    } else if (user && userAssignedState && !urlStateCode) {
      // User has an assigned state but landed on generic state page - redirect to their state
      router.push(`/dashboard/state/${userAssignedState.toLowerCase()}`);
    }
  }, [user, userAssignedState, urlStateCode, router]);

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div>}>
      <StateManagementCenter stateAbbr={stateCode} />
    </Suspense>
  );
}
