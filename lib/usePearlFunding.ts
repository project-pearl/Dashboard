'use client';

import { useState, useEffect } from 'react';

export interface PearlGrant {
  name: string;
  fit: number;
  eligible: string | null;
  opens: string | null;
  closes: string | null;
  notes: string;
  source: string;
  coSponsor: string | null;
  website?: string;
}

export interface PearlFunder {
  name: string;
  website: string | null;
  fit: number;
  source: string;
  prospect: string;
  notes: string;
}

interface PearlFundingData {
  grants: PearlGrant[];
  funders: PearlFunder[];
  loading: boolean;
}

let _cache: { grants: PearlGrant[]; funders: PearlFunder[] } | null = null;

export function usePearlFunding(): PearlFundingData {
  const [data, setData] = useState<{ grants: PearlGrant[]; funders: PearlFunder[] } | null>(_cache);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) return;
    fetch('/data/pearl-funding.json')
      .then((r) => r.json())
      .then((d) => {
        _cache = { grants: d.grants || [], funders: d.funders || [] };
        setData(_cache);
      })
      .catch(() => {
        setData({ grants: [], funders: [] });
      })
      .finally(() => setLoading(false));
  }, []);

  return {
    grants: data?.grants ?? [],
    funders: data?.funders ?? [],
    loading,
  };
}
