import type { Metadata } from 'next';
import DemoClient from './DemoClient';

export const metadata: Metadata = {
  title: 'National Water Intelligence Grid — Command Center',
  description:
    'Live operational picture of the National Water Intelligence Grid. Real-time monitoring, anomaly detection, and watershed intelligence across 50 states.',
  alternates: {
    canonical: '/demo',
  },
};

export default function DemoPage() {
  return <DemoClient />;
}
