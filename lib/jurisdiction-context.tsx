'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import {
  type JurisdictionScope,
  getAssignedJurisdictions,
  getJurisdictionById,
  getJurisdictionsForState,
} from '@/lib/jurisdictions/index';

type JurisdictionContextValue = {
  activeJurisdiction: JurisdictionScope | null;
  roleDefaultJurisdiction: JurisdictionScope | null;
  overrideJurisdiction: JurisdictionScope | null;
  availableJurisdictions: JurisdictionScope[];
  canOverride: boolean;
  setJurisdictionOverride: (jurisdictionId: string | null) => void;
  clearJurisdictionOverride: () => void;
};

const SESSION_KEY = 'pin.jurisdiction.override';

const JurisdictionContext = createContext<JurisdictionContextValue | null>(null);

export function useJurisdictionContext(): JurisdictionContextValue {
  const ctx = useContext(JurisdictionContext);
  if (!ctx) throw new Error('useJurisdictionContext must be used within JurisdictionProvider');
  return ctx;
}

export function JurisdictionProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const fromSession = sessionStorage.getItem(SESSION_KEY);
      setOverrideId(fromSession || null);
    } catch {
      setOverrideId(null);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const roleAssignments = useMemo(() => getAssignedJurisdictions(user), [user]);
  const roleDefaultJurisdiction = roleAssignments[0] || null;
  const overrideJurisdiction = useMemo(() => getJurisdictionById(overrideId), [overrideId]);

  const canOverride = !!(isAdmin || user?.role === 'Pearl' || roleAssignments.length > 1);

  const availableJurisdictions = useMemo(() => {
    if (isAdmin || user?.role === 'Pearl') {
      return getJurisdictionsForState(user?.state || null);
    }
    if (roleAssignments.length > 0) return roleAssignments;
    return [];
  }, [isAdmin, roleAssignments, user?.role, user?.state]);

  const activeJurisdiction = overrideJurisdiction || roleDefaultJurisdiction || null;

  const setJurisdictionOverride = (jurisdictionId: string | null) => {
    const next = jurisdictionId || null;
    setOverrideId(next);
    try {
      if (next) sessionStorage.setItem(SESSION_KEY, next);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // No-op in restricted environments.
    }
  };

  const clearJurisdictionOverride = () => setJurisdictionOverride(null);

  const value: JurisdictionContextValue = {
    activeJurisdiction: isHydrated ? activeJurisdiction : null,
    roleDefaultJurisdiction,
    overrideJurisdiction,
    availableJurisdictions,
    canOverride,
    setJurisdictionOverride,
    clearJurisdictionOverride,
  };

  return <JurisdictionContext.Provider value={value}>{children}</JurisdictionContext.Provider>;
}

