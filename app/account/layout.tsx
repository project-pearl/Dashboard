import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Settings | Project PEARL',
  description: 'Manage your Project PEARL account settings, profile, and notification preferences.',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/account',
  },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
