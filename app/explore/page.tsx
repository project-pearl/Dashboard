import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const WaterQualityExplorer = dynamic(
  () => import('@/components/WaterQualityExplorer'),
  { ssr: false },
);

export const metadata: Metadata = {
  title: 'State Water Quality Report Card | Project PEARL',
  description:
    'Discover your state\'s water quality story. Report cards, environmental authority contacts, and take-action resources for all 50 states — powered by EPA data.',
  openGraph: {
    title: 'State Water Quality Report Card | Project PEARL',
    description:
      'Discover your state\'s water quality story with EPA-powered report cards and take-action resources.',
    type: 'website',
    url: 'https://project-pearl.org/explore',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'State Water Quality Report Card | Project PEARL',
    description:
      'Discover your state\'s water quality story with EPA-powered report cards and take-action resources.',
  },
};

export default function ExplorePage() {
  return <WaterQualityExplorer />;
}
