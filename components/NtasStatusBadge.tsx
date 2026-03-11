'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface NtasAdvisory {
  type: 'bulletin' | 'elevated' | 'imminent';
  title: string;
  summary: string;
  issued: string;
  expires: string;
  link: string;
}

interface NtasData {
  status: 'none' | 'bulletin' | 'elevated' | 'imminent';
  advisories: NtasAdvisory[];
  fetchedAt: string;
}

const LEVEL_CONFIG: Record<NtasData['status'], { label: string; color: string; bg: string; border: string; description: string }> = {
  none:     { label: 'No Active Advisory',   color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)', description: 'No current national terrorism advisories are in effect.' },
  bulletin: { label: 'NTAS Bulletin',        color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', description: 'An informational bulletin describing broad trends or specific threats.' },
  elevated: { label: 'Elevated Threat',      color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', description: 'A credible terrorism threat exists against the United States.' },
  imminent: { label: 'Imminent Threat',      color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  description: 'A credible, specific, and impending terrorism threat against the United States.' },
};

export function NtasStatusBadge() {
  const [data, setData] = useState<NtasData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/ntas')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error || !data) {
    const cfg = LEVEL_CONFIG.none;
    return (
      <Card style={{ border: `1px solid ${cfg.border}`, background: cfg.bg }}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Shield size={16} style={{ color: cfg.color }} />
            <span>NTAS Threat Level</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
            <span className="text-sm font-medium" style={{ color: cfg.color }}>
              {error ? 'Unable to Load' : 'Loading...'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const cfg = LEVEL_CONFIG[data.status];
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <Card style={{ border: `1px solid ${cfg.border}`, background: cfg.bg }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Shield size={16} style={{ color: cfg.color }} />
            NTAS Threat Level
          </span>
          {data.advisories.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <Chevron size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: cfg.color }} />
          <span className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{cfg.description}</p>

        {expanded && data.advisories.length > 0 && (
          <div className="space-y-3 pt-2 border-t" style={{ borderColor: cfg.border }}>
            {data.advisories.map((adv, i) => (
              <div key={i} className="space-y-1">
                <div className="text-xs font-semibold" style={{ color: 'var(--text-bright)' }}>{adv.title}</div>
                {adv.summary && (
                  <p className="text-xs line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{adv.summary}</p>
                )}
                <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-dim)' }}>
                  {adv.issued && <span>Issued: {new Date(adv.issued).toLocaleDateString()}</span>}
                  {adv.expires && <span>Expires: {new Date(adv.expires).toLocaleDateString()}</span>}
                  {adv.link && (
                    <a href={adv.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline hover:no-underline" style={{ color: cfg.color }}>
                      DHS Details <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-[10px] text-right" style={{ color: 'var(--text-dim)' }}>
          Updated: {new Date(data.fetchedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
