import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const WaterQualityExplorer = dynamic(
  () => import('@/components/WaterQualityExplorer'),
  { ssr: false },
);

export const metadata: Metadata = {
  title: 'Water Quality Explorer | Project PEARL',
  description:
    'Explore water quality data across all 50 states. Interactive maps, AI-powered analysis, and real-time EPA ATTAINS data — no account required.',
  openGraph: {
    title: 'Water Quality Explorer | Project PEARL',
    description:
      'Explore water quality data across all 50 states with AI-powered analysis and interactive maps.',
    type: 'website',
    url: 'https://project-pearl.org/explore',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Water Quality Explorer | Project PEARL',
    description:
      'Explore water quality data across all 50 states with AI-powered analysis and interactive maps.',
  },
};

export default function ExplorePage() {
  return <WaterQualityExplorer />;
}
