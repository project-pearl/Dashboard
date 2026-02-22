'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/authContext';
import { PearlUser, UserRole, OPERATOR_ROLES, EXPLORER_ROLES, isOperatorRole } from '@/lib/authTypes';
import { MD_JURISDICTIONS, STATES, isFreeEmailDomain } from '@/lib/jurisdictions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Link2, Users, UserPlus, CheckCircle, XCircle, Clock,
  Copy, Check, Mail, Building2, ChevronDown,
  AlertTriangle, Send, RefreshCw, EyeOff,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_ROLES: UserRole[] = [...OPERATOR_ROLES, ...EXPLORER_ROLES];

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active:      { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' },
  pending:     { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Pending' },
  rejected:    { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Rejected' },
  deactivated: { bg: 'bg-slate-100',   text: 'text-slate-500',   label: 'Deactivated' },
};

/** Roles that warrant a free-email-domain warning */
const PROFESSIONAL_ROLES: UserRole[] = ['Federal', 'State', 'MS4', 'Corporate', 'Utility'];

// ─── Component ───────────────────────────────────────────────────────────────

interface UserManagementPanelProps {
  onRefreshPendingCount?: (count: number) => void;
}

export function UserManagementPanel({ onRefreshPendingCount }: UserManagementPanelProps) {
  const {
    user, isAdmin, approveUser, rejectUser, deactivateUser,
    updateUserRole, createInviteLink, listPendingUsers, listAllUsers,
  } = useAuth();

  const [tab, setTab] = useState<'pending' | 'invite' | 'users'>('pending');
  const [pending, setPending] = useState<PearlUser[]>([]);
  const [allUsers, setAllUsers] = useState<PearlUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [invRole, setInvRole] = useState<UserRole>('MS4');
  const [invEmail, setInvEmail] = useState('');
  const [invOrg, setInvOrg] = useState('');
  const [invState, setInvState] = useState('MD');
  const [invJurisdiction, setInvJurisdiction] = useState('');
  const [invExpiryDays, setInvExpiryDays] = useState(7);
  const [invLink, setInvLink] = useState('');
  const [invCopied, setInvCopied] = useState(false);
  const [invSending, setInvSending] = useState(false);

  // Approval state — jurisdiction binding + role override
  const [approvalJurisdictions, setApprovalJurisdictions] = useState<Record<string, string>>({});
  const [approvalRoleOverrides, setApprovalRoleOverrides] = useState<Record<string, UserRole>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    const [p, a] = await Promise.all([listPendingUsers(), listAllUsers()]);
    setPending(p);
    setAllUsers(a);
    onRefreshPendingCount?.(p.length);
    setLoading(false);
  }, [listPendingUsers, listAllUsers, onRefreshPendingCount]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!isAdmin) return null;

  // ── Invite link generation ──
  async function handleGenerateInvite() {
    setInvSending(true);
    try {
      const link = await createInviteLink({
        role: invRole,
        email: invEmail || undefined,
        jurisdiction: invJurisdiction || undefined,
        state: invState || undefined,
        organization: invOrg || undefined,
        expiresInDays: invExpiryDays,
      });
      setInvLink(link);
    } catch (err) {
      console.error(err);
    }
    setInvSending(false);
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(invLink);
    setInvCopied(true);
    setTimeout(() => setInvCopied(false), 2000);
  }

  function emailInviteLink() {
    const subject = encodeURIComponent(`You're invited to PEARL — ${invRole} Access`);
    const body = encodeURIComponent(
      `Hi${invEmail ? '' : ' there'},\n\n` +
      `You've been invited to join the PEARL Water Quality Intelligence Platform` +
      `${invRole === 'MS4' && invJurisdiction ? ` for ${MD_JURISDICTIONS.find(j => j.key === invJurisdiction)?.label || invJurisdiction}` : ''}.\n\n` +
      `Click the link below to create your account (pre-approved, no waiting):\n\n` +
      `${invLink}\n\n` +
      `This link expires in ${invExpiryDays} days.\n\n` +
      `— PEARL Team\nproject-pearl.org`
    );
    window.open(`mailto:${invEmail}?subject=${subject}&body=${body}`, '_blank');
  }

  // ── Approve user (with optional role change) ──
  async function handleApprove(uid: string) {
    const jur = approvalJurisdictions[uid];
    const roleOverride = approvalRoleOverrides[uid];

    // If admin changed the role, apply that first
    if (roleOverride) {
      await updateUserRole(uid, roleOverride, jur || undefined);
    }

    await approveUser(uid, jur || undefined);
    await refresh();
  }

  async function handleReject(uid: string) {
    await rejectUser(uid);
    await refresh();
  }

  async function handleDeactivate(uid: string) {
    await deactivateUser(uid);
    await refresh();
  }

  const pendingCount = pending.length;

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        {([
          { key: 'pending' as const, label: 'Pending Approvals', icon: Clock, badge: pendingCount },
          { key: 'invite' as const, label: 'Invite User', icon: Link2, badge: 0 },
          { key: 'users' as const, label: 'All Users', icon: Users, badge: 0 },
        ]).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.badge > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Pending Approvals ── */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-sm text-slate-400">Loading...</div>
          ) : pending.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">No pending requests</p>
                <p className="text-xs text-slate-400 mt-1">All access requests have been processed.</p>
              </CardContent>
            </Card>
          ) : (
            pending.map(u => {
              const effectiveRole = approvalRoleOverrides[u.uid] || u.role;
              const hasFreeEmail = isFreeEmailDomain(u.email);
              const showEmailWarning = hasFreeEmail && PROFESSIONAL_ROLES.includes(u.role);

              return (
                <Card key={u.uid} className="border-2 border-amber-200 bg-amber-50/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-800">{u.name}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px]">{u.role}</Badge>
                          {u.organization && <span className="text-[11px] text-slate-500">{u.organization}</span>}
                          {u.state && <span className="text-[11px] text-slate-400">{u.state}</span>}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Email domain warning */}
                    {showEmailWarning && (
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-orange-700">
                          <span className="font-semibold">Free email domain</span> — this user claims <span className="font-semibold">{u.role}</span> role but registered with a personal email ({u.email.split('@')[1]}). Verify affiliation before approving.
                        </p>
                      </div>
                    )}

                    {/* Role override dropdown */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                        Assign Role
                      </label>
                      <select
                        value={effectiveRole}
                        onChange={e => setApprovalRoleOverrides(prev => ({ ...prev, [u.uid]: e.target.value as UserRole }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                      >
                        {ALL_ROLES.map(r => (
                          <option key={r} value={r}>
                            {r}{r === u.role ? ' (requested)' : ''}{isOperatorRole(r) ? ' — operator' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Jurisdiction binding (for MS4/State operators) */}
                    {isOperatorRole(effectiveRole) && effectiveRole === 'MS4' && (
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                          Bind Jurisdiction (required for MS4)
                        </label>
                        <select
                          value={approvalJurisdictions[u.uid] || ''}
                          onChange={e => setApprovalJurisdictions(prev => ({ ...prev, [u.uid]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                        >
                          <option value="">Select jurisdiction...</option>
                          {MD_JURISDICTIONS.map(j => (
                            <option key={j.key} value={j.key}>{j.label} ({j.permit})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(u.uid)}
                        disabled={effectiveRole === 'MS4' && !approvalJurisdictions[u.uid]}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(u.uid)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold text-red-700 border border-red-300 hover:bg-red-50 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Invite User ── */}
      {tab === 'invite' && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm text-slate-600">
              Generate a pre-approved invite link. The recipient will create their account with role and jurisdiction already bound — no waiting.
            </p>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
              <select
                value={invRole}
                onChange={e => { setInvRole(e.target.value as UserRole); setInvLink(''); }}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
              >
                {ALL_ROLES.map(r => (
                  <option key={r} value={r}>{r}{isOperatorRole(r) ? ' (operator)' : ''}</option>
                ))}
              </select>
            </div>

            {/* Email (optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Recipient Email <span className="text-slate-400 font-normal">(optional — locks invite to this email)</span>
              </label>
              <input
                type="email"
                value={invEmail}
                onChange={e => { setInvEmail(e.target.value); setInvLink(''); }}
                placeholder="eric@aacounty.org"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
              />
            </div>

            {/* Organization */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Organization</label>
              <input
                type="text"
                value={invOrg}
                onChange={e => { setInvOrg(e.target.value); setInvLink(''); }}
                placeholder="Anne Arundel County DPW"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
              />
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">State</label>
              <select
                value={invState}
                onChange={e => { setInvState(e.target.value); setInvLink(''); }}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
              >
                {STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.name}</option>)}
              </select>
            </div>

            {/* Jurisdiction (MS4/State) */}
            {(invRole === 'MS4' || invRole === 'State') && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">MS4 Jurisdiction</label>
                <select
                  value={invJurisdiction}
                  onChange={e => { setInvJurisdiction(e.target.value); setInvLink(''); }}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                >
                  <option value="">None (bind later)</option>
                  {MD_JURISDICTIONS.map(j => <option key={j.key} value={j.key}>{j.label} ({j.permit})</option>)}
                </select>
              </div>
            )}

            {/* Expiry */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Link Expiry</label>
              <select
                value={invExpiryDays}
                onChange={e => { setInvExpiryDays(Number(e.target.value)); setInvLink(''); }}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
              >
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerateInvite}
              disabled={invSending}
              className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 disabled:opacity-60 transition-all"
            >
              <Link2 className="inline h-4 w-4 mr-1.5" />
              Generate Invite Link
            </button>

            {/* Generated link */}
            {invLink && (
              <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Invite Link Generated</span>
                </div>

                {/* Link display */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={invLink}
                    readOnly
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-600 bg-white font-mono truncate"
                  />
                  <button
                    onClick={copyInviteLink}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
                  >
                    {invCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {invCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {/* Email button */}
                {invEmail && (
                  <button
                    onClick={emailInviteLink}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-cyan-700 border border-cyan-300 hover:bg-cyan-50 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Email to {invEmail}
                  </button>
                )}

                <div className="text-[10px] text-slate-400">
                  Expires {new Date(Date.now() + invExpiryDays * 86400000).toLocaleDateString()}.
                  Role: {invRole}
                  {invJurisdiction && ` · Jurisdiction: ${MD_JURISDICTIONS.find(j => j.key === invJurisdiction)?.label}`}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── All Users ── */}
      {tab === 'users' && (
        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">{allUsers.length} user{allUsers.length !== 1 ? 's' : ''}</span>
              <button onClick={refresh} className="flex items-center gap-1.5 text-xs text-cyan-600 hover:text-cyan-700 font-medium transition-colors">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-sm text-slate-400">Loading...</div>
            ) : (
              allUsers
                .sort((a, b) => {
                  const order: Record<string, number> = { pending: 0, active: 1, rejected: 2, deactivated: 3 };
                  return (order[a.status] ?? 4) - (order[b.status] ?? 4) || a.name.localeCompare(b.name);
                })
                .map(u => {
                  const sb = STATUS_BADGE[u.status] || STATUS_BADGE.active;
                  const isCurrentUser = u.uid === user?.uid;
                  return (
                    <div key={u.uid} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      u.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                      {/* Avatar */}
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-xs font-bold text-slate-600 flex-shrink-0">
                        {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800 truncate">{u.name}</span>
                          {u.isAdmin && <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[9px] px-1.5">ADMIN</Badge>}
                          {isCurrentUser && <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 text-[9px] px-1.5">YOU</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{u.email}</span>
                          <span>·</span>
                          <span>{u.role}</span>
                          {u.ms4Jurisdiction && (
                            <>
                              <span>·</span>
                              <span className="text-cyan-600">{MD_JURISDICTIONS.find(j => j.key === u.ms4Jurisdiction)?.label || u.ms4Jurisdiction}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status + actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="secondary" className={`${sb.bg} ${sb.text} text-[10px]`}>{sb.label}</Badge>
                        {u.status === 'active' && !isCurrentUser && (
                          <button
                            onClick={() => handleDeactivate(u.uid)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Deactivate"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {u.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(u.uid)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleReject(u.uid)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              title="Reject"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
