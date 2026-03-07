'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { PearlUser, UserRole, AdminLevel, OPERATOR_ROLES, EXPLORER_ROLES, isOperatorRole } from '@/lib/authTypes';
import type { ApprovalOverrides } from '@/lib/authContext';
import { isFreeEmailDomain, getJurisdictionsForState, getTopLevelJurisdictions, getChildJurisdictions, hasChildJurisdictions, getParentJurisdiction, getJurisdictionDisplayLabel, getJurisdictionById } from '@/lib/jurisdictions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Link2, Users, UserPlus, CheckCircle, XCircle, Clock,
  Copy, Check, Mail, Building2, ChevronDown,
  AlertTriangle, Send, RefreshCw, Trash2, Search, Shield, ShieldCheck,
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

const selectClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none';
const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none placeholder-slate-400';

const ALL_US_STATES: { abbr: string; name: string }[] = [
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

/** Route preview per role */
const ROUTE_PREVIEWS: Record<string, (...args: string[]) => string> = {
  Federal:    ()                       => '/dashboard/federal',
  State:      (state: string)          => `/dashboard/state/${state || '{state}'}`,
  Local:      (_s: string, jur: string) => `/dashboard/local/${jur || '{jurisdictionId}'}`,
  MS4:        (_s: string, jur: string) => `/dashboard/ms4/${jur || '{ms4Jurisdiction}'}`,
  Corporate:  ()                       => '/dashboard/esg',
  Utility:    ()                       => '/dashboard/utility/default',
  Agriculture:()                       => '/dashboard/infrastructure',
  Lab:        ()                       => '/dashboard/aqua-lo',
  Biotech:    ()                       => '/dashboard/biotech',
  Investor:   ()                       => '/dashboard/investor',
  K12:        ()                       => '/dashboard/k12',
  College:    ()                       => '/dashboard/university',
  Researcher: ()                       => '/dashboard/university',
  NGO:        ()                       => '/dashboard/ngo',
  Temp:       ()                       => '/dashboard/k12',
  Pearl:      ()                       => '/dashboard/pearl',
  _default:   (role: string)           => `/dashboard/${role.toLowerCase()}`,
};

function accessType(role: UserRole): 'operator' | 'explorer' {
  return EXPLORER_ROLES.includes(role) ? 'explorer' : 'operator';
}

function accessScopeSummary(user: PearlUser): string {
  if (user.status === 'pending') return 'No platform access yet. Waiting for admin approval.';
  if (user.status === 'rejected') return 'No platform access. Request was rejected.';
  if (user.status === 'deactivated') return 'No platform access. Account is deactivated.';
  if (user.isSuperAdmin) return 'Super admin. Full user management and all role views.';
  if (user.isAdmin) return 'Role admin. Can invite users within scope.';
  if (accessType(user.role) === 'explorer') return 'Explorer access. Read-focused role views with no operator/admin controls.';
  return 'Operator access. Role-based operational center with action tools where permitted.';
}

/** Admin level badge */
function AdminBadge({ level, isMilitary }: { level: AdminLevel; isMilitary?: boolean }) {
  return (
    <>
      {level === 'super_admin' && (
        <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[9px] px-1.5">
          SUPER ADMIN
        </Badge>
      )}
      {level === 'role_admin' && (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[9px] px-1.5">
          ROLE ADMIN
        </Badge>
      )}
      {level === 'none' && (
        <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[9px] px-1.5">
          STANDARD
        </Badge>
      )}
      {isMilitary && (
        <Badge variant="secondary" className="bg-olive-100 text-[#556b2f] bg-[#e8ecd5] text-[9px] px-1.5">
          MILITARY
        </Badge>
      )}
    </>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface ScopeFilter {
  allowedRoles?: UserRole[];
  lockedState?: string;
  lockedJurisdiction?: string;
}

interface UserManagementPanelProps {
  onRefreshPendingCount?: (count: number) => void;
  scopeFilter?: ScopeFilter;
}

export function UserManagementPanel({ onRefreshPendingCount, scopeFilter }: UserManagementPanelProps) {
  const {
    user, isAdmin, approveUser, rejectUser, deactivateUser,
    deleteUser, updateUserRole, createInviteLink, listPendingUsers, listAllUsers,
    grantRoleAdmin, revokeRoleAdmin,
  } = useAuth();

  const [tab, setTab] = useState<'pending' | 'invite' | 'users'>('pending');
  const [pending, setPending] = useState<PearlUser[]>([]);
  const [allUsers, setAllUsers] = useState<PearlUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userSortBy, setUserSortBy] = useState<'name' | 'role' | 'state' | 'admin' | 'status'>('name');
  const [userSortDir, setUserSortDir] = useState<'asc' | 'desc'>('asc');
  const [actionBusyUid, setActionBusyUid] = useState<string | null>(null);

  // Invite form state
  const [invRole, setInvRole] = useState<UserRole>(scopeFilter?.allowedRoles?.[0] || 'MS4');
  const [invEmail, setInvEmail] = useState('');
  const [invOrg, setInvOrg] = useState('');
  const [invState, setInvState] = useState(scopeFilter?.lockedState || 'MD');
  const [invJurisdiction, setInvJurisdiction] = useState(scopeFilter?.lockedJurisdiction || '');
  const [invExpiryDays, setInvExpiryDays] = useState(7);
  const [invLink, setInvLink] = useState('');
  const [invCopied, setInvCopied] = useState(false);
  const [invSending, setInvSending] = useState(false);
  const [invMilitary, setInvMilitary] = useState(false);

  // Approval state
  const [approvalOverrides, setApprovalOverrides] = useState<Record<string, ApprovalOverrides>>({});

  // Parent county selections for two-step drilldown (pending approval, keyed by uid)
  const [parentCountySelections, setParentCountySelections] = useState<Record<string, string>>({});
  // Parent county for invite form
  const [invParentCounty, setInvParentCounty] = useState('');

  // Roles available in the invite dropdown
  const availableRoles = useMemo(() => {
    if (scopeFilter?.allowedRoles && scopeFilter.allowedRoles.length > 0) {
      return scopeFilter.allowedRoles;
    }
    return ALL_ROLES;
  }, [scopeFilter?.allowedRoles]);

  // Top-level jurisdictions (counties) for current invite state
  const invCountiesForState = useMemo(() => {
    return getTopLevelJurisdictions(invState || undefined);
  }, [invState]);

  // Child municipalities for selected parent county in invite form
  const invChildJurisdictions = useMemo(() => {
    if (!invParentCounty) return [];
    return getChildJurisdictions(invParentCounty);
  }, [invParentCounty]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [p, a] = await Promise.all([listPendingUsers(), listAllUsers()]);

    // Apply scope filter to pending/all users if present
    const filterByScope = (users: PearlUser[]) => {
      if (!scopeFilter) return users;
      let filtered = users;
      if (scopeFilter.allowedRoles && scopeFilter.allowedRoles.length > 0) {
        filtered = filtered.filter(u => scopeFilter.allowedRoles!.includes(u.role));
      }
      if (scopeFilter.lockedState) {
        filtered = filtered.filter(u => !u.state || u.state === scopeFilter.lockedState);
      }
      if (scopeFilter.lockedJurisdiction) {
        filtered = filtered.filter(u => !u.ms4Jurisdiction || u.ms4Jurisdiction === scopeFilter.lockedJurisdiction);
      }
      return filtered;
    };

    setPending(filterByScope(p));
    setAllUsers(filterByScope(a));
    onRefreshPendingCount?.(filterByScope(p).length);
    setLoading(false);
  }, [listPendingUsers, listAllUsers, onRefreshPendingCount, scopeFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  // Guard: admins only (adminLevel !== 'none')
  if (user?.adminLevel === 'none' && user?.role !== 'Pearl') return null;

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
        isMilitary: invRole === 'Federal' && invMilitary ? true : undefined,
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
    const subject = encodeURIComponent(`You're invited to PEARL - ${invRole} Access`);
    const body = encodeURIComponent(
      `Hi${invEmail ? '' : ' there'},\n\n` +
      `You've been invited to join the PEARL Water Quality Intelligence Platform` +
      `${(['MS4', 'Local'].includes(invRole) && invJurisdiction) ? ` for ${getJurisdictionDisplayLabel(invJurisdiction)}` : ''}.\n\n` +
      `Click the link below to create your account (pre-approved, no waiting):\n\n` +
      `${invLink}\n\n` +
      `This link expires in ${invExpiryDays} days.\n\n` +
      `-- PEARL Team\nproject-pearl.org`
    );
    window.open(`mailto:${invEmail}?subject=${subject}&body=${body}`, '_blank');
  }

  function getOverride(uid: string): ApprovalOverrides {
    return approvalOverrides[uid] ?? {};
  }

  function setOverrideField(uid: string, field: keyof ApprovalOverrides, value: string) {
    setApprovalOverrides(prev => ({
      ...prev,
      [uid]: { ...prev[uid], [field]: value || undefined },
    }));
  }

  async function handleApprove(uid: string) {
    const overrides = getOverride(uid);
    await approveUser(uid, Object.keys(overrides).length > 0 ? overrides : undefined);
    await refresh();
  }

  async function handleReject(uid: string) {
    await rejectUser(uid);
    await refresh();
  }

  async function handleToggleBlock(target: PearlUser) {
    if (target.uid === user?.uid) return;
    setActionBusyUid(target.uid);
    try {
      if (target.status === 'deactivated') await approveUser(target.uid);
      else await deactivateUser(target.uid);
      await refresh();
    } finally {
      setActionBusyUid(null);
    }
  }

  async function handleDeleteUser(target: PearlUser) {
    if (target.uid === user?.uid) return;
    const ok = window.confirm(`Delete user ${target.name} (${target.email})? This removes the account permanently.`);
    if (!ok) return;
    setActionBusyUid(target.uid);
    try {
      await deleteUser(target.uid);
      await refresh();
    } finally {
      setActionBusyUid(null);
    }
  }

  async function handleToggleRoleAdmin(target: PearlUser) {
    setActionBusyUid(target.uid);
    try {
      if (target.adminLevel === 'role_admin') {
        await revokeRoleAdmin(target.uid);
      } else {
        await grantRoleAdmin(target.uid);
      }
      await refresh();
    } finally {
      setActionBusyUid(null);
    }
  }

  // Determine which drilldown fields to show for invite form
  const invNeedsState = ['State', 'Federal', 'MS4', 'Local', 'Utility', 'Corporate', 'Biotech', 'Investor', 'K12'].includes(invRole);
  const invNeedsJurisdiction = ['MS4', 'Local'].includes(invRole);
  const invNeedsMilitary = invRole === 'Federal';
  const invNeedsOrg = ['Corporate', 'Utility', 'Biotech', 'Investor', 'K12'].includes(invRole);

  const pendingCount = pending.length;
  const activeExplorerCount = allUsers.filter((u) => u.status === 'active' && accessType(u.role) === 'explorer').length;
  const activeOperatorCount = allUsers.filter((u) => u.status === 'active' && accessType(u.role) === 'operator').length;
  const visibleUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    const filtered = query
      ? allUsers.filter((u) => (u.name || '').toLowerCase().includes(query))
      : allUsers;

    const statusOrder: Record<string, number> = { pending: 0, active: 1, rejected: 2, deactivated: 3 };
    return [...filtered].sort((a, b) => {
      const dir = userSortDir === 'asc' ? 1 : -1;
      switch (userSortBy) {
        case 'role':
          return a.role.localeCompare(b.role) * dir || a.name.localeCompare(b.name);
        case 'state':
          return (a.state || '').localeCompare(b.state || '') * dir || a.name.localeCompare(b.name);
        case 'admin':
          return ((a.adminLevel === 'super_admin' ? 2 : a.adminLevel === 'role_admin' ? 1 : 0) -
                  (b.adminLevel === 'super_admin' ? 2 : b.adminLevel === 'role_admin' ? 1 : 0)) * dir || a.name.localeCompare(b.name);
        case 'status':
          return ((statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)) * dir || a.name.localeCompare(b.name);
        case 'name':
        default:
          return a.name.localeCompare(b.name) * dir;
      }
    });
  }, [allUsers, userSearch, userSortBy, userSortDir]);

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
              const ov = getOverride(u.uid);
              const effectiveRole = (ov.role || u.role) as UserRole;
              const effectiveState = ov.state || u.state || '';
              const effectiveOrg = ov.organization ?? u.organization ?? '';
              const effectiveJurisdiction = ov.ms4Jurisdiction || u.ms4Jurisdiction || '';
              const hasFreeEmail = isFreeEmailDomain(u.email);
              const showEmailWarning = hasFreeEmail && PROFESSIONAL_ROLES.includes(effectiveRole);

              const needsState = ['State', 'Federal', 'MS4', 'Local', 'Utility'].includes(effectiveRole);
              const needsJurisdiction = ['MS4', 'Local'].includes(effectiveRole);
              const needsOrg = isOperatorRole(effectiveRole);

              const routePreview = ROUTE_PREVIEWS[effectiveRole]?.(effectiveState, effectiveJurisdiction) ?? ROUTE_PREVIEWS._default(effectiveRole);

              const missingFields: string[] = [];
              if (needsState && !effectiveState) missingFields.push('state');
              if (needsJurisdiction && !effectiveJurisdiction) missingFields.push('jurisdiction');
              const canApprove = missingFields.length === 0;

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

                    {showEmailWarning && (
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-orange-700">
                          <span className="font-semibold">Free email domain.</span> This user claims <span className="font-semibold">{effectiveRole}</span> role but registered with a personal email ({u.email.split('@')[1]}). Verify affiliation before approving.
                        </p>
                      </div>
                    )}

                    {/* Role Assignment */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Assign Role</label>
                      <select
                        value={effectiveRole}
                        onChange={e => setOverrideField(u.uid, 'role', e.target.value)}
                        className={selectClass}
                      >
                        {availableRoles.map(r => (
                          <option key={r} value={r}>
                            {r}{r === u.role ? ' (requested)' : ''}{isOperatorRole(r) ? ' (operator)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* State */}
                    {needsState && (
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                          State {effectiveRole === 'State' ? '(determines landing page)' : ''}
                        </label>
                        <select
                          value={effectiveState}
                          onChange={e => setOverrideField(u.uid, 'state', e.target.value)}
                          className={selectClass}
                          disabled={!!scopeFilter?.lockedState}
                        >
                          <option value="">Select state...</option>
                          {ALL_US_STATES.map(s => (
                            <option key={s.abbr} value={s.abbr}>{s.name} ({s.abbr})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Local Jurisdiction — two-step county → municipality drilldown */}
                    {needsJurisdiction && (() => {
                      const parentCounty = parentCountySelections[u.uid]
                        || (effectiveJurisdiction ? (getParentJurisdiction(effectiveJurisdiction)?.jurisdiction_id || (getJurisdictionById(effectiveJurisdiction)?.jurisdiction_type === 'county' ? effectiveJurisdiction : '')) : '');
                      const counties = getTopLevelJurisdictions(effectiveState || undefined);
                      const children = parentCounty ? getChildJurisdictions(parentCounty) : [];
                      const showStep2 = parentCounty && children.length > 0;
                      return (
                        <>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                              Local Jurisdiction — County
                            </label>
                            <select
                              value={parentCounty}
                              onChange={e => {
                                const countyId = e.target.value;
                                setParentCountySelections(prev => ({ ...prev, [u.uid]: countyId }));
                                // If county has no children, set jurisdiction directly to county
                                if (countyId && !hasChildJurisdictions(countyId)) {
                                  setOverrideField(u.uid, 'ms4Jurisdiction', countyId);
                                } else {
                                  // Reset jurisdiction — user must pick sub-municipality or county default
                                  setOverrideField(u.uid, 'ms4Jurisdiction', countyId);
                                }
                              }}
                              className={selectClass}
                              disabled={!!scopeFilter?.lockedJurisdiction}
                            >
                              <option value="">Select county...</option>
                              {counties.map(j => (
                                <option key={j.jurisdiction_id} value={j.jurisdiction_id}>{j.jurisdiction_name}</option>
                              ))}
                            </select>
                          </div>
                          {showStep2 && (
                            <div>
                              <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                                Local Jurisdiction — Municipality
                              </label>
                              <select
                                value={effectiveJurisdiction}
                                onChange={e => setOverrideField(u.uid, 'ms4Jurisdiction', e.target.value)}
                                className={selectClass}
                                disabled={!!scopeFilter?.lockedJurisdiction}
                              >
                                <option value={parentCounty}>
                                  {getJurisdictionById(parentCounty)?.jurisdiction_name} (entire county)
                                </option>
                                {children.map(j => (
                                  <option key={j.jurisdiction_id} value={j.jurisdiction_id}>{j.jurisdiction_name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Organization */}
                    {needsOrg && (
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Organization</label>
                        <input
                          type="text"
                          value={effectiveOrg}
                          onChange={e => setOverrideField(u.uid, 'organization', e.target.value)}
                          placeholder={u.organization || 'e.g. Anne Arundel County DPW'}
                          className={inputClass}
                        />
                      </div>
                    )}

                    {/* Landing route preview */}
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-semibold text-slate-500 mb-1">Landing page</div>
                      <code className="text-[11px] text-cyan-700 font-mono">{routePreview}</code>
                    </div>

                    {/* Validation warnings */}
                    {!canApprove && (
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-red-700">
                          Missing required field{missingFields.length > 1 ? 's' : ''}: <span className="font-semibold">{missingFields.join(', ')}</span>
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(u.uid)}
                        disabled={!canApprove}
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
              Generate a pre-approved invite link. The recipient will create their account with role and jurisdiction already bound, no waiting.
            </p>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
              <select
                value={invRole}
                onChange={e => { setInvRole(e.target.value as UserRole); setInvLink(''); setInvMilitary(false); }}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
              >
                {availableRoles.map(r => (
                  <option key={r} value={r}>{r}{isOperatorRole(r) ? ' (operator)' : ''}</option>
                ))}
              </select>
            </div>

            {/* Military checkbox for Federal */}
            {invNeedsMilitary && (
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={invMilitary}
                  onChange={e => { setInvMilitary(e.target.checked); setInvLink(''); }}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-200"
                />
                <span className="text-sm text-slate-700">Military installation</span>
              </label>
            )}

            {/* Email (optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Recipient Email <span className="text-slate-400 font-normal">(optional, locks invite to this email)</span>
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
            {invNeedsOrg && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {invRole === 'K12' ? 'School / District' : 'Organization'}
                </label>
                <input
                  type="text"
                  value={invOrg}
                  onChange={e => { setInvOrg(e.target.value); setInvLink(''); }}
                  placeholder={invRole === 'K12' ? 'e.g. Chesapeake Bay Academy' : 'e.g. Anne Arundel County DPW'}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                />
              </div>
            )}

            {/* State */}
            {invNeedsState && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">State</label>
                <select
                  value={invState}
                  onChange={e => { setInvState(e.target.value); setInvParentCounty(''); setInvJurisdiction(''); setInvLink(''); }}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  disabled={!!scopeFilter?.lockedState}
                >
                  <option value="">Select state...</option>
                  {ALL_US_STATES.map(s => <option key={s.abbr} value={s.abbr}>{s.name} ({s.abbr})</option>)}
                </select>
              </div>
            )}

            {/* Local Jurisdiction — two-step county → municipality drilldown */}
            {invNeedsJurisdiction && invState && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Local Jurisdiction — County</label>
                  <select
                    value={invParentCounty}
                    onChange={e => {
                      const countyId = e.target.value;
                      setInvParentCounty(countyId);
                      // If county has no children, set jurisdiction directly
                      if (countyId && !hasChildJurisdictions(countyId)) {
                        setInvJurisdiction(countyId);
                      } else {
                        setInvJurisdiction(countyId);
                      }
                      setInvLink('');
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                    disabled={!!scopeFilter?.lockedJurisdiction}
                  >
                    <option value="">None (bind later)</option>
                    {invCountiesForState.map(j => (
                      <option key={j.jurisdiction_id} value={j.jurisdiction_id}>{j.jurisdiction_name}</option>
                    ))}
                  </select>
                </div>
                {invParentCounty && invChildJurisdictions.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Local Jurisdiction — Municipality</label>
                    <select
                      value={invJurisdiction}
                      onChange={e => { setInvJurisdiction(e.target.value); setInvLink(''); }}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                      disabled={!!scopeFilter?.lockedJurisdiction}
                    >
                      <option value={invParentCounty}>
                        {getJurisdictionById(invParentCounty)?.jurisdiction_name} (entire county)
                      </option>
                      {invChildJurisdictions.map(j => (
                        <option key={j.jurisdiction_id} value={j.jurisdiction_id}>{j.jurisdiction_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
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
                  {invMilitary && ' (Military)'}
                  {invJurisdiction && ` | Jurisdiction: ${getJurisdictionDisplayLabel(invJurisdiction)}`}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="font-semibold">{pendingCount}</span> pending requests
              </div>
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                <span className="font-semibold">{activeExplorerCount}</span> active explorer/public users
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <span className="font-semibold">{activeOperatorCount}</span> active operator users
              </div>
            </div>

            {pendingCount > 0 && (
              <button
                onClick={() => setTab('pending')}
                className="w-full text-left rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 hover:bg-amber-100 transition-colors"
              >
                {pendingCount} account request{pendingCount !== 1 ? 's' : ''} waiting for approval. Click to open Pending Approvals.
              </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
              <div className="md:col-span-2">
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Search Name</label>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Type letters in the user's name..."
                    className={`${inputClass} pl-8`}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Sort By</label>
                <select
                  value={userSortBy}
                  onChange={(e) => setUserSortBy(e.target.value as 'name' | 'role' | 'state' | 'admin' | 'status')}
                  className={selectClass}
                >
                  <option value="name">Name</option>
                  <option value="role">Role</option>
                  <option value="state">State</option>
                  <option value="admin">Admin Level</option>
                  <option value="status">Status</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Direction</label>
                <select
                  value={userSortDir}
                  onChange={(e) => setUserSortDir(e.target.value as 'asc' | 'desc')}
                  className={selectClass}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-sm text-slate-400">Loading...</div>
            ) : visibleUsers.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">No users match this search.</div>
            ) : (
              visibleUsers
                .map(u => {
                  const sb = STATUS_BADGE[u.status] || STATUS_BADGE.active;
                  const isCurrentUser = u.uid === user?.uid;
                  const isBusy = actionBusyUid === u.uid;
                  const canBlock = !isCurrentUser && u.status !== 'pending';
                  const blockLabel = u.status === 'deactivated' ? 'Unblock' : 'Block';
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 truncate">{u.name}</span>
                          <AdminBadge level={u.adminLevel} isMilitary={u.isMilitary} />
                          {isCurrentUser && <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 text-[9px] px-1.5">YOU</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>{u.email}</span>
                          <span>|</span>
                          <span>{u.role}</span>
                          {u.state && (
                            <>
                              <span>|</span>
                              <span>{u.state}</span>
                            </>
                          )}
                          {u.ms4Jurisdiction && (
                            <>
                              <span>|</span>
                              <span className="text-cyan-600">{getJurisdictionDisplayLabel(u.ms4Jurisdiction)}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="secondary"
                            className={`text-[9px] px-1.5 ${accessType(u.role) === 'explorer' ? 'bg-cyan-100 text-cyan-700' : 'bg-blue-100 text-blue-700'}`}
                          >
                            {accessType(u.role) === 'explorer' ? 'Explorer/Public' : 'Operator'}
                          </Badge>
                          <span className="text-[10px] text-slate-500">{accessScopeSummary(u)}</span>
                        </div>
                      </div>

                      {/* Status + actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="secondary" className={`${sb.bg} ${sb.text} text-[10px]`}>{sb.label}</Badge>

                        {/* Grant/Revoke Role Admin — super_admin only */}
                        {user?.isSuperAdmin && !isCurrentUser && u.adminLevel !== 'super_admin' && u.status === 'active' && (
                          <button
                            onClick={() => handleToggleRoleAdmin(u)}
                            disabled={isBusy}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                              u.adminLevel === 'role_admin'
                                ? 'text-blue-600 border-blue-200 hover:bg-blue-50'
                                : 'text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                            title={u.adminLevel === 'role_admin' ? 'Revoke role admin' : 'Grant role admin'}
                          >
                            <Shield className="inline h-3 w-3 mr-0.5" />
                            {u.adminLevel === 'role_admin' ? 'Revoke Admin' : 'Make Admin'}
                          </button>
                        )}

                        {canBlock && (
                          <button
                            onClick={() => handleToggleBlock(u)}
                            disabled={isBusy}
                            className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 disabled:opacity-50 transition-colors"
                            title={blockLabel}
                          >
                            {blockLabel}
                          </button>
                        )}
                        {u.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(u.uid)}
                              disabled={isBusy}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleReject(u.uid)}
                              disabled={isBusy}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              title="Reject"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {!isCurrentUser && user?.isSuperAdmin && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={isBusy}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Delete user"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
