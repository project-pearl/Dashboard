import { Metadata } from 'next';
import OurStorySection from '@/components/OurStorySection';

export const metadata: Metadata = {
  title: 'Our Story | Project PEARL',
  description: 'How Project PEARL began — from a visit to the Navarre Beach Sea Turtle Conservation Center to a national water quality platform.',
};

export default function StoryPage() {
  return <OurStorySection />;
}
