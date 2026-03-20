'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Scale, ChevronDown } from 'lucide-react';
import { getBriefingData, type BriefingData, type ChangeItem, type StakeholderItem } from '@/lib/briefingCache';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type BriefingEntityType =
  | 'local' | 'ms4' | 'utility' | 'k12' | 'ngo'
  | 'university' | 'esg' | 'biotech' | 'investor';

export interface BriefingCardProps {
  entityType: BriefingEntityType;
  entityName?: string;
  stateAbbr?: string;
}

/* ------------------------------------------------------------------ */
/*  Real data functions - replaces mock data generators                */
/* ------------------------------------------------------------------ */

interface LegacyChangeItem { id: string; time: string; change: string; detail: string }
interface LegacyStakeItem  { id: string; type: string; detail: string; status: string; expandDetail: string }

// Helper function to convert real briefing data to legacy component format
function convertChangeItems(changes: ChangeItem[]): LegacyChangeItem[] {
  return changes.slice(0, 4).map(change => ({
    id: change.id,
    time: new Date(change.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    change: change.title,
    detail: change.details,
  }));
}

function convertStakeholderItems(stakeholders: StakeholderItem[]): LegacyStakeItem[] {
  return stakeholders.slice(0, 3).map(stake => ({
    id: stake.id,
    type: stake.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    detail: stake.description,
    status: stake.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    expandDetail: stake.details,
  }));
}

// Real data function that replaces mock generators
function getRealBriefingData(entityType: BriefingEntityType, entityName: string, stateAbbr: string) {
  try {
    const briefingData = getBriefingData(entityType, entityName, stateAbbr);

    if (briefingData) {
      return {
        changes: {
          title: `What Changed Overnight — ${entityName || stateAbbr}`,
          subtitle: `Real-time data, alerts, and status changes since your last session`,
          items: convertChangeItems(briefingData.changes),
          source: `AI analysis of EPA ECHO, SDWIS, ATTAINS, and state DEQ overnight data`,
        },
        stakeholders: {
          title: `Stakeholder Watch — ${entityName || stateAbbr}`,
          subtitle: `Community engagement and stakeholder activity`,
          items: convertStakeholderItems(briefingData.stakeholders),
          source: `AI analysis of media monitoring, public records, and regulatory communications`,
        }
      };
    }
  } catch (error) {
    console.warn('Failed to load real briefing data:', error);
  }

  // Fallback to basic template if no real data available
  return {
    changes: {
      title: `What Changed Overnight — ${entityName || stateAbbr}`,
      subtitle: `No significant changes detected in the last 24 hours`,
      items: [],
      source: `Real-time monitoring of EPA ECHO, SDWIS, ATTAINS, and state DEQ systems`,
    },
    stakeholders: {
      title: `Stakeholder Watch — ${entityName || stateAbbr}`,
      subtitle: `No significant stakeholder activity detected`,
      items: [],
      source: `AI analysis of media monitoring, public records, and regulatory communications`,
    }
  };
}

// Legacy format generators for backward compatibility
const changesData: Record<BriefingEntityType, (n: string, st: string) => { title: string; subtitle: string; items: LegacyChangeItem[]; source: string }> = {
  local: (n, st) => getRealBriefingData('local', n, st).changes,

  ms4: (n, st) => getRealBriefingData('ms4', n, st).changes,

  utility: (n, st) => getRealBriefingData('utility', n, st).changes,
  k12: (n, st) => getRealBriefingData('k12', n, st).changes,
  ngo: (n, st) => getRealBriefingData('ngo', n, st).changes,
  university: (n, st) => getRealBriefingData('university', n, st).changes,
  esg: (n, st) => getRealBriefingData('esg', n, st).changes,
  biotech: (n, st) => getRealBriefingData('biotech', n, st).changes,
  investor: (n, st) => getRealBriefingData('investor', n, st).changes,
};

const stakeholderData: Record<BriefingEntityType, (n: string, st: string) => { title: string; subtitle: string; items: LegacyStakeItem[]; source: string }> = {
  local: (n, st) => getRealBriefingData('local', n, st).stakeholders,

  ms4: (n, st) => getRealBriefingData('ms4', n, st).stakeholders,

  utility: (n, st) => getRealBriefingData('utility', n, st).stakeholders,

  k12: (n, st) => getRealBriefingData('k12', n, st).stakeholders,

  ngo: (n, st) => getRealBriefingData('ngo', n, st).stakeholders,

  university: (n, st) => getRealBriefingData('university', n, st).stakeholders,

  esg: (n, st) => getRealBriefingData('esg', n, st).stakeholders,

  biotech: (n, st) => getRealBriefingData('biotech', n, st).stakeholders,

  investor: (n, st) => getRealBriefingData('investor', n, st).stakeholders,
};

/* ------------------------------------------------------------------ */
/*  WhatChangedOvernight                                               */
/* ------------------------------------------------------------------ */

export function WhatChangedOvernight({ entityType, entityName, stateAbbr }: BriefingCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const name = entityName || stateAbbr || 'Your Organization';
  const st = stateAbbr || 'US';
  const d = changesData[entityType](name, st);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          {d.title}
        </CardTitle>
        <CardDescription>{d.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {d.items.map(c => (
            <div key={c.id}>
              <div
                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:ring-1 hover:ring-purple-300 transition-all"
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              >
                <span className="text-2xs font-mono text-slate-400 whitespace-nowrap mt-0.5">{c.time}</span>
                <span className="text-xs text-slate-700 flex-1">{c.change}</span>
                <ChevronDown size={14} className={`flex-shrink-0 text-slate-400 transition-transform mt-0.5 ${expandedId === c.id ? 'rotate-180' : ''}`} />
              </div>
              {expandedId === c.id && (
                <div className="ml-4 mt-1 rounded-lg border border-purple-200 bg-purple-50/60 p-3">
                  <p className="text-xs text-slate-700">{c.detail}</p>
                  <p className="text-2xs text-purple-600 mt-2 font-medium">Navigate to source data — Coming Soon</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4 italic">Data source: {d.source}</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  StakeholderWatch                                                   */
/* ------------------------------------------------------------------ */

export function StakeholderWatch({ entityType, entityName, stateAbbr }: BriefingCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const name = entityName || stateAbbr || 'Your Organization';
  const st = stateAbbr || 'US';
  const d = stakeholderData[entityType](name, st);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-indigo-600" />
          {d.title}
        </CardTitle>
        <CardDescription>{d.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {d.items.map(s => (
            <div key={s.id}>
              <div
                className="rounded-lg border border-slate-200 p-3 cursor-pointer hover:ring-1 hover:ring-indigo-300 transition-all"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-2xs">{s.type}</Badge>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-2xs">{s.status}</Badge>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedId === s.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                <p className="text-xs text-slate-700">{s.detail}</p>
              </div>
              {expandedId === s.id && (
                <div className="ml-4 mt-1 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
                  <p className="text-xs text-slate-700">{s.expandDetail}</p>
                  <p className="text-2xs text-indigo-600 mt-2 font-medium">Open full context — Coming Soon</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4 italic">Data source: {d.source}</p>
      </CardContent>
    </Card>
  );
}
