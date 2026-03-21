'use client';

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/lib/authContext';
import { STATE_NAMES, normalizeStateAbbr } from '@/lib/mapUtils';

/** Shared abbreviation→name map (re-exported so FederalManagementCenter etc. don't duplicate it) */
export const STATE_ABBR_TO_NAME = STATE_NAMES;

const STORAGE_KEY = 'pearl:adminState';
const DEFAULT_STATE = 'MD';

interface AdminStateContextType {
  adminState: string;
  setAdminState: (state: string) => void;
}

const AdminStateContext = createContext<AdminStateContextType>({
  adminState: DEFAULT_STATE,
  setAdminState: () => {},
});

export function AdminStateProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();

  const [adminState, setAdminStateRaw] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
      return normalizeStateAbbr(localStorage.getItem(STORAGE_KEY), DEFAULT_STATE);
    } catch {
      return DEFAULT_STATE;
    }
  });

  const setAdminState = useCallback((state: string) => {
    const normalized = normalizeStateAbbr(state, DEFAULT_STATE);
    setAdminStateRaw(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Non-admins always see their profile state (read-only)
  const effectiveState = isAdmin
    ? normalizeStateAbbr(adminState, DEFAULT_STATE)
    : normalizeStateAbbr(user?.state, DEFAULT_STATE);

  return (
    <AdminStateContext.Provider value={{ adminState: effectiveState, setAdminState }}>
      {children}
    </AdminStateContext.Provider>
  );
}

export function useAdminState(): [string, (state: string) => void] {
  const { adminState, setAdminState } = useContext(AdminStateContext);
  return [adminState, setAdminState];
}
