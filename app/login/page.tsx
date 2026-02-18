'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import type { UserRole } from '@/lib/authTypes';
import Image from 'next/image';

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'K12',        label: 'K-12 Education',  desc: 'STEM curriculum' },
  { value: 'MS4',        label: 'MS4 Operator',    desc: 'Municipal stormwater permits' },
  { value: 'State',      label: 'State Agency',    desc: 'State regulatory compliance' },
  { value: 'Federal',    label: 'Federal Agency',  desc: 'EPA oversight & national metrics' },
  { value: 'Corporate',  label: 'Corporate / ESG', desc: 'ESG & environmental impact' },
  { value: 'Researcher', label: 'Researcher',      desc: 'Data analysis & publications' },
  { value: 'College',    label: 'University',      desc: 'Academic programs & field studies' },
  { value: 'NGO',        label: 'NGO',             desc: 'Conservation & advocacy' },
];

export default function LoginPage() {
  const router = useRouter();
  const { loginAsync, signup, isAuthenticated, isLoading, loginError, clearError } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('K12');
  const [organization, setOrganization] = useState('');
  const [state, setState] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearError();
    const result = await loginAsync(email, password);
    if (result.success) {
      router.replace('/');
    }
    setIsSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return;
    setIsSubmitting(true);
    clearError();
    setSuccessMsg('');
    const result = await signup({ email, password, name, role, organization, state });
    if (result.success) {
      if (result.user?.status === 'pending') {
        setSuccessMsg('Account created! An admin will approve your access shortly.');
      } else {
        setSuccessMsg('Account created! Check your email to confirm, then sign in.');
      }
      setMode('login');
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-12 h-12 border-4 border-cyan-300/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      {/* Underwater background */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/underwater.png"
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-cyan-900/20" />
      </div>

      <div className="relative z-10 w-full max-w-md py-12">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/Logo_Pearl_with_reef.jpg"
            alt="Project PEARL"
            width={200}
            height={200}
            className="mx-auto object-contain drop-shadow-2xl rounded-xl"
            priority
          />
        </div>

        {/* Card — frosted glass */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl shadow-black/30">
          {/* Tab toggle */}
          <div className="flex mb-6 bg-white/10 rounded-lg p-1">
            <button
              onClick={() => { setMode('login'); clearError(); setSuccessMsg(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all ${
                mode === 'login'
                  ? 'bg-white/20 text-white shadow-lg shadow-black/10'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); clearError(); setSuccessMsg(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all ${
                mode === 'signup'
                  ? 'bg-white/20 text-white shadow-lg shadow-black/10'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              Create Account
            </button>
          </div>

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-lg text-emerald-200 text-sm">
              {successMsg}
            </div>
          )}

          {loginError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">
              {loginError}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="remember" className="accent-cyan-400 w-4 h-4 rounded" />
                <label htmlFor="remember" className="text-sm text-white/60">Remember me</label>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg shadow-cyan-500/20"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all"
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all [&>option]:bg-slate-900 [&>option]:text-white"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Organization (optional)</label>
                <input
                  type="text"
                  value={organization}
                  onChange={e => setOrganization(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all"
                  placeholder="e.g. Anne Arundel County DPW"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">State (optional)</label>
                <input
                  type="text"
                  value={state}
                  onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))}
                  maxLength={2}
                  className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all"
                  placeholder="MD"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg shadow-cyan-500/20"
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>
              <p className="text-xs text-white/40 text-center">
                MS4, State, Federal, and Corporate accounts require admin approval.
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-white/25 text-xs mt-8">
          &copy; {new Date().getFullYear()} Local Seafood Projects Inc. &mdash; Project PEARL
        </p>
      </div>
    </div>
  );
}
