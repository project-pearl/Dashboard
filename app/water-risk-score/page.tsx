import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const WaterRiskScore = dynamic(
  () => import('@/components/WaterRiskScore'),
  { ssr: false },
);

export const metadata: Metadata = {
  title: 'Water Risk Score | PIN',
  description:
    'Get a comprehensive water risk score for any US location. Composite 0-100 rating covering water quality, infrastructure, compliance, contamination, and environmental justice.',
  openGraph: {
    title: 'Water Risk Score | PIN',
    description:
      'Know your water risk in seconds. Comprehensive 0-100 score for any US address, ZIP, or coordinates.',
    type: 'website',
    url: 'https://pinwater.org/water-risk-score',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Water Risk Score | PIN',
    description:
      'Know your water risk in seconds. Comprehensive 0-100 score for any US address, ZIP, or coordinates.',
  },
};

export default function WaterRiskScorePage() {
  return <WaterRiskScore />;
}
