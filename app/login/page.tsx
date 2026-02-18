'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import type { UserRole } from '@/lib/authTypes';
import Image from 'next/image';

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'Public',     label: 'Public',          desc: 'Community water quality access' },
  { value: 'MS4',        label: 'MS4 Operator',    desc: 'Municipal stormwater permits' },
  { value: 'State',      label: 'State Agency',    desc: 'State regulatory compliance' },
  { value: 'Federal',    label: 'Federal Agency',  desc: 'EPA oversight & national metrics' },
  { value: 'Corporate',  label: 'Corporate / ESG', desc: 'ESG & environmental impact' },
  { value: 'Researcher', label: 'Researcher',      desc: 'Data analysis & publications' },
  { value: 'College',    label: 'University',      desc: 'Academic programs & field studies' },
  { value: 'NGO',        label: 'NGO',             desc: 'Conservation & advocacy' },
  { value: 'K12',        label: 'K-12 Education',  desc: 'STEM curriculum' },
];

export default function LoginPage() {
  const router = useRouter();
  const { loginAsync, signup, isAuthenticated, isLoading, loginError, clearError } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('Public');
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
    if (password.length < 6) {
      return;
    }
    setIsSubmitting(true);
    clearError();
    setSuccessMsg('');

    const result = await signup({
      email,
      password,
      name,
      role,
      organization,
      state,
    });

    if (result.success) {
      if (result.user?.status === 'pending') {
        setSuccessMsg('Account created! An admin will approve your access shortly.');
        setMode('login');
      } else {
        setSuccessMsg('Account created! Check your email to confirm, then sign in.');
        setMode('login');
      }
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-12 h-12 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/Logo_Pearl_as_Headline.JPG"
              alt="Project PEARL"
              width={200}
              height={60}
              className="rounded-lg"
            />
          </div>
          <p className="text-cyan-400/70 text-sm tracking-wide">
            Water Quality Monitoring Platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {/* Tab toggle */}
          <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => { setMode('login'); clearError(); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'login'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); clearError(); setSuccessMsg(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'signup'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {successMsg && (
            <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-300 text-sm">
              {successMsg}
            </div>
          )}

          {loginError && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {loginError}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Organization (optional)</label>
                <input
                  type="text"
                  value={organization}
                  onChange={e => setOrganization(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="e.g. Anne Arundel County DPW"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">State (optional)</label>
                <input
                  type="text"
                  value={state}
                  onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))}
                  maxLength={2}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="MD"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>
              <p className="text-xs text-gray-500 text-center">
                MS4, State, Federal, and Corporate accounts require admin approval.
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © {new Date().getFullYear()} Local Seafood Projects Inc. — Project PEARL
        </p>
      </div>
    </div>
  );
}
