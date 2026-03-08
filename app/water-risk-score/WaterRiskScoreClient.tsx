'use client';

import dynamic from 'next/dynamic';

const WaterRiskScore = dynamic(
  () => import('@/components/WaterRiskScore').then(m => m.default),
  { ssr: false },
);

export default function WaterRiskScoreClient() {
  return <WaterRiskScore />;
}
