import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'National Water Intelligence Grid — Command Center',
  description:
    'Live operational picture of the National Water Intelligence Grid. Real-time monitoring, anomaly detection, and watershed intelligence across 50 states.',
};

const DemoCommandCenter = dynamic(
  () => import('@/components/demo/DemoCommandCenter'),
  { ssr: false },
);

export default function DemoPage() {
  return <DemoCommandCenter />;
}
