// app/login/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { MOCK_USERS, DEMO_PASSWORD } from '@/lib/mockUsers';

// Role icons and colors for the quick-access grid
const ROLE_CONFIG: Record<string, { icon: string; color: string; bg: string; desc: string }> = {
  Federal:    { icon: '🏛️', color: 'text-blue-300',   bg: 'from-blue-900/40 to-blue-800/20',     desc: 'EPA oversight & national metrics' },
  State:      { icon: '🗺️', color: 'text-emerald-300', bg: 'from-emerald-900/40 to-emerald-800/20', desc: 'State regulatory compliance' },
  MS4:        { icon: '🏗️', color: 'text-amber-300',   bg: 'from-amber-900/40 to-amber-800/20',    desc: 'Municipal stormwater permits' },
  Corporate:  { icon: '🏢', color: 'text-purple-300',  bg: 'from-purple-900/40 to-purple-800/20',  desc: 'ESG & environmental impact' },
  Researcher: { icon: '🔬', color: 'text-cyan-300',    bg: 'from-cyan-900/40 to-cyan-800/20',      desc: 'Data analysis & publications' },
  College:    { icon: '🎓', color: 'text-indigo-300',  bg: 'from-indigo-900/40 to-indigo-800/20',  desc: 'Academic programs & field studies' },
  NGO:        { icon: '🌿', color: 'text-green-300',   bg: 'from-green-900/40 to-green-800/20',    desc: 'Conservation & advocacy' },
  K12:        { icon: '📚', color: 'text-orange-300',  bg: 'from-orange-900/40 to-orange-800/20',  desc: 'STEM education & curriculum' },
  Public:     { icon: '👥', color: 'text-teal-300',    bg: 'from-teal-900/40 to-teal-800/20',      desc: 'Community engagement' },
};

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, loginError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearError();

    // Small delay for UX feel
    setTimeout(() => {
      const success = login(email, password);
      if (success) {
        router.replace('/');
      }
      setIsSubmitting(false);
    }, 400);
  };

  const handleQuickLogin = (userEmail: string) => {
    setEmail(userEmail);
    setPassword(DEMO_PASSWORD);
    clearError();
    setIsSubmitting(true);

    setTimeout(() => {
      const success = login(userEmail, DEMO_PASSWORD);
      if (success) {
        router.replace('/');
      }
      setIsSubmitting(false);
    }, 400);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-12 h-12 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 relative overflow-hidden">
      {/* Animated background — subtle water ripple effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] opacity-[0.03]"
          style={{
            background: 'radial-gradient(ellipse at 30% 50%, #06b6d4 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, #0e7490 0%, transparent 50%)',
            animation: 'pulse 8s ease-in-out infinite',
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8">
        {/* Header / Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-white">PEARL</span>
              <span className="text-cyan-400 ml-1.5 font-light">Platform</span>
            </h1>
          </div>
          <p className="text-gray-500 text-sm max-w-md">
            National Water Quality Monitoring &amp; Biofiltration Intelligence
          </p>
        </div>

        {/* Main content — login form + quick access */}
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6">

          {/* Left: Login Form */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-1">Sign In</h2>
            <p className="text-gray-500 text-sm mb-6">Enter your credentials to access the platform</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  placeholder="demo-federal@pearl.gov"
                  className="w-full px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all text-sm"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all text-sm"
                  required
                  autoComplete="current-password"
                />
              </div>

              {loginError && (
                <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">{loginError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Demo credentials toggle */}
            <div className="mt-6 pt-5 border-t border-gray-800">
              <button
                onClick={() => setShowCredentials(!showCredentials)}
                className="text-sm text-cyan-400/70 hover:text-cyan-400 transition-colors flex items-center gap-1.5"
              >
                <span>{showCredentials ? '▾' : '▸'}</span>
                {showCredentials ? 'Hide' : 'Show'} demo credentials
              </button>
              {showCredentials && (
                <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <p className="text-gray-400 text-xs mb-2">All demo accounts use the same password:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-cyan-300 text-sm bg-gray-900/50 px-2 py-1 rounded font-mono">
                      {DEMO_PASSWORD}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(DEMO_PASSWORD)}
                      className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="mt-3 space-y-1">
                    {MOCK_USERS.map(u => (
                      <div key={u.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{u.role} ({u.state}):</span>
                        <code className="text-gray-400 font-mono">{u.email}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Beta badge */}
            <div className="mt-5 flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Beta
              </span>
              <span className="text-gray-600 text-xs">v0.9 — Local Seafood Projects Inc.</span>
            </div>
          </div>

          {/* Right: Quick Access Role Cards */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3 px-1">Quick Access — Select a Role</h3>
            <div className="grid grid-cols-3 gap-2">
              {/* Show one card per unique role */}
              {Object.keys(ROLE_CONFIG).map(role => {
                const user = MOCK_USERS.find(u => u.role === role);
                if (!user) return null;
                const config = ROLE_CONFIG[role];
                return (
                  <button
                    key={user.id}
                    onClick={() => handleQuickLogin(user.email)}
                    disabled={isSubmitting}
                    className={`group relative p-3 rounded-xl border border-gray-800 hover:border-gray-600 bg-gradient-to-br ${config.bg} transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-left`}
                  >
                    <div className="text-xl mb-1.5">{config.icon}</div>
                    <div className={`text-sm font-semibold ${config.color} mb-0.5`}>
                      {user.role}
                    </div>
                    <div className="text-[10px] text-gray-500 leading-tight">
                      {config.desc}
                    </div>
                    <div className="absolute top-2 right-2 text-[9px] font-mono text-gray-600 bg-gray-800/60 px-1.5 py-0.5 rounded">
                      {user.state}
                    </div>
                    {/* Hover name tooltip */}
                    <div className="absolute inset-x-0 -bottom-1 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 px-2">
                      <div className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-[10px] text-gray-300 text-center shadow-xl">
                        {user.name} — {user.organization}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Additional State & MS4 accounts for multi-state demos */}
            {(() => {
              const extraUsers = MOCK_USERS.filter(u => {
                const firstOfRole = MOCK_USERS.find(m => m.role === u.role);
                return firstOfRole && firstOfRole.id !== u.id;
              });
              if (extraUsers.length === 0) return null;
              return (
                <div className="mt-3 p-3 bg-gray-900/40 border border-gray-800/50 rounded-xl">
                  <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Additional Locations</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {extraUsers.map(u => {
                      const config = ROLE_CONFIG[u.role] || { icon: '👤', color: 'text-gray-300', bg: '', desc: '' };
                      return (
                        <button
                          key={u.id}
                          onClick={() => handleQuickLogin(u.email)}
                          disabled={isSubmitting}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-800 transition-all text-left disabled:opacity-50 group"
                          title={`${u.name} — ${u.organization}`}
                        >
                          <span className="text-xs">{config.icon}</span>
                          <span className={`text-xs font-medium ${config.color}`}>{u.role}</span>
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-900/60 px-1 py-0.5 rounded">{u.state}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Info panel */}
            <div className="mt-4 p-4 bg-gray-900/40 border border-gray-800/50 rounded-xl">
              <h4 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">About This Demo</h4>
              <ul className="space-y-1.5 text-xs text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-500 mt-0.5">›</span>
                  <span>Each role provides a tailored dashboard view with role-specific metrics, grants, and compliance data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-500 mt-0.5">›</span>
                  <span>207+ impaired waterways monitored across all 50 states + DC</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-500 mt-0.5">›</span>
                  <span>Real-time simulation of PEARL biofiltration water quality improvements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-500 mt-0.5">›</span>
                  <span>All data is simulated for demonstration purposes</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-700 text-xs">
            &copy; 2025 Local Seafood Projects Inc. — Project PEARL
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.05) rotate(1deg); }
        }
      `}</style>
    </div>
  );
}
