'use client';

import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';

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
  const { isAuthenticated, isLoading, user, logout } = useAuth();
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

  // Pending approval gate
  if (user && user.status === 'pending') {
    return (
      <div className="min-h-screen relative flex items-center justify-center px-4">
        <div className="fixed inset-0 z-0">
          <Image src="/underwater.png" alt="" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/50 to-cyan-900/30" />
        </div>
        <div className="relative z-10 w-full max-w-lg py-12">
          <div className="text-center mb-8">
            <Image
              src="/Logo_Pearl_with_reef.jpg"
              alt="Project PEARL"
              width={180}
              height={180}
              className="mx-auto object-contain drop-shadow-2xl rounded-xl"
              priority
            />
          </div>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl shadow-black/30 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400/40 flex items-center justify-center mx-auto mb-5">
              <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Account Pending Review</h2>
            <p className="text-sm text-white/70 leading-relaxed mb-6">
              Your account is pending review. We&#39;ll notify you when access is granted.
            </p>
            <div className="bg-white/5 rounded-lg border border-white/10 p-4 mb-6">
              <div className="text-xs text-white/50 mb-1">Signed in as</div>
              <div className="text-sm font-semibold text-white">{user.name || user.email}</div>
              {user.organization && <div className="text-xs text-white/50 mt-0.5">{user.organization}</div>}
            </div>
            <p className="text-xs text-white/50 mb-6">
              Questions? Contact{' '}
              <a href="mailto:doug@project-pearl.org" className="text-cyan-400 hover:text-cyan-300 underline transition-colors">
                doug@project-pearl.org
              </a>
            </p>
            <button
              onClick={() => logout()}
              className="text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
            >
              Sign out
            </button>
          </div>
          <p className="text-center text-white/25 text-xs mt-8">
            &copy; {new Date().getFullYear()} Local Seafood Projects Inc. &mdash; Project PEARL
          </p>
        </div>
      </div>
    );
  }

  // Rejected/deactivated gate
  if (user && (user.status === 'rejected' || user.status === 'deactivated')) {
    return (
      <div className="min-h-screen relative flex items-center justify-center px-4">
        <div className="fixed inset-0 z-0">
          <Image src="/underwater.png" alt="" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/50 to-cyan-900/30" />
        </div>
        <div className="relative z-10 w-full max-w-lg py-12 text-center">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl shadow-black/30">
            <h2 className="text-xl font-bold text-white mb-3">Account Deactivated</h2>
            <p className="text-sm text-white/70 leading-relaxed mb-6">
              Your account is no longer active. Contact{' '}
              <a href="mailto:doug@project-pearl.org" className="text-cyan-400 hover:text-cyan-300 underline">doug@project-pearl.org</a>
              {' '}for assistance.
            </p>
            <button onClick={() => logout()} className="text-sm font-medium text-white/50 hover:text-white/80 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
