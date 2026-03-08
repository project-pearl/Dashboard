import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Methodology | Project PEARL',
  description:
    'How PEARL calculates water quality scores: parameter definitions, data sources, QA/QC standards, and scoring methodology.',
  openGraph: {
    title: 'Methodology | Project PEARL',
    description:
      'Water quality scoring methodology — parameter definitions, EPA data sources, and QA/QC standards.',
    type: 'website',
  },
  alternates: {
    canonical: '/methodology',
  },
};

export default function MethodologyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
