'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Role Defaults ────────────────────────────────────────────────────────────
// Which cards are EXPANDED by default for each role on first visit.
// Cards not listed default to collapsed.

export type UserRole = 'ms4' | 'state' | 'internal' | 'federal';

const ROLE_DEFAULTS: Record<UserRole, Record<string, boolean>> = {
  ms4: {
    regprofile: true,
    alerts: true,
    map: true,
    detail: true,
    restoration: false,
    ej: false,
    top10: false,
    potomac: false,
    ms4: false,
    provenance: false,
    grants: true,
  },
  state: {
    regprofile: true,
    alerts: true,
    map: true,
    detail: true,
    restoration: true,
    ej: true,
    top10: false,
    potomac: false,
    ms4: true,
    provenance: true,
    grants: false,
  },
  internal: {
    regprofile: true,
    alerts: true,
    map: true,
    detail: true,
    restoration: true,
    ej: false,
    top10: true,
    potomac: false,
    ms4: true,
    provenance: false,
    grants: true,
  },
  federal: {
    regprofile: true,
    alerts: true,
    map: true,
    detail: false,
    restoration: false,
    ej: true,
    top10: true,
    potomac: false,
    ms4: true,
    provenance: true,
    grants: false,
  },
};

// ─── FMC Card Defaults (for FederalManagementCenter) ────────────────────────────

const NCC_ROLE_DEFAULTS: Record<UserRole, Record<string, boolean>> = {
  ms4: {
    tldr: true,
    signals: true,
    map: true,
    stateRollup: true,
    aiInsights: false,
    situation: false,
    networkHealth: false,
    regionBreakdown: false,
  },
  state: {
    tldr: true,
    signals: true,
    map: true,
    stateRollup: true,
    aiInsights: true,
    situation: false,
    networkHealth: false,
    regionBreakdown: false,
  },
  internal: {
    tldr: true,
    signals: true,
    map: true,
    stateRollup: true,
    aiInsights: true,
    situation: true,
    networkHealth: true,
    regionBreakdown: true,
  },
  federal: {
    tldr: true,
    signals: true,
    map: true,
    stateRollup: true,
    aiInsights: true,
    situation: true,
    networkHealth: true,
    regionBreakdown: false,
  },
};

// ─── Storage Key ──────────────────────────────────────────────────────────────

function getStorageKey(scope: string, stateAbbr?: string) {
  return stateAbbr
    ? `pearl-view-${scope}-${stateAbbr}`
    : `pearl-view-${scope}`;
}

// ─── Toast callback type ──────────────────────────────────────────────────────

type ToastCallback = (message: string, onUndo: () => void) => void;

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseUserViewOptions {
  /** 'scc' for StateManagementCenter, 'ncc' for FederalManagementCenter */
  scope: 'scc' | 'ncc';
  /** State abbreviation (for SCC — each state gets its own saved view) */
  stateAbbr?: string;
  /** User role — drives defaults on first visit. Falls back to 'internal'. */
  role?: UserRole;
  /** Optional toast callback for "View saved" with undo */
  onToast?: ToastCallback;
}

interface UseUserViewReturn {
  /** Current card states: true = expanded, false = collapsed */
  cards: Record<string, boolean>;
  /** Toggle a card's expand/collapse state */
  toggleCard: (cardId: string) => void;
  /** Check if a specific card is expanded */
  isExpanded: (cardId: string) => boolean;
  /** Reset to role defaults */
  resetToDefaults: () => void;
  /** Whether the initial load from storage is complete */
  loaded: boolean;
}

export function useUserView({
  scope,
  stateAbbr,
  role = 'internal',
  onToast,
}: UseUserViewOptions): UseUserViewReturn {
  const defaults = scope === 'ncc'
    ? NCC_ROLE_DEFAULTS[role] || NCC_ROLE_DEFAULTS.internal
    : ROLE_DEFAULTS[role] || ROLE_DEFAULTS.internal;

  const [cards, setCards] = useState<Record<string, boolean>>(defaults);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCards = useRef<Record<string, boolean>>(defaults);
  const storageKey = getStorageKey(scope, stateAbbr);

  // ── Load from localStorage on mount ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults so new cards get default state
        const merged = { ...defaults, ...parsed };
        setCards(merged);
        prevCards.current = merged;
      }
    } catch {
      // localStorage unavailable or corrupted — use defaults
    }
    setLoaded(true);
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced save to localStorage ──
  const saveToStorage = useCallback((newCards: Record<string, boolean>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newCards));

        // Fire toast with undo
        if (onToast) {
          const snapshot = { ...prevCards.current };
          onToast('View saved', () => {
            // Undo: restore previous state
            setCards(snapshot);
            localStorage.setItem(storageKey, JSON.stringify(snapshot));
          });
        }

        prevCards.current = { ...newCards };
      } catch {
        // localStorage full or unavailable — silent fail
      }
    }, 2000);
  }, [storageKey, onToast]);

  // ── Toggle ──
  const toggleCard = useCallback((cardId: string) => {
    setCards(prev => {
      const next = { ...prev, [cardId]: !prev[cardId] };
      saveToStorage(next);
      return next;
    });
  }, [saveToStorage]);

  // ── Check expanded ──
  const isExpanded = useCallback((cardId: string) => {
    return cards[cardId] ?? false;
  }, [cards]);

  // ── Reset ──
  const resetToDefaults = useCallback(() => {
    setCards(defaults);
    prevCards.current = { ...defaults };
    try {
      localStorage.setItem(storageKey, JSON.stringify(defaults));
    } catch {}
  }, [defaults, storageKey]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return { cards, toggleCard, isExpanded, loaded, resetToDefaults };
}
