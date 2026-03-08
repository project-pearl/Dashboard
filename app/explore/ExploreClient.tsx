'use client';

import dynamic from 'next/dynamic';

const WaterQualityExplorer = dynamic(
  () => import('@/components/WaterQualityExplorer').then(m => m.default),
  { ssr: false },
);

export default function ExploreClient() {
  return <WaterQualityExplorer />;
}
