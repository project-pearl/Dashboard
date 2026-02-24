'use client';

import dynamic from 'next/dynamic';

const BreakpointLanding = dynamic(
  () => import('@/components/breakpoint-landing'),
  { ssr: false },
);

export default function BreakpointPage() {
  return (
    <div className="min-h-screen">
      <BreakpointLanding />
    </div>
  );
}
