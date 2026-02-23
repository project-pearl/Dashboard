import { Metadata } from 'next';
import DataRoadmap from '@/components/DataRoadmap';

export const metadata: Metadata = {
  title: 'Data Source Roadmap | Project PEARL',
  description: 'PIN data onboarding roadmap: 29 live sources today to 200+ within 6 months. Federal agencies, 56 state programs, satellite systems, and AI-powered report extraction.',
};

export default function RoadmapPage() {
  return <DataRoadmap />;
}
