'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/authTypes';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';

// ── Password strength rules ────────────────────────────────────────────────
const PW_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { id: 'upper',  label: 'One uppercase letter',  test: (pw: string) => /[A-Z]/.test(pw) },
  { id: 'lower',  label: 'One lowercase letter',  test: (pw: string) => /[a-z]/.test(pw) },
  { id: 'number', label: 'One number',             test: (pw: string) => /\d/.test(pw) },
];

function PasswordRequirements({ password, touched }: { password: string; touched: boolean }) {
  if (!touched && password.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-0.5">
      {PW_RULES.map(rule => {
        const pass = rule.test(password);
        return (
          <div key={rule.id} className="flex items-center gap-1.5">
            <span className={`text-xs ${pass ? 'text-emerald-400' : 'text-red-400'}`}>
              {pass ? '\u2713' : '\u2717'}
            </span>
            <span className={`text-xs ${pass ? 'text-emerald-300/70' : 'text-red-300/70'}`}>
              {rule.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'MS4',        label: 'MS4 Operator' },
  { value: 'State',      label: 'State Agency' },
  { value: 'Federal',    label: 'Federal' },
  { value: 'Corporate',  label: 'Corporate / ESG' },
  { value: 'Researcher', label: 'Research / Academic' },
  { value: 'College',    label: 'Undergrad' },
  { value: 'K12',        label: 'K-12 Educator' },
  { value: 'NGO',        label: 'NGO / Conservation' },
];

const US_STATES: { abbr: string; name: string }[] = [
  { abbr: 'AL', name: 'Alabama' }, { abbr: 'AK', name: 'Alaska' }, { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' }, { abbr: 'CA', name: 'California' }, { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' }, { abbr: 'DE', name: 'Delaware' }, { abbr: 'DC', name: 'District of Columbia' },
  { abbr: 'FL', name: 'Florida' }, { abbr: 'GA', name: 'Georgia' }, { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' }, { abbr: 'IL', name: 'Illinois' }, { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' }, { abbr: 'KS', name: 'Kansas' }, { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' }, { abbr: 'ME', name: 'Maine' }, { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' }, { abbr: 'MI', name: 'Michigan' }, { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' }, { abbr: 'MO', name: 'Missouri' }, { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' }, { abbr: 'NV', name: 'Nevada' }, { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' }, { abbr: 'NM', name: 'New Mexico' }, { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' }, { abbr: 'ND', name: 'North Dakota' }, { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' }, { abbr: 'OR', name: 'Oregon' }, { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' }, { abbr: 'SC', name: 'South Carolina' }, { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' }, { abbr: 'TX', name: 'Texas' }, { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' }, { abbr: 'VA', name: 'Virginia' }, { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' }, { abbr: 'WI', name: 'Wisconsin' }, { abbr: 'WY', name: 'Wyoming' },
];

const inputClass = 'w-full px-4 py-3 bg-white/10 border border-white/15 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all';
const selectClass = `${inputClass} [&>option]:bg-slate-900 [&>option]:text-white`;

export default function LoginPage() {
  const router = useRouter();
  const { loginAsync, signup, isAuthenticated, isLoading, loginError, clearError } = useAuth();

  const [mode, setMode] = useState<'login' | 'request' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('MS4');
  const [organization, setOrganization] = useState('');
  const [state, setState] = useState('');
  const [useCase, setUseCase] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessRequested, setAccessRequested] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwTouched, setPwTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const passwordValid = useMemo(() => PW_RULES.every(r => r.test(password)), [password]);
  const passwordsMatch = password === confirmPassword;
  const signupReady = passwordValid && passwordsMatch && confirmPassword.length > 0;

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResetError(null);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (resetErr) {
      setResetError(resetErr.message);
    } else {
      setResetSent(true);
    }
    setIsSubmitting(false);
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupReady) return;
    setIsSubmitting(true);
    clearError();
    const result = await signup({ email, password, name, role, organization, state, useCase });
    if (result.success) {
      setAccessRequested(true);
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

  // ── Access Requested success screen ──
  if (accessRequested) {
    return (
      <div className="min-h-screen relative flex items-center justify-center px-4">
        <div className="fixed inset-0 z-0">
          <Image src="/underwater.png" alt="" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-cyan-900/20" />
        </div>
        <div className="relative z-10 w-full max-w-md py-12">
          <div className="text-center mb-8">
            <Image src="/Logo_Pearl_with_reef.jpg" alt="Project PEARL" width={200} height={200} className="mx-auto object-contain drop-shadow-2xl rounded-xl" priority />
          </div>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl shadow-black/30 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center mx-auto mb-5">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Access Requested!</h2>
            <p className="text-sm text-white/70 leading-relaxed mb-6">
              We&#39;ll review and activate your account within 24 hours.
              You&#39;ll receive an email when approved.
            </p>
            <div className="bg-white/5 rounded-lg border border-white/10 p-4 mb-6">
              <div className="text-xs text-white/50 mb-1">Submitted as</div>
              <div className="text-sm font-semibold text-white">{name}</div>
              <div className="text-xs text-white/60">{email}</div>
              <div className="text-xs text-white/40 mt-1">{ROLES.find(r => r.value === role)?.label}{organization ? ` at ${organization}` : ''}</div>
            </div>
            <button
              onClick={() => { setAccessRequested(false); setMode('login'); clearError(); }}
              className="text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Back to Sign In
            </button>
          </div>
          <p className="text-center text-white/25 text-xs mt-8">
            &copy; {new Date().getFullYear()} Local Seafood Projects Inc. &mdash; Project PEARL
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      {/* Underwater background */}
      <div className="fixed inset-0 z-0">
        <Image src="/underwater.png" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-cyan-900/20" />
      </div>

      <div className="relative z-10 w-full max-w-md py-12">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/Logo_Pearl_with_reef.jpg" alt="Project PEARL" width={200} height={200} className="mx-auto object-contain drop-shadow-2xl rounded-xl" priority />
        </div>

        {/* Card — frosted glass */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl shadow-black/30">
          {/* Tab toggle */}
          <div className="flex mb-6 bg-white/10 rounded-lg p-1">
            <button
              onClick={() => { setMode('login'); clearError(); setResetSent(false); setResetError(null); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all ${
                mode === 'login' || mode === 'forgot'
                  ? 'bg-white/20 text-white shadow-lg shadow-black/10'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('request'); clearError(); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all ${
                mode === 'request'
                  ? 'bg-white/20 text-white shadow-lg shadow-black/10'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              Request Access
            </button>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">
              {loginError}
            </div>
          )}

          {mode === 'forgot' ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white text-center">Reset Password</h3>
              {resetSent ? (
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center mx-auto">
                    <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-white/70">
                    If an account exists for <span className="text-white font-medium">{email}</span>, you&apos;ll receive a password reset link shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setResetSent(false); }}
                    className="text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm text-white/60 text-center">
                    Enter your email and we&apos;ll send a reset link.
                  </p>
                  {resetError && (
                    <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">
                      {resetError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={inputClass}
                      placeholder="you@example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg shadow-cyan-500/20"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="w-full text-sm text-white/50 hover:text-white/80 transition-colors"
                  >
                    Back to Sign In
                  </button>
                </form>
              )}
            </div>
          ) : mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`${inputClass} pr-11`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    tabIndex={-1}
                  >
                    {showLoginPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="remember" className="accent-cyan-400 w-4 h-4 rounded" />
                  <label htmlFor="remember" className="text-sm text-white/60">Remember me</label>
                </div>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); clearError(); setResetSent(false); setResetError(null); }}
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Forgot password?
                </button>
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
            <form onSubmit={handleRequestAccess} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showSignupPw ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setPwTouched(true)}
                    className={`${inputClass} pr-11`}
                    placeholder="Min 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPw(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    tabIndex={-1}
                  >
                    {showSignupPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
                <PasswordRequirements password={password} touched={pwTouched} />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onFocus={() => setConfirmTouched(true)}
                    className={`${inputClass} pr-11 ${confirmTouched && !passwordsMatch ? 'border-red-400/50 focus:ring-red-400/50' : ''}`}
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
                {confirmTouched && confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-red-300 mt-1">Passwords do not match</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Organization</label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={e => setOrganization(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Anne Arundel County DPW"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className={selectClass}
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">State</label>
                  <select
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select state</option>
                    {US_STATES.map(s => (
                      <option key={s.abbr} value={s.abbr}>{s.abbr} — {s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  How will you use PEARL? <span className="text-white/40 font-normal">(optional)</span>
                </label>
                <textarea
                  value={useCase}
                  onChange={e => setUseCase(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="e.g. MS4 permit compliance reporting, research on urban stormwater..."
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !signupReady}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg shadow-cyan-500/20"
              >
                {isSubmitting ? 'Submitting...' : 'Request Access'}
              </button>
              <p className="text-xs text-white/40 text-center">
                All accounts are reviewed before activation.
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
