import { Metadata } from 'next';
import DarkPageShell from '@/components/DarkPageShell';
import TreatmentSection from '@/components/TreatmentSection';

export const metadata: Metadata = {
  title: 'Our Technology | Project PEARL',
  description: 'PEARL treatment technology: oyster biofiltration and multi-stage mechanical filtration achieving 88-95% TSS removal. Closing the shoreline treatment gap.',
};

export default function TreatmentPage() {
  return (
    <DarkPageShell>
      <TreatmentSection />
    </DarkPageShell>
  );
}
