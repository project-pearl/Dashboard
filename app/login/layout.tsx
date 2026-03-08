import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | Project PEARL',
  description:
    'Sign in to your Project PEARL account. Access water quality dashboards, compliance reports, and real-time monitoring data.',
  alternates: {
    canonical: '/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
