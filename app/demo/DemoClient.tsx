'use client';

import dynamic from 'next/dynamic';

const DemoCommandCenter = dynamic(
  () => import('@/components/demo/DemoCommandCenter').then(m => m.default),
  { ssr: false },
);

export default function DemoClient() {
  return <DemoCommandCenter />;
}
