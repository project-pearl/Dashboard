'use client';

import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const PublicLanding = dynamic(
  () => import('@/components/PublicLanding').then((mod) => mod.PublicLanding),
  { ssr: false, loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-12 h-12 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
    </div>
  )}
);

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-cyan-300/70 text-sm tracking-wide">Loading PEARL Platform...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <PublicLanding
        onSignIn={() => router.push('/login')}
        onExploreState={() => {}}
      />
    );
  }

  return <>{children}</>;
}
