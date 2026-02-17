'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { UserRole, isOperatorRole, OPERATOR_ROLES, EXPLORER_ROLES, InvitePayload } from '@/lib/authTypes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Waves, Lock, Mail, User, Building2, MapPin, ArrowRight, AlertTriangle,
  CheckCircle, Clock, Shield, GraduationCap, Users, Globe, ChevronDown,
} from 'lucide-react';

// ─── Jurisdiction options (MD only for now — expand per state) ────────────

const MD_JURISDICTIONS: { key: string; label: string; permit: string }[] = [
  { key: 'anne_arundel_county', label: 'Anne Arundel County', permit: 'MDR068144' },
  { key: 'baltimore_county', label: 'Baltimore County', permit: 'MDR068246' },
  { key: 'baltimore_city', label: 'Baltimore City', permit: 'MDR068322' },
  { key: 'howard_county', label: 'Howard County', permit: 'MDR068365' },
  { key: 'montgomery_county', label: 'Montgomery County', permit: 'MDR068399' },
  { key: 'prince_georges_county', label: "Prince George's County", permit: 'MDR068284' },
  { key: 'harford_county', label: 'Harford County', permit: 'MDR068411' },
  { key: 'charles_county', label: 'Charles County', permit: 'MDR068438' },
  { key: 'frederick_county', label: 'Frederick County', permit: 'MDR068446' },
  { key: 'carroll_county', label: 'Carroll County', permit: 'MDR068454' },
  { key: 'cecil_county', label: 'Cecil County', permit: 'MDR068462' },
  { key: 'queen_annes_county', label: "Queen Anne's County", permit: 'MDR068471' },
  { key: 'kent_county', label: 'Kent County', permit: 'MDR068489' },
  { key: 'talbot_county', label: 'Talbot County', permit: 'MDR068497' },
  { key: 'dorchester_county', label: 'Dorchester County', permit: 'MDR068501' },
  { key: 'wicomico_county', label: 'Wicomico County', permit: 'MDR068519' },
  { key: 'washington_county', label: 'Washington County', permit: 'MDR068527' },
  { key: 'calvert_county', label: 'Calvert County', permit: 'MDR068535' },
  { key: 'st_marys_county', label: "St. Mary's County", permit: 'MDR068543' },
];

const ROLE_META: Record<UserRole, { icon: typeof Shield; label: string; desc: string; tier: 'explorer' | 'operator' }> = {
  Public:     { icon: Globe,          label: 'Public',                desc: 'View public water quality data',                              tier: 'explorer' },
  K12:        { icon: Users,          label: 'K-12 Educator',         desc: 'Classroom tools & educational content',                       tier: 'explorer' },
  College:    { icon: GraduationCap,  label: 'College / University',  desc: 'Research data access & academic tools',                       tier: 'explorer' },
  Researcher: { icon: GraduationCap,  label: 'Researcher',            desc: 'Full data export, API access, citation tools',                tier: 'explorer' },
  NGO:        { icon: Users,          label: 'Non-Profit / NGO',      desc: 'Community reporting & advocacy tools',                        tier: 'explorer' },
  MS4:        { icon: Building2,      label: 'MS4 Compliance',        desc: 'Jurisdiction-specific compliance & reporting',                 tier: 'operator' },
  State:      { icon: Shield,         label: 'State Regulator',       desc: 'Statewide water quality intelligence',                        tier: 'operator' },
  Federal:    { icon: Shield,         label: 'Federal Agency',        desc: 'National monitoring & Bay-wide analytics',                    tier: 'operator' },
  Corporate:  { icon: Building2,      label: 'Corporate / ESG',       desc: 'ESG compliance reporting & sustainability dashboards',         tier: 'operator' },
};

const STATES = [
  { abbr: 'MD', name: 'Maryland' }, { abbr: 'VA', name: 'Virginia' }, { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'DC', name: 'Washington DC' }, { abbr: 'NY', name: 'New York' }, { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'DE', name: 'Delaware' },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface SignupFormProps {
  invitePayload?: InvitePayload | null;  // If signing up via invite link
  inviteToken?: string;
  onSuccess: () => void;                  // Called after successful signup + login
  onSwitchToLogin: () => void;           // Switch to login form
}

export function SignupForm({ invitePayload, inviteToken, onSuccess, onSwitchToLogin }: SignupFormProps) {
  const { signup, loginAsync } = useAuth();

  const [step, setStep] = useState<'role' | 'details' | 'pending' | 'done'>( invitePayload ? 'details' : 'role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(invitePayload?.role || null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(invitePayload?.email || '');
  const [password, setPassword] = useState('');
  const [organization, setOrganization] = useState(invitePayload?.organization || '');
  const [state, setState] = useState(invitePayload?.state || 'MD');
  const [jurisdiction, setJurisdiction] = useState(invitePayload?.jurisdiction || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isInvite = !!invitePayload;
  const roleMeta = selectedRole ? ROLE_META[selectedRole] : null;
  const isOperator = selectedRole ? isOperatorRole(selectedRole) : false;

  async function handleSubmit() {
    if (!selectedRole || !name || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setSubmitting(true);

    const result = await signup({
      email,
      password,
      name,
      role: selectedRole,
      organization: organization || undefined,
      state: state || undefined,
      requestedJurisdiction: jurisdiction || undefined,
      inviteToken: inviteToken || undefined,
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Signup failed.');
      return;
    }

    if (result.user?.status === 'pending') {
      setStep('pending');
      return;
    }

    // Active account — auto-login
    const loginResult = await loginAsync(email, password);
    if (loginResult.success) {
      setStep('done');
      onSuccess();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-700 shadow-sm">
            <Waves className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>PEARL</div>
            <div className="text-[9px] font-medium text-slate-400 -mt-1 tracking-widest uppercase">Create Account</div>
          </div>
        </div>

        {/* Invite badge */}
        {isInvite && (
          <div className="flex items-center gap-2 justify-center mb-4">
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Invited — Pre-approved Access
            </Badge>
          </div>
        )}

        {/* ── STEP 1: Role Selection ── */}
        {step === 'role' && (
          <Card className="border-2 border-slate-200">
            <CardHeader className="text-center">
              <CardTitle className="text-lg">Choose Your Role</CardTitle>
              <CardDescription>This determines which tools and data you'll see.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Explorer roles */}
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Instant Access</div>
              {EXPLORER_ROLES.map(role => {
                const meta = ROLE_META[role];
                const Icon = meta.icon;
                const isSelected = selectedRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-50 ring-1 ring-cyan-200'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${isSelected ? 'bg-cyan-100' : 'bg-slate-100'}`}>
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-cyan-700' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{meta.label}</div>
                      <div className="text-[11px] text-slate-500">{meta.desc}</div>
                    </div>
                    {isSelected && <CheckCircle className="h-4 w-4 text-cyan-600 flex-shrink-0" />}
                  </button>
                );
              })}

              {/* Operator roles */}
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 mt-4 flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                Requires Approval
              </div>
              {OPERATOR_ROLES.map(role => {
                const meta = ROLE_META[role];
                const Icon = meta.icon;
                const isSelected = selectedRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-200'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${isSelected ? 'bg-amber-100' : 'bg-slate-100'}`}>
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-amber-700' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{meta.label}</div>
                      <div className="text-[11px] text-slate-500">{meta.desc}</div>
                    </div>
                    {isSelected && <CheckCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />}
                  </button>
                );
              })}

              {/* Continue button */}
              <button
                onClick={() => selectedRole && setStep('details')}
                disabled={!selectedRole}
                className="w-full mt-4 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed hover:from-cyan-700 hover:to-blue-800 transition-all"
              >
                Continue
                <ArrowRight className="inline h-4 w-4 ml-1.5" />
              </button>

              <div className="text-center mt-3">
                <button onClick={onSwitchToLogin} className="text-sm text-cyan-600 hover:text-cyan-700 font-medium transition-colors">
                  Already have an account? Sign in
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 2: Details ── */}
        {step === 'details' && selectedRole && (
          <Card className="border-2 border-slate-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                {roleMeta && (() => { const Icon = roleMeta.icon; return <Icon className="h-5 w-5 text-cyan-600" />; })()}
                <CardTitle className="text-lg">{roleMeta?.label}</CardTitle>
                {isOperator && !isInvite && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                    <Clock className="h-3 w-3 mr-0.5" />
                    Requires Approval
                  </Badge>
                )}
                {isInvite && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                    <CheckCircle className="h-3 w-3 mr-0.5" />
                    Pre-approved
                  </Badge>
                )}
              </div>
              <CardDescription>{roleMeta?.desc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="jane@county.gov"
                    disabled={!!invitePayload?.email}
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Organization */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Organization</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={organization}
                    onChange={e => setOrganization(e.target.value)}
                    placeholder="e.g. Anne Arundel County DPW"
                    disabled={!!invitePayload?.organization}
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              {/* State */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">State</label>
                <select
                  value={state}
                  onChange={e => setState(e.target.value)}
                  disabled={!!invitePayload?.state}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none transition-all bg-white disabled:bg-slate-100"
                >
                  {STATES.map(s => (
                    <option key={s.abbr} value={s.abbr}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Jurisdiction (for MS4 role) */}
              {(selectedRole === 'MS4' || invitePayload?.jurisdiction) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    MS4 Jurisdiction {isInvite ? '' : '(requested)'}
                  </label>
                  <select
                    value={jurisdiction}
                    onChange={e => setJurisdiction(e.target.value)}
                    disabled={!!invitePayload?.jurisdiction}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none transition-all bg-white disabled:bg-slate-100"
                  >
                    <option value="">Select jurisdiction...</option>
                    {MD_JURISDICTIONS.map(j => (
                      <option key={j.key} value={j.key}>{j.label} ({j.permit})</option>
                    ))}
                  </select>
                  {!isInvite && isOperator && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      An admin will verify and bind your jurisdiction before activation.
                    </p>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Operator warning */}
              {isOperator && !isInvite && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Account requires approval</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {selectedRole === 'MS4' ? 'MS4 compliance' : selectedRole} accounts need admin verification.
                      You'll receive an email once your access is approved and your jurisdiction is bound.
                    </p>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !name || !email || !password}
                className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed hover:from-cyan-700 hover:to-blue-800 transition-all"
              >
                {submitting ? 'Creating Account...' : isOperator && !isInvite ? 'Request Access' : 'Create Account'}
              </button>

              {/* Back / switch */}
              <div className="flex justify-between text-sm">
                {!isInvite && (
                  <button onClick={() => setStep('role')} className="text-slate-500 hover:text-slate-700 transition-colors">
                    ← Back
                  </button>
                )}
                <button onClick={onSwitchToLogin} className="text-cyan-600 hover:text-cyan-700 font-medium transition-colors ml-auto">
                  Sign in instead
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 3: Pending ── */}
        {step === 'pending' && (
          <Card className="border-2 border-amber-200 bg-amber-50/50">
            <CardContent className="pt-8 text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mx-auto">
                <Clock className="h-8 w-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Access Request Submitted</h2>
              <p className="text-sm text-slate-600 max-w-sm mx-auto">
                Your <strong>{roleMeta?.label}</strong> account request has been submitted.
                An administrator will review and bind your jurisdiction, then you'll receive an email at <strong>{email}</strong>.
              </p>
              <p className="text-xs text-slate-400">
                This typically takes 1-2 business days. Questions? Contact info@project-pearl.org
              </p>
              <button
                onClick={onSwitchToLogin}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-cyan-700 border border-cyan-300 rounded-lg hover:bg-cyan-50 transition-colors mt-4"
              >
                Back to Sign In
              </button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Login Form ─────────────────────────────────────────────────────────────

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchToSignup: () => void;
}

export function LoginForm({ onSuccess, onSwitchToSignup }: LoginFormProps) {
  const { loginAsync } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setError('');
    setSubmitting(true);
    const result = await loginAsync(email, password);
    setSubmitting(false);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Login failed.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-700 shadow-sm">
            <Waves className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>PEARL</div>
            <div className="text-[9px] font-medium text-slate-400 -mt-1 tracking-widest uppercase">Sign In</div>
          </div>
        </div>

        <Card className="border-2 border-slate-200">
          <CardContent className="pt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={submitting}
              className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-700 disabled:opacity-60 hover:from-cyan-700 hover:to-blue-800 transition-all"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="text-center">
              <button onClick={onSwitchToSignup} className="text-sm text-cyan-600 hover:text-cyan-700 font-medium transition-colors">
                Create an account
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
