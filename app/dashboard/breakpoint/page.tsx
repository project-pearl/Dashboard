'use client';

import dynamic from 'next/dynamic';

const BreakpointLanding = dynamic(
  () => import('@/components/breakpoint-landing'),
  { ssr: false },
);

export default function BreakpointPage() {
  return (
    <div className="min-h-screen">
      {/* @ts-expect-error — JSX component has optional onToggleDevMode prop with default */}
      <BreakpointLanding />
    </div>
  );
}
