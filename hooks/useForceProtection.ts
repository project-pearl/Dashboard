'use client';

import { useState, useEffect } from 'react';
import type { ForceProtectionAssessment } from '@/lib/forceProtectionCache';

export function useForceProtection() {
  const [data, setData] = useState<ForceProtectionAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/force-protection');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json.assessments || []);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load force protection data');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { data, isLoading, error };
}
