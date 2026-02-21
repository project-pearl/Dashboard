import { Metadata } from 'next';
import DarkPageShell from '@/components/DarkPageShell';
import OurStorySection from '@/components/OurStorySection';

export const metadata: Metadata = {
  title: 'Our Story | Project PEARL',
  description: 'How Project PEARL began — from a polluted river to a national water quality platform. Field-validated treatment technology built in Maryland.',
};

export default function StoryPage() {
  return (
    <DarkPageShell>
      <OurStorySection />
    </DarkPageShell>
  );
}
