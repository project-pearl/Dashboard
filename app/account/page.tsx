'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, ArrowLeft, LogOut, KeyRound, User, Sun, Moon, Shield } from 'lucide-react';
import Image from 'next/image';

// ── Password strength rules (same as login) ───────────────────────────────
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
            <span className={`text-xs ${pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {pass ? '\u2713' : '\u2717'}
            </span>
            <span className={`text-xs ${pass ? 'text-emerald-600 dark:text-emerald-300/70' : 'text-red-500 dark:text-red-300/70'}`}>
              {rule.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  MS4: 'MS4 Operator',
  State: 'State Agency',
  Federal: 'Federal',
  Corporate: 'Sustainability',
  Researcher: 'Research / Academic',
  College: 'Undergrad',
  K12: 'K-12 Educator',
  NGO: 'NGO / Conservation',
};

export default function AccountPage() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();

  // Dark mode
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('pin-dark-mode');
    const prefersDark = stored === 'true';
    setIsDark(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);
  }, []);

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('pin-dark-mode', String(next));
    document.documentElement.classList.toggle('dark', next);
  };

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwTouched, setPwTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const passwordValid = useMemo(() => PW_RULES.every(r => r.test(newPassword)), [newPassword]);
  const passwordsMatch = newPassword === confirmPassword;
  const formReady = currentPassword.length > 0 && passwordValid && passwordsMatch && confirmPassword.length > 0;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReady) return;
    setIsSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: currentPassword,
    });

    if (signInError) {
      setErrorMsg('Current password is incorrect.');
      setIsSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setErrorMsg(updateError.message);
    } else {
      setSuccessMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwTouched(false);
      setConfirmTouched(false);
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-cyan-300/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  const inputClass = 'w-full px-4 py-3 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/15 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      {/* Top bar */}
      <div className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              title="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold">My Account</h1>
          </div>
          <Image src="/Pearl-Intelligence-Network.png" alt="PIN" width={140} height={36} className="object-contain hidden sm:block" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* ── Profile Info ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
              <User className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold">Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-white/40 mb-1">Name</div>
              <div className="text-sm font-medium text-slate-800 dark:text-white/90">{user.name || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-white/40 mb-1">Email</div>
              <div className="text-sm font-medium text-slate-800 dark:text-white/90">{user.email || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-white/40 mb-1">Organization</div>
              <div className="text-sm font-medium text-slate-800 dark:text-white/90">{user.organization || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-white/40 mb-1">Role</div>
              <div className="text-sm font-medium">
                <span className="inline-block px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 text-xs font-semibold">
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-white/40 mb-1">State</div>
              <div className="text-sm font-medium text-slate-800 dark:text-white/90">{user.state || '—'}</div>
            </div>
          </div>
        </div>

        {/* ── Appearance ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
              <Shield className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold">Preferences</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-white/90">Dark Mode</div>
              <div className="text-xs text-slate-500 dark:text-white/40 mt-0.5">Toggle between light and dark themes</div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative w-14 h-7 rounded-full transition-colors ${isDark ? 'bg-cyan-600' : 'bg-slate-300'}`}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center transition-all ${isDark ? 'left-7' : 'left-0.5'}`}>
                {isDark ? <Moon className="h-3.5 w-3.5 text-cyan-600" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
              </div>
            </button>
          </div>
        </div>

        {/* ── Change Password ──────────────────────────────────────── */}
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">
              <KeyRound className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold">Change Password</h2>
          </div>

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-400/30 rounded-lg text-emerald-700 dark:text-emerald-200 text-sm">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-400/30 rounded-lg text-red-700 dark:text-red-200 text-sm">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={e => { setCurrentPassword(e.target.value); setErrorMsg(null); }}
                  className={`${inputClass} pr-11`}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/70 transition-colors"
                  tabIndex={-1}
                >
                  {showCurrentPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onFocus={() => setPwTouched(true)}
                  className={`${inputClass} pr-11`}
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/70 transition-colors"
                  tabIndex={-1}
                >
                  {showNewPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              <PasswordRequirements password={newPassword} touched={pwTouched} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onFocus={() => setConfirmTouched(true)}
                  className={`${inputClass} pr-11 ${confirmTouched && !passwordsMatch ? 'border-red-300 dark:border-red-400/50 focus:ring-red-400/50' : ''}`}
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/70 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {confirmTouched && confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-500 dark:text-red-300 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !formReady}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg shadow-cyan-500/20"
            >
              {isSubmitting ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* ── Sign Out ─────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-none">
          <button
            onClick={() => { logout(); router.replace('/login'); }}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        <div className="text-center text-slate-400 dark:text-white/40 text-xs pb-4 space-y-1">
          <p>&copy; {new Date().getFullYear()} Local Seafood Projects Inc. All rights reserved.</p>
          <p className="text-[10px] text-slate-400 dark:text-white/30">Project Pearl&trade;, Pearl&trade;, ALIA&trade;, and AQUA-LO&trade; are trademarks of Local Seafood Projects Inc.</p>
        </div>
      </div>
    </div>
  );
}
