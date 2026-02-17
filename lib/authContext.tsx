'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  PearlUser, UserRole, AccountStatus, InvitePayload,
  isOperatorRole, checkIsAdmin, ADMIN_EMAILS,
} from './authTypes';

// ─── Context shape ──────────────────────────────────────────────────────────

interface AuthContextType {
  user: PearlUser | null;
  loading: boolean;
  isAdmin: boolean;
  error: string | null;

  // ── Backward-compatible aliases (used by existing login page) ──
  isAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;

  // Auth actions — login returns synchronous boolean for backward compat
  login: (email: string, password: string) => boolean;
  loginAsync: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (params: SignupParams) => Promise<{ success: boolean; error?: string; user?: PearlUser }>;
  logout: () => void;
  clearError: () => void;

  // Admin actions
  approveUser: (uid: string, jurisdiction?: string) => Promise<void>;
  rejectUser: (uid: string) => Promise<void>;
  deactivateUser: (uid: string) => Promise<void>;
  updateUserRole: (uid: string, role: UserRole, jurisdiction?: string) => Promise<void>;
  createInviteLink: (params: CreateInviteParams) => Promise<string>;
  listPendingUsers: () => Promise<PearlUser[]>;
  listAllUsers: () => Promise<PearlUser[]>;

  // Invite token
  resolveInviteToken: (token: string) => Promise<InvitePayload | null>;
}

interface SignupParams {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  organization?: string;
  state?: string;
  requestedJurisdiction?: string;  // Self-serve operator — what they want
  inviteToken?: string;             // Invite path — pre-approved
}

interface CreateInviteParams {
  role: UserRole;
  email?: string;
  jurisdiction?: string;
  state?: string;
  organization?: string;
  expiresInDays?: number;          // default 7
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pearl_user';
const USERS_KEY = 'pearl_users';
const INVITES_KEY = 'pearl_invites';

/** Simple base64url encode/decode for invite tokens (replace with JWT in production) */
function encodeToken(payload: InvitePayload): string {
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeToken(token: string): InvitePayload | null {
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded));
  } catch { return null; }
}

/** Get all users from localStorage (dev mode) */
function getStoredUsers(): PearlUser[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
  catch { return []; }
}
function setStoredUsers(users: PearlUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function getStoredInvites(): (InvitePayload & { token: string })[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(INVITES_KEY) || '[]'); }
  catch { return []; }
}
function setStoredInvites(invites: (InvitePayload & { token: string })[]) {
  localStorage.setItem(INVITES_KEY, JSON.stringify(invites));
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PearlUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PearlUser;
        // Ensure isAdmin is current (in case emails list changed)
        parsed.isAdmin = checkIsAdmin(parsed.email);
        setUser(parsed);
      }
    } catch { /* no stored user */ }
    setLoading(false);
  }, []);

  // Persist user changes
  const persistUser = useCallback((u: PearlUser | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // ── Seed demo + admin accounts — versioned migration ──
  useEffect(() => {
    const SEED_VERSION = 'pearl_seed_v2'; // bump to force reseed
    const seeded = typeof window !== 'undefined' && localStorage.getItem(SEED_VERSION);
    if (seeded) return;

    const now = new Date().toISOString();
    const seed: PearlUser[] = [
      // ── Admin accounts (real team) ──
      { uid: 'admin-001', email: 'doug@project-pearl.org', name: 'Doug', role: 'MS4', organization: 'Local Seafood Projects Inc.', state: 'MD', ms4Jurisdiction: 'anne_arundel_county', status: 'active', isAdmin: true, createdAt: now },
      { uid: 'admin-002', email: 'steve@project-pearl.org', name: 'Steve Warrick', role: 'Federal', organization: 'Local Seafood Projects Inc.', state: 'MD', status: 'active', isAdmin: true, createdAt: now },
      { uid: 'admin-003', email: 'gwen@project-pearl.org', name: 'Gwen James', role: 'Corporate', organization: 'Local Seafood Projects Inc.', state: 'MD', status: 'active', isAdmin: true, createdAt: now },
      // ── Demo accounts (match existing login page) ──
      { uid: 'demo-federal', email: 'demo-federal@pearl.gov', name: 'Federal Demo', role: 'Federal', organization: 'EPA Region 3', state: 'DC', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-state-md', email: 'demo-state@pearl.gov', name: 'State Demo (MD)', role: 'State', organization: 'MDE', state: 'MD', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-state-va', email: 'demo-state-va@pearl.gov', name: 'State Demo (VA)', role: 'State', organization: 'DEQ Virginia', state: 'VA', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-state-fl', email: 'demo-state-fl@pearl.gov', name: 'State Demo (FL)', role: 'State', organization: 'FDEP', state: 'FL', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-state-pa', email: 'demo-state-pa@pearl.gov', name: 'State Demo (PA)', role: 'State', organization: 'PA DEP', state: 'PA', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-ms4-md', email: 'demo-ms4@pearl.gov', name: 'MS4 Demo (MD)', role: 'MS4', organization: 'Anne Arundel County DPW', state: 'MD', region: 'maryland_middle_branch', ms4Jurisdiction: 'anne_arundel_county', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-ms4-balt', email: 'demo-ms4-balt@pearl.gov', name: 'MS4 Demo (Baltimore)', role: 'MS4', organization: 'Baltimore County DPW', state: 'MD', region: 'maryland_back_river', ms4Jurisdiction: 'baltimore_county', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-ms4-norfolk', email: 'demo-ms4-norfolk@pearl.gov', name: 'MS4 Demo (Norfolk)', role: 'MS4', organization: 'City of Norfolk', state: 'VA', region: 'virginia_elizabeth_river', ms4Jurisdiction: 'norfolk_city', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-corporate', email: 'demo-corporate@pearl.io', name: 'Corporate Demo', role: 'Corporate', organization: 'Chesapeake Utilities', state: 'MD', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-researcher', email: 'demo-researcher@pearl.edu', name: 'Researcher Demo', role: 'Researcher', organization: 'UMCES', state: 'MD', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-college', email: 'demo-college@pearl.edu', name: 'College Demo', role: 'College', organization: 'Towson University', state: 'MD', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-ngo', email: 'demo-ngo@pearl.org', name: 'NGO Demo', role: 'NGO', organization: 'Chesapeake Bay Foundation', state: 'MD', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-k12', email: 'demo-k12@pearl.org', name: 'K12 Demo', role: 'K12', organization: 'AACPS', state: 'MD', status: 'active', isAdmin: false, createdAt: now },
      { uid: 'demo-public', email: 'demo-public@pearl.org', name: 'Public Demo', role: 'Public', state: 'MD', status: 'active', isAdmin: false, createdAt: now },
    ];
    // Merge: keep any user-created accounts, upsert seed by uid
    const existing = getStoredUsers();
    const seedUids = new Set(seed.map(s => s.uid));
    const preserved = existing.filter(u => !seedUids.has(u.uid));
    setStoredUsers([...seed, ...preserved]);
    localStorage.setItem(SEED_VERSION, '1');
  }, []);

  // ── Login (synchronous — backward compat with existing login page) ──
  const login = useCallback((email: string, _password: string): boolean => {
    setError(null);
    const users = getStoredUsers();
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!found) { setError('No account found with that email. Please sign up.'); return false; }
    if (found.status === 'pending') { setError('Your account is awaiting admin approval. You\'ll receive an email when approved.'); return false; }
    if (found.status === 'rejected') { setError('Your access request was not approved. Contact info@project-pearl.org.'); return false; }
    if (found.status === 'deactivated') { setError('This account has been deactivated. Contact info@project-pearl.org.'); return false; }

    // Update last login
    found.lastLoginAt = new Date().toISOString();
    found.isAdmin = checkIsAdmin(found.email);
    setStoredUsers(users.map(u => u.uid === found.uid ? found : u));
    persistUser(found);
    return true;
  }, [persistUser]);

  // ── Login async (for new AuthForms component) ──
  const loginAsync = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const success = login(email, password);
    return success ? { success: true } : { success: false, error: error || 'Login failed' };
  }, [login, error]);

  // ── Signup ──
  const signup = useCallback(async (params: SignupParams): Promise<{ success: boolean; error?: string; user?: PearlUser }> => {
    setError(null);
    const users = getStoredUsers();
    const existing = users.find(u => u.email.toLowerCase() === params.email.toLowerCase().trim());
    if (existing) { const msg = 'An account with this email already exists. Please sign in.'; setError(msg); return { success: false, error: msg }; }

    // Determine status based on role + invite
    let status: AccountStatus = 'active';
    let jurisdiction: string | undefined;
    let state: string | undefined = params.state;
    let org: string | undefined = params.organization;
    let invitedBy: string | undefined;

    if (params.inviteToken) {
      // Invite path — pre-approved
      const payload = decodeToken(params.inviteToken);
      if (!payload) { const msg = 'Invalid invite link. Please request a new one.'; setError(msg); return { success: false, error: msg }; }
      if (new Date(payload.expiresAt) < new Date()) { const msg = 'This invite link has expired. Please request a new one.'; setError(msg); return { success: false, error: msg }; }
      if (payload.email && payload.email.toLowerCase() !== params.email.toLowerCase()) {
        const msg = `This invite was sent to ${payload.email}. Please use that email address.`; setError(msg);
        return { success: false, error: msg };
      }
      status = 'active';
      jurisdiction = payload.jurisdiction;
      state = payload.state || state;
      org = payload.organization || org;
      invitedBy = payload.invitedBy;
    } else if (isOperatorRole(params.role)) {
      // Self-serve operator — pending approval
      status = 'pending';
      jurisdiction = undefined; // Admin will bind this
    }
    // Explorer roles → instant active

    const newUser: PearlUser = {
      uid: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email: params.email.trim(),
      name: params.name.trim(),
      role: params.role,
      organization: org,
      state,
      ms4Jurisdiction: jurisdiction,
      status,
      isAdmin: checkIsAdmin(params.email),
      createdAt: new Date().toISOString(),
      inviteToken: params.inviteToken,
      invitedBy,
    };

    setStoredUsers([...users, newUser]);

    if (status === 'active') {
      persistUser(newUser);
    }

    return { success: true, user: newUser };
  }, [persistUser]);

  // ── Logout ──
  const logout = useCallback(() => {
    setError(null);
    persistUser(null);
  }, [persistUser]);

  // ── Admin: Approve ──
  const approveUser = useCallback(async (uid: string, jurisdiction?: string) => {
    if (!user?.isAdmin) return;
    const users = getStoredUsers();
    const target = users.find(u => u.uid === uid);
    if (!target) return;
    target.status = 'active';
    target.approvedBy = user.uid;
    target.approvedAt = new Date().toISOString();
    if (jurisdiction) target.ms4Jurisdiction = jurisdiction;
    setStoredUsers(users);
  }, [user]);

  // ── Admin: Reject ──
  const rejectUser = useCallback(async (uid: string) => {
    if (!user?.isAdmin) return;
    const users = getStoredUsers();
    setStoredUsers(users.map(u => u.uid === uid ? { ...u, status: 'rejected' as const } : u));
  }, [user]);

  // ── Admin: Deactivate ──
  const deactivateUser = useCallback(async (uid: string) => {
    if (!user?.isAdmin) return;
    const users = getStoredUsers();
    setStoredUsers(users.map(u => u.uid === uid ? { ...u, status: 'deactivated' as const } : u));
  }, [user]);

  // ── Admin: Update role ──
  const updateUserRole = useCallback(async (uid: string, role: UserRole, jurisdiction?: string) => {
    if (!user?.isAdmin) return;
    const users = getStoredUsers();
    setStoredUsers(users.map(u => u.uid === uid ? { ...u, role, ms4Jurisdiction: jurisdiction ?? u.ms4Jurisdiction } : u));
  }, [user]);

  // ── Admin: Create invite link ──
  const createInviteLink = useCallback(async (params: CreateInviteParams): Promise<string> => {
    if (!user?.isAdmin) throw new Error('Not authorized');
    const payload: InvitePayload = {
      role: params.role,
      jurisdiction: params.jurisdiction,
      state: params.state,
      organization: params.organization,
      email: params.email,
      invitedBy: user.uid,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (params.expiresInDays || 7) * 86400000).toISOString(),
    };
    const token = encodeToken(payload);
    // Store for audit trail
    const invites = getStoredInvites();
    invites.push({ ...payload, token });
    setStoredInvites(invites);
    // Build URL
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://project-pearl.org';
    return `${base}/invite?token=${token}`;
  }, [user]);

  // ── Admin: List pending ──
  const listPendingUsers = useCallback(async (): Promise<PearlUser[]> => {
    return getStoredUsers().filter(u => u.status === 'pending');
  }, []);

  // ── Admin: List all ──
  const listAllUsers = useCallback(async (): Promise<PearlUser[]> => {
    return getStoredUsers();
  }, []);

  // ── Resolve invite token ──
  const resolveInviteToken = useCallback(async (token: string): Promise<InvitePayload | null> => {
    return decodeToken(token);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAdmin: user?.isAdmin ?? false,
      error,
      // ── Backward-compatible aliases ──
      isAuthenticated: !!user && user.status === 'active',
      isLoading: loading,
      loginError: error,
      // ── Actions ──
      login,
      loginAsync,
      signup,
      logout,
      clearError,
      approveUser,
      rejectUser,
      deactivateUser,
      updateUserRole,
      createInviteLink,
      listPendingUsers,
      listAllUsers,
      resolveInviteToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
