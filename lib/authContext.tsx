'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';
import {
  PearlUser, UserRole, AccountStatus, InvitePayload,
  isOperatorRole, checkIsAdmin, normalizeUserRole,
} from './authTypes';
import type { User } from '@supabase/supabase-js';

// ─── Context shape ──────────────────────────────────────────────────────────

interface AuthContextType {
  user: PearlUser | null;
  loading: boolean;
  isAdmin: boolean;
  error: string | null;

  isAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;

  login: (email: string, password: string) => boolean;
  loginAsync: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: PearlUser }>;
  signup: (params: SignupParams) => Promise<{ success: boolean; error?: string; user?: PearlUser }>;
  logout: () => void;
  clearError: () => void;

  approveUser: (uid: string, overrides?: ApprovalOverrides) => Promise<void>;
  rejectUser: (uid: string) => Promise<void>;
  deactivateUser: (uid: string) => Promise<void>;
  updateUserRole: (uid: string, role: UserRole, jurisdiction?: string) => Promise<void>;
  createInviteLink: (params: CreateInviteParams) => Promise<string>;
  listPendingUsers: () => Promise<PearlUser[]>;
  listAllUsers: () => Promise<PearlUser[]>;
  resolveInviteToken: (token: string) => Promise<InvitePayload | null>;
}

interface SignupParams {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  organization?: string;
  state?: string;
  requestedJurisdiction?: string;
  inviteToken?: string;
  useCase?: string;
}

export interface ApprovalOverrides {
  role?: UserRole;
  state?: string;
  organization?: string;
  ms4Jurisdiction?: string;
}

interface CreateInviteParams {
  role: UserRole;
  email?: string;
  jurisdiction?: string;
  state?: string;
  organization?: string;
  expiresInDays?: number;
}

// ─── Prefetch helper ────────────────────────────────────────────────────────

function triggerPrefetch(role: string, state?: string) {
  const params = new URLSearchParams({ role });
  if (state) params.set('state', state);
  fetch(`/api/prefetch?${params}`).catch(() => {});
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function profileToPearlUser(profile: any, authUser: User): PearlUser {
  return {
    uid: profile.id,
    email: profile.email || authUser.email || '',
    name: profile.name || '',
    role: normalizeUserRole(profile.role),
    organization: profile.organization || '',
    state: profile.state || '',
    region: profile.region || '',
    ms4Jurisdiction: profile.ms4_jurisdiction || '',
    status: (profile.status || 'active') as AccountStatus,
    isAdmin: profile.is_admin || checkIsAdmin(profile.email || authUser.email || ''),
    createdAt: profile.created_at || new Date().toISOString(),
    approvedBy: profile.approved_by || undefined,
    approvedAt: profile.approved_at || undefined,
    lastLoginAt: profile.last_login_at || undefined,
  };
}

async function fetchProfile(userId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    console.warn('Profile fetch error:', error.message);
    return null;
  }
  if (data) {
    const normalizedRole = normalizeUserRole(data.role);
    if (data.role !== normalizedRole) {
      // Self-heal legacy lowercase/variant roles in Supabase profiles.
      supabase
        .from('profiles')
        .update({ role: normalizedRole })
        .eq('id', userId)
        .then(() => {}, () => {});
      data.role = normalizedRole;
    }
  }
  return data;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PearlUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          const profile = await fetchProfile(session.user.id);
          if (profile && mounted) {
            const pearlUser = profileToPearlUser(profile, session.user);
            setUser(pearlUser);
            triggerPrefetch(pearlUser.role, pearlUser.state);
          }
        }
      } catch (err) {
        console.warn('Auth init error:', err);
        if (mounted) setError('Authentication service unavailable. Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (event === 'SIGNED_IN' && session?.user) {
            const profile = await fetchProfile(session.user.id);
            if (profile && mounted) {
              const pearlUser = profileToPearlUser(profile, session.user);
              setUser(pearlUser);
              triggerPrefetch(pearlUser.role, pearlUser.state);
            }
          } else if (event === 'SIGNED_OUT') {
            if (mounted) setUser(null);
          }
        } catch (err) {
          console.warn('Auth state change error:', err);
          if (mounted) setError('Session update failed. Please sign in again.');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Pending → Active auto-detection ──────────────────────────────────────
  // Poll Supabase every 15s while user is pending. When admin approves,
  // status flips to 'active' and the user is admitted without re-login.
  useEffect(() => {
    if (!user || user.status !== 'pending') return;

    let active = true;
    const POLL_MS = 15_000;

    const intervalId = setInterval(async () => {
      if (!active) return;
      try {
        const profile = await fetchProfile(user.uid);
        if (!profile || !active) return;
        const freshStatus = (profile.status || 'pending') as AccountStatus;

        if (freshStatus === 'active') {
          // Admin approved — upgrade session in place
          const { data: { session } } = await supabase.auth.getSession();
          const authUser = session?.user ?? { id: user.uid, email: user.email } as User;
          const pearlUser = profileToPearlUser(profile, authUser);
          setUser(pearlUser);
          setError(null);
          triggerPrefetch(pearlUser.role, pearlUser.state);
          console.log('[Auth] Pending → Active: account approved by admin');
        } else if (freshStatus === 'rejected' || freshStatus === 'deactivated') {
          // Admin rejected — update state so AuthGuard shows deactivated screen
          const { data: { session } } = await supabase.auth.getSession();
          const authUser = session?.user ?? { id: user.uid, email: user.email } as User;
          setUser(profileToPearlUser(profile, authUser));
        }
      } catch {
        // Non-fatal — try again next interval
      }
    }, POLL_MS);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [user?.uid, user?.status]);

  const loginAsync = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) {
        const msg = authError.message === 'Invalid login credentials'
          ? 'Invalid email or password'
          : authError.message;
        setError(msg);
        return { success: false, error: msg };
      }
      if (data.user) {
        const profile = await fetchProfile(data.user.id);
        if (profile) {
          const pearlUser = profileToPearlUser(profile, data.user);
          if (pearlUser.status === 'deactivated' || pearlUser.status === 'rejected') {
            setError('Your account has been deactivated.');
            await supabase.auth.signOut();
            return { success: false, error: 'Account deactivated' };
          }
          // Pending users: keep session alive so AuthGuard can show the
          // pending screen and the polling loop can auto-detect approval.
          setUser(pearlUser);
          if (pearlUser.status === 'active') {
            triggerPrefetch(pearlUser.role, pearlUser.state);
            supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id).then(() => {});
          }
          return { success: true, user: pearlUser };
        }
      }
      setError('Login failed');
      return { success: false, error: 'Login failed' };
    } catch (err: any) {
      const msg = err?.message || 'Authentication request failed. Please try again.';
      console.warn('Login runtime error:', err);
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const login = useCallback((email: string, password: string): boolean => {
    loginAsync(email, password);
    return true;
  }, [loginAsync]);

  const signup = useCallback(async (params: SignupParams) => {
    setError(null);
    const { email, password, name, role, organization, state, requestedJurisdiction, useCase } = params;
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name },
        },
      });

      if (authError) {
        setError(authError.message);
        return { success: false, error: authError.message };
      }

      if (data.user) {
        // All new accounts require admin approval
        const status: AccountStatus = 'pending';
        const isAdmin = checkIsAdmin(email);

        await supabase
          .from('profiles')
          .update({
            name,
            role,
            organization: organization || '',
            state: state || '',
            ms4_jurisdiction: requestedJurisdiction || '',
            status,
            is_admin: isAdmin,
            use_case: useCase || '',
          })
          .eq('id', data.user.id);

        const profile = await fetchProfile(data.user.id);
        const pearlUser = profile ? profileToPearlUser(profile, data.user) : null;

        // Do not auto-login — all accounts start as pending
        return { success: true, user: pearlUser || undefined };
      }

      return { success: false, error: 'Signup failed' };
    } catch (err: any) {
      const msg = err?.message || 'Signup request failed. Please try again.';
      console.warn('Signup runtime error:', err);
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const logout = useCallback(() => {
    supabase.auth.signOut();
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const approveUser = useCallback(async (uid: string, overrides?: ApprovalOverrides) => {
    const updates: any = { status: 'active', approved_at: new Date().toISOString() };
    if (user?.uid) updates.approved_by = user.uid;
    if (overrides?.role) updates.role = overrides.role;
    if (overrides?.state) updates.state = overrides.state;
    if (overrides?.organization) updates.organization = overrides.organization;
    if (overrides?.ms4Jurisdiction) updates.ms4_jurisdiction = overrides.ms4Jurisdiction;
    await supabase.from('profiles').update(updates).eq('id', uid);
  }, [user]);

  const rejectUser = useCallback(async (uid: string) => {
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', uid);
  }, []);

  const deactivateUser = useCallback(async (uid: string) => {
    await supabase.from('profiles').update({ status: 'deactivated' }).eq('id', uid);
  }, []);

  const updateUserRole = useCallback(async (uid: string, role: UserRole, jurisdiction?: string) => {
    const updates: any = { role };
    if (jurisdiction) updates.ms4_jurisdiction = jurisdiction;
    await supabase.from('profiles').update(updates).eq('id', uid);
  }, []);

  const listPendingUsers = useCallback(async (): Promise<PearlUser[]> => {
    const { data } = await supabase.from('profiles').select('*').eq('status', 'pending');
    if (!data) return [];
    return data.map((p: any) => profileToPearlUser(p, { id: p.id, email: p.email } as User));
  }, []);

  const listAllUsers = useCallback(async (): Promise<PearlUser[]> => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!data) return [];
    return data.map((p: any) => profileToPearlUser(p, { id: p.id, email: p.email } as User));
  }, []);

  const createInviteLink = useCallback(async (_params: CreateInviteParams): Promise<string> => {
    return '';
  }, []);

  const resolveInviteToken = useCallback(async (_token: string): Promise<InvitePayload | null> => {
    return null;
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAdmin: user?.isAdmin ?? false,
    error,
    isAuthenticated: !!user,
    isLoading: loading,
    loginError: error,
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
