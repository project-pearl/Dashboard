'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bell, Mail, Shield, ShieldOff, Plus, Trash2, Send,
  CheckCircle, XCircle, AlertTriangle, AlertCircle, Info,
  Clock, RefreshCw, Filter, ChevronRight, ExternalLink, Lock,
} from 'lucide-react';
import type {
  AlertEvent, AlertRecipient, AlertRule, AlertSuppression,
  AlertSeverity, AlertTriggerType,
} from '@/lib/alerts/types';
import { AlertDeepDive } from './AlertDeepDive';
import type { DeepDiveAlert } from './AlertDeepDive';

// ─── Constants ───────────────────────────────────────────────────────────────

type SubTab = 'history' | 'recipients' | 'rules' | 'suppressions' | 'test';

const SEVERITY_COLORS: Record<AlertSeverity, { bg: string; border: string; text: string; icon: typeof AlertCircle }> = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: XCircle },
  warning:  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: AlertTriangle },
  info:     { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: Info },
};

const EPA_REGIONS: Record<string, string[]> = {
  '1': ['CT', 'ME', 'MA', 'NH', 'RI', 'VT'],
  '2': ['NJ', 'NY', 'PR', 'VI'],
  '3': ['DC', 'DE', 'MD', 'PA', 'VA', 'WV'],
  '4': ['AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN'],
  '5': ['IL', 'IN', 'MI', 'MN', 'OH', 'WI'],
  '6': ['AR', 'LA', 'NM', 'OK', 'TX'],
  '7': ['IA', 'KS', 'MO', 'NE'],
  '8': ['CO', 'MT', 'ND', 'SD', 'UT', 'WY'],
  '9': ['AZ', 'CA', 'HI', 'NV', 'AS', 'GU'],
  '10': ['AK', 'ID', 'OR', 'WA'],
};

const STATE_TO_REGION: Record<string, string> = {};
for (const [region, states] of Object.entries(EPA_REGIONS)) {
  for (const st of states) STATE_TO_REGION[st] = region;
}

type DatePreset = 'all' | 'today' | 'week' | 'lastWeek' | 'custom';
type SortOption = 'newest' | 'oldest' | 'region' | 'severity' | 'state';

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const TRIGGER_TYPES: AlertTriggerType[] = ['sentinel', 'usgs', 'delta', 'attains', 'nwss', 'coordination', 'fusion', 'flood_forecast', 'deployment', 'custom'];
const SEVERITIES: AlertSeverity[] = ['critical', 'warning', 'info'];
const OPERATORS = [
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'eq', label: '=' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function AlertsManagementPanel() {
  const [tab, setTab] = useState<SubTab>('history');
  const [loading, setLoading] = useState(true);

  // ── History state ──
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [historyStats, setHistoryStats] = useState({ totalSent: 0, totalSuppressed: 0, totalThrottled: 0, totalErrors: 0, totalLogged: 0, lastDispatchAt: null as string | null });
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [parameterFilter, setParameterFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedEvent, setSelectedEvent] = useState<AlertEvent | null>(null);

  // ── Recipients state ──
  const [recipients, setRecipients] = useState<AlertRecipient[]>([]);
  const [recipientForm, setRecipientForm] = useState({ email: '', name: '', role: 'admin', state: '', triggers: ['sentinel', 'delta', 'attains'] as AlertTriggerType[], severities: ['critical', 'warning'] as AlertSeverity[] });

  // ── Rules state ──
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [ruleForm, setRuleForm] = useState({ name: '', source: '', metric: '', operator: 'gt' as string, value: '', severity: 'warning' as AlertSeverity, triggerType: 'custom' as AlertTriggerType });

  // ── Suppressions state ──
  const [suppressions, setSuppressions] = useState<AlertSuppression[]>([]);
  const [suppressForm, setSuppressForm] = useState({ dedupKey: '', reason: '', expiresAt: '' });

  // ── Throttle stats (live counters for built-in protections) ──
  const [throttleStats, setThrottleStats] = useState<{
    totalTracked: number; sitesInCooldown: number; sitesPending: number;
    sitesRecovered: number; totalThrottled: number; totalSuppressed: number;
    sentThisHour: number; rateLimitCap: number;
  } | null>(null);

  // ── Test state ──
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testSending, setTestSending] = useState(false);

  // ── Feedback state ──
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts/history?limit=100');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setHistoryStats({ totalSent: data.totalSent, totalSuppressed: data.totalSuppressed, totalThrottled: data.totalThrottled || 0, totalErrors: data.totalErrors, totalLogged: data.totalLogged || 0, lastDispatchAt: data.lastDispatchAt });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts/recipients');
      if (res.ok) {
        const data = await res.json();
        setRecipients(data.recipients || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchSuppressions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts/suppress');
      if (res.ok) {
        const data = await res.json();
        setSuppressions(data.suppressions || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchThrottleStats = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/throttle-stats');
      if (res.ok) setThrottleStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (tab === 'history') fetchHistory();
    else if (tab === 'recipients') fetchRecipients();
    else if (tab === 'rules') { fetchRules(); fetchThrottleStats(); }
    else if (tab === 'suppressions') { fetchSuppressions(); fetchThrottleStats(); }
    else setLoading(false);
  }, [tab, fetchHistory, fetchRecipients, fetchRules, fetchSuppressions, fetchThrottleStats]);

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Recipients
  async function handleAddRecipient() {
    if (!recipientForm.email || !recipientForm.name) return;
    try {
      const res = await fetch('/api/alerts/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipientForm),
      });
      if (res.ok) {
        showFeedback('success', `Added ${recipientForm.email}`);
        setRecipientForm({ email: '', name: '', role: 'admin', state: '', triggers: ['sentinel', 'delta', 'attains'], severities: ['critical', 'warning'] });
        fetchRecipients();
      } else {
        const err = await res.json();
        showFeedback('error', err.error || 'Failed to add recipient');
      }
    } catch { showFeedback('error', 'Network error'); }
  }

  async function handleToggleRecipient(email: string, active: boolean) {
    try {
      const res = await fetch('/api/alerts/recipients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, active }),
      });
      if (res.ok) fetchRecipients();
      else showFeedback('error', 'Failed to update recipient');
    } catch { showFeedback('error', 'Network error'); }
  }

  async function handleRemoveRecipient(email: string) {
    try {
      const res = await fetch('/api/alerts/recipients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        showFeedback('success', `Removed ${email}`);
        fetchRecipients();
      } else showFeedback('error', 'Failed to remove recipient');
    } catch { showFeedback('error', 'Network error'); }
  }

  // Rules
  async function handleAddRule() {
    if (!ruleForm.name || !ruleForm.source || !ruleForm.metric || !ruleForm.value) return;
    try {
      const res = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleForm.name,
          triggerType: ruleForm.triggerType,
          condition: { source: ruleForm.source, metric: ruleForm.metric, operator: ruleForm.operator, value: Number(ruleForm.value) },
          severity: ruleForm.severity,
        }),
      });
      if (res.ok) {
        showFeedback('success', `Added rule "${ruleForm.name}"`);
        setRuleForm({ name: '', source: '', metric: '', operator: 'gt', value: '', severity: 'warning', triggerType: 'custom' });
        fetchRules();
      } else {
        const err = await res.json();
        showFeedback('error', err.error || 'Failed to add rule');
      }
    } catch { showFeedback('error', 'Network error'); }
  }

  async function handleDeleteRule(id: string) {
    try {
      const res = await fetch('/api/alerts/rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        showFeedback('success', 'Rule deleted');
        fetchRules();
      } else showFeedback('error', 'Failed to delete rule');
    } catch { showFeedback('error', 'Network error'); }
  }

  // Suppressions
  async function handleAddSuppression() {
    if (!suppressForm.dedupKey || !suppressForm.reason) return;
    try {
      const res = await fetch('/api/alerts/suppress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dedupKey: suppressForm.dedupKey,
          reason: suppressForm.reason,
          expiresAt: suppressForm.expiresAt || null,
        }),
      });
      if (res.ok) {
        showFeedback('success', 'Suppression added');
        setSuppressForm({ dedupKey: '', reason: '', expiresAt: '' });
        fetchSuppressions();
      } else {
        const err = await res.json();
        showFeedback('error', err.error || 'Failed to add suppression');
      }
    } catch { showFeedback('error', 'Network error'); }
  }

  async function handleDeleteSuppression(id: string) {
    try {
      const res = await fetch('/api/alerts/suppress', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        showFeedback('success', 'Suppression removed');
        fetchSuppressions();
      } else showFeedback('error', 'Failed to remove suppression');
    } catch { showFeedback('error', 'Network error'); }
  }

  // Test
  async function handleSendTest() {
    if (!testEmail) return;
    setTestSending(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      if (res.ok) {
        setTestStatus({ type: 'success', message: `Test alert sent to ${testEmail}` });
      } else {
        const err = await res.json();
        setTestStatus({ type: 'error', message: err.error || 'Failed to send test alert' });
      }
    } catch {
      setTestStatus({ type: 'error', message: 'Network error' });
    }
    setTestSending(false);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Convert a deployment AlertEvent into a DeepDiveAlert for the deep-dive panel. */
  function eventToDeepDive(evt: AlertEvent): DeepDiveAlert {
    const m = evt.metadata || {};
    return {
      id: m.pipeline_event_id as string || evt.id,
      deployment_id: evt.entityId,
      deploymentName: evt.entityLabel,
      parameter: (m.parameter as string) || 'unknown',
      value: (m.value as number) ?? 0,
      baseline: (m.baseline as number) ?? 0,
      delta: (m.delta as number) ?? 0,
      unit: (m.unit as string) || '',
      severity: evt.severity,
      status: 'open',
      title: evt.title,
      diagnosis: (m.diagnosis as string) || null,
      recommendation: (m.recommendation as string) || null,
      pipeline_event_id: evt.id,
      created_at: evt.createdAt,
    };
  }

  function extractState(evt: AlertEvent): string | null {
    if (typeof evt.metadata?.state === 'string') return evt.metadata.state;
    if (/^[A-Z]{2}$/.test(evt.entityId)) return evt.entityId;
    const colonMatch = evt.entityId.match(/^([A-Z]{2}):/);
    if (colonMatch) return colonMatch[1];
    const parenMatch = evt.entityLabel.match(/\(([A-Z]{2})\)\s*$/);
    if (parenMatch) return parenMatch[1];
    const commaMatch = evt.entityLabel.match(/,\s*([A-Z]{2})\s*$/);
    if (commaMatch) return commaMatch[1];
    return null;
  }

  function extractParameter(evt: AlertEvent): string | null {
    if (typeof evt.metadata?.parameter === 'string') return evt.metadata.parameter;
    if (Array.isArray(evt.metadata?.spikeParameters) && evt.metadata.spikeParameters.length > 0) {
      return evt.metadata.spikeParameters[0] as string;
    }
    return null;
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const availableStates = (() => {
    const regionStates = regionFilter !== 'all' ? new Set(EPA_REGIONS[regionFilter]) : null;
    const statesInEvents = new Set<string>();
    for (const e of events) {
      const st = extractState(e);
      if (st && (!regionStates || regionStates.has(st))) statesInEvents.add(st);
    }
    return [...statesInEvents].sort();
  })();

  const availableParams = (() => {
    const params = new Set<string>();
    for (const e of events) {
      const p = extractParameter(e);
      if (p) params.add(p);
    }
    return [...params].sort();
  })();

  const filteredEvents = events.filter(e => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    if (regionFilter !== 'all') {
      const st = extractState(e);
      if (!st || !EPA_REGIONS[regionFilter].includes(st)) return false;
    }
    if (stateFilter !== 'all') {
      const st = extractState(e);
      if (st !== stateFilter) return false;
    }
    if (datePreset !== 'all') {
      const created = new Date(e.createdAt);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (datePreset === 'today' && created < startOfDay) return false;
      if (datePreset === 'week') {
        const weekAgo = new Date(startOfDay); weekAgo.setDate(weekAgo.getDate() - 7);
        if (created < weekAgo) return false;
      }
      if (datePreset === 'lastWeek') {
        const weekAgo = new Date(startOfDay); weekAgo.setDate(weekAgo.getDate() - 7);
        const twoWeeksAgo = new Date(startOfDay); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        if (created < twoWeeksAgo || created >= weekAgo) return false;
      }
      if (datePreset === 'custom') {
        if (customDateFrom && created < new Date(customDateFrom)) return false;
        if (customDateTo) {
          const toEnd = new Date(customDateTo); toEnd.setDate(toEnd.getDate() + 1);
          if (created >= toEnd) return false;
        }
      }
    }
    if (parameterFilter !== 'all') {
      const p = extractParameter(e);
      if (p !== parameterFilter) return false;
    }
    return true;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortBy === 'severity') return (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    if (sortBy === 'region') {
      const ra = Number(STATE_TO_REGION[extractState(a) || ''] || 99);
      const rb = Number(STATE_TO_REGION[extractState(b) || ''] || 99);
      return ra - rb || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'state') {
      const sa = extractState(a) || 'ZZ';
      const sb = extractState(b) || 'ZZ';
      return sa.localeCompare(sb) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        {([
          { key: 'history' as const, label: 'History', icon: Clock },
          { key: 'recipients' as const, label: 'Recipients', icon: Mail },
          { key: 'rules' as const, label: 'Rules', icon: Shield },
          { key: 'suppressions' as const, label: 'Suppressions', icon: ShieldOff },
          { key: 'test' as const, label: 'Test', icon: Send },
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
            </button>
          );
        })}
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {feedback.message}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── HISTORY ──────────────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {tab === 'history' && (
        <div className="space-y-3">
          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
              <span className="font-semibold">{historyStats.totalLogged}</span> logged
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <span className="font-semibold">{historyStats.totalSent}</span> sent
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="font-semibold">{historyStats.totalSuppressed}</span> suppressed
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              <span className="font-semibold">{historyStats.totalThrottled}</span> throttled
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <span className="font-semibold">{historyStats.totalErrors}</span> errors
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <Clock className="inline h-3 w-3 mr-1" />
              {historyStats.lastDispatchAt ? new Date(historyStats.lastDispatchAt).toLocaleString() : 'Never'}
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={regionFilter}
                onChange={e => { setRegionFilter(e.target.value); setStateFilter('all'); }}
                className="px-3 py-1 rounded-lg border border-slate-300 text-xs bg-white focus:border-cyan-400 outline-none"
              >
                <option value="all">All Regions</option>
                {Object.entries(EPA_REGIONS).map(([num, states]) => (
                  <option key={num} value={num}>Region {num} — {states.join(', ')}</option>
                ))}
              </select>
              <select
                value={stateFilter}
                onChange={e => setStateFilter(e.target.value)}
                disabled={availableStates.length === 0}
                className="px-3 py-1 rounded-lg border border-slate-300 text-xs bg-white focus:border-cyan-400 outline-none disabled:opacity-40"
              >
                <option value="all">All States</option>
                {availableStates.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              <select
                value={datePreset}
                onChange={e => setDatePreset(e.target.value as DatePreset)}
                className="px-3 py-1 rounded-lg border border-slate-300 text-xs bg-white focus:border-cyan-400 outline-none"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="lastWeek">Last Week</option>
                <option value="custom">Custom Range</option>
              </select>
              {availableParams.length > 0 && (
                <select
                  value={parameterFilter}
                  onChange={e => setParameterFilter(e.target.value)}
                  className="px-3 py-1 rounded-lg border border-slate-300 text-xs bg-white focus:border-cyan-400 outline-none"
                >
                  <option value="all">All Parameters</option>
                  {availableParams.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1 rounded-lg border border-slate-300 text-xs bg-white focus:border-cyan-400 outline-none"
              >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="severity">Sort: Severity</option>
                <option value="region">Sort: Region</option>
                <option value="state">Sort: State</option>
              </select>
              <button onClick={fetchHistory} className="ml-auto flex items-center gap-1.5 text-xs text-cyan-600 hover:text-cyan-700 font-medium transition-colors">
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </div>
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2 pl-5">
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={e => setCustomDateFrom(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-slate-300 text-xs bg-white focus:border-cyan-400 outline-none"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={e => setCustomDateTo(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-slate-300 text-xs bg-white focus:border-cyan-400 outline-none"
                />
              </div>
            )}
            <div className="flex items-center gap-2 pl-5">
              {(['all', 'critical', 'warning', 'info'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    severityFilter === s
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-slate-400">{filteredEvents.length} result{filteredEvents.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Event list */}
          {loading ? (
            <div className="text-center py-8 text-sm text-slate-400">Loading...</div>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">No alerts yet</p>
                <p className="text-xs text-slate-400 mt-1">Alert events will appear here after the first dispatch.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── Deep-dive panel (shown above list when event selected) ── */}
              {selectedEvent && selectedEvent.type === 'deployment' && (
                <div className="mb-3">
                  <AlertDeepDive
                    alert={eventToDeepDive(selectedEvent)}
                    onClose={() => setSelectedEvent(null)}
                    onStatusChange={() => setSelectedEvent(null)}
                  />
                </div>
              )}

              {/* ── Non-deployment detail panel ── */}
              {selectedEvent && selectedEvent.type !== 'deployment' && (
                <Card className="mb-3 border-2 border-slate-300">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{selectedEvent.title}</span>
                          <Badge variant="secondary" className="text-[9px]">{selectedEvent.type}</Badge>
                          <Badge className={`text-[9px] ${SEVERITY_COLORS[selectedEvent.severity].bg} ${SEVERITY_COLORS[selectedEvent.severity].text}`}>
                            {selectedEvent.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{selectedEvent.body}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>{selectedEvent.entityLabel}</span>
                          <span>{new Date(selectedEvent.createdAt).toLocaleString()}</span>
                          <span>{selectedEvent.recipientEmail}</span>
                        </div>
                        {selectedEvent.ruleId && (
                          <div className="text-xs text-slate-500 mt-1">Rule: <span className="font-mono">{selectedEvent.ruleId}</span></div>
                        )}
                      </div>
                      <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600 p-1">
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Event list ── */}
              {sortedEvents.map(evt => {
                const sev = SEVERITY_COLORS[evt.severity] || SEVERITY_COLORS.info;
                const SevIcon = sev.icon;
                const isDeployment = evt.type === 'deployment';
                const isSelected = selectedEvent?.id === evt.id;
                return (
                  <button
                    key={evt.id}
                    onClick={() => setSelectedEvent(isSelected ? null : evt)}
                    className={`w-full text-left rounded-lg border p-3 transition-all ${sev.bg} ${sev.border} ${
                      isSelected ? 'ring-2 ring-slate-400 ring-offset-1' : 'hover:ring-1 hover:ring-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <SevIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${sev.text}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${sev.text}`}>{evt.title}</span>
                          <Badge variant="secondary" className="text-[9px]">{evt.type}</Badge>
                          {evt.sent ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[9px]">Sent</Badge>
                          ) : evt.error === 'log_only' ? (
                            <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 text-[9px]">Logged</Badge>
                          ) : evt.error ? (
                            <Badge variant="secondary" className="bg-red-100 text-red-700 text-[9px]">Error</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{evt.body}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                          <span>{evt.entityLabel}</span>
                          <span>{new Date(evt.createdAt).toLocaleString()}</span>
                          <span>{evt.recipientEmail}</span>
                          {isDeployment && (
                            <span className="flex items-center gap-0.5 text-purple-600 font-medium">
                              <ExternalLink className="h-2.5 w-2.5" /> Deep dive
                            </span>
                          )}
                          {!isDeployment && (
                            <ChevronRight className={`h-3 w-3 ml-auto transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── RECIPIENTS ───────────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {tab === 'recipients' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">{recipients.length} recipient{recipients.length !== 1 ? 's' : ''}</span>
            <button onClick={fetchRecipients} className="flex items-center gap-1.5 text-xs text-cyan-600 hover:text-cyan-700 font-medium transition-colors">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-sm text-slate-400">Loading...</div>
          ) : recipients.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Mail className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">No recipients configured</p>
                <p className="text-xs text-slate-400 mt-1">Add a recipient below to start receiving alerts.</p>
              </CardContent>
            </Card>
          ) : (
            recipients.map(r => (
              <div key={r.email} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                r.active ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-200 bg-slate-50 opacity-60'
              }`}>
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-xs font-bold text-slate-600 flex-shrink-0">
                  {r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{r.name}</span>
                    <Badge variant="secondary" className={`text-[9px] ${r.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-500">{r.email} &middot; {r.role}{r.state ? ` &middot; ${r.state}` : ''}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {r.triggers.map(t => (
                      <Badge key={t} variant="secondary" className="text-[8px] bg-blue-50 text-blue-600">{t}</Badge>
                    ))}
                    {r.severities.map(s => (
                      <Badge key={s} variant="secondary" className={`text-[8px] ${SEVERITY_COLORS[s].bg} ${SEVERITY_COLORS[s].text}`}>{s}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleToggleRecipient(r.email, !r.active)}
                    className={`p-1.5 rounded-lg transition-colors ${r.active ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                    title={r.active ? 'Deactivate' : 'Activate'}
                  >
                    {r.active ? <ShieldOff className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => handleRemoveRecipient(r.email)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Add Recipient Form */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Plus className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">Add Recipient</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                  <input
                    type="email"
                    value={recipientForm.email}
                    onChange={e => setRecipientForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="name@agency.gov"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label>
                  <input
                    type="text"
                    value={recipientForm.name}
                    onChange={e => setRecipientForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
                  <input
                    type="text"
                    value={recipientForm.role}
                    onChange={e => setRecipientForm(f => ({ ...f, role: e.target.value }))}
                    placeholder="admin"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">State</label>
                  <input
                    type="text"
                    value={recipientForm.state}
                    onChange={e => setRecipientForm(f => ({ ...f, state: e.target.value }))}
                    placeholder="MD"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  />
                </div>
              </div>

              {/* Trigger checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Trigger Types</label>
                <div className="flex flex-wrap gap-2">
                  {TRIGGER_TYPES.map(t => (
                    <label key={t} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recipientForm.triggers.includes(t)}
                        onChange={e => {
                          setRecipientForm(f => ({
                            ...f,
                            triggers: e.target.checked ? [...f.triggers, t] : f.triggers.filter(x => x !== t),
                          }));
                        }}
                        className="rounded border-slate-300"
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              {/* Severity checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Severity Filter</label>
                <div className="flex flex-wrap gap-2">
                  {SEVERITIES.map(s => (
                    <label key={s} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recipientForm.severities.includes(s)}
                        onChange={e => {
                          setRecipientForm(f => ({
                            ...f,
                            severities: e.target.checked ? [...f.severities, s] : f.severities.filter(x => x !== s),
                          }));
                        }}
                        className="rounded border-slate-300"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAddRecipient}
                disabled={!recipientForm.email || !recipientForm.name}
                className="w-full py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
              >
                <Plus className="inline h-4 w-4 mr-1" />
                Add Recipient
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── RULES ────────────────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {tab === 'rules' && (
        <div className="space-y-3">
          {/* Built-in Protections */}
          <Card className="border-indigo-200 bg-indigo-50/50">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-800">Built-in Protections</span>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-600 text-[9px]">Always Active</Badge>
              </div>
              <p className="text-[11px] text-indigo-600/70 -mt-1">These engine-level rules run automatically on every dispatch cycle. They cannot be disabled.</p>
              <div className="space-y-1.5">
                {[
                  {
                    name: 'Persistence Confirmation',
                    desc: 'Critical alerts require 2 consecutive sub-threshold readings (~10 min) before firing. Prevents single-sensor glitches from triggering.',
                    severity: 'critical' as AlertSeverity,
                    badge: throttleStats && throttleStats.sitesPending > 0
                      ? { label: `${throttleStats.sitesPending} pending`, color: 'bg-amber-100 text-amber-700' }
                      : null,
                  },
                  {
                    name: 'Site Cooldown (4 hours)',
                    desc: 'After an alert fires for a site + parameter, the same combo is suppressed for 4 hours. Prevents indefinite re-firing.',
                    severity: 'warning' as AlertSeverity,
                    badge: throttleStats && throttleStats.sitesInCooldown > 0
                      ? { label: `${throttleStats.sitesInCooldown} in cooldown`, color: 'bg-red-100 text-red-700' }
                      : null,
                  },
                  {
                    name: 'Recovery Reset',
                    desc: 'When a site returns to normal for 10+ minutes, its cooldown clears so the next breach fires fresh.',
                    severity: 'info' as AlertSeverity,
                    badge: throttleStats && throttleStats.sitesRecovered > 0
                      ? { label: `${throttleStats.sitesRecovered} recovered`, color: 'bg-emerald-100 text-emerald-700' }
                      : null,
                  },
                ].map(rule => {
                  const sev = SEVERITY_COLORS[rule.severity];
                  return (
                    <div key={rule.name} className="flex items-start gap-2.5 rounded-lg border border-indigo-200 bg-white/60 px-3 py-2">
                      <Shield className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${sev.text}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800">{rule.name}</span>
                          <Badge variant="secondary" className={`text-[8px] ${sev.bg} ${sev.text}`}>{rule.severity}</Badge>
                          {rule.badge && (
                            <Badge variant="secondary" className={`text-[8px] ${rule.badge.color}`}>{rule.badge.label}</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{rule.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Custom Rules */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">{rules.length} custom rule{rules.length !== 1 ? 's' : ''}</span>
            <button onClick={fetchRules} className="flex items-center gap-1.5 text-xs text-cyan-600 hover:text-cyan-700 font-medium transition-colors">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-sm text-slate-400">Loading...</div>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Shield className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">No custom rules</p>
                <p className="text-xs text-slate-400 mt-1">Add a rule below to create custom alert conditions.</p>
              </CardContent>
            </Card>
          ) : (
            rules.map(r => {
              const sev = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.info;
              const opLabel = OPERATORS.find(o => o.value === r.condition.operator)?.label || r.condition.operator;
              return (
                <div key={r.id} className={`rounded-lg border p-3 ${sev.bg} ${sev.border}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${sev.text}`}>{r.name}</span>
                        <Badge variant="secondary" className={`text-[9px] ${r.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {r.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant="secondary" className="text-[9px]">{r.triggerType}</Badge>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {r.condition.source}.{r.condition.metric} {opLabel} {r.condition.value}
                      </p>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Created {new Date(r.createdAt).toLocaleDateString()} by {r.createdBy}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(r.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 transition-colors"
                      title="Delete rule"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Add Rule Form */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Plus className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">Add Rule</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label>
                  <input
                    type="text"
                    value={ruleForm.name}
                    onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="High pH Alert"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Trigger Type</label>
                  <select
                    value={ruleForm.triggerType}
                    onChange={e => setRuleForm(f => ({ ...f, triggerType: e.target.value as AlertTriggerType }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  >
                    {TRIGGER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Source *</label>
                  <input
                    type="text"
                    value={ruleForm.source}
                    onChange={e => setRuleForm(f => ({ ...f, source: e.target.value }))}
                    placeholder="wqp"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Metric *</label>
                  <input
                    type="text"
                    value={ruleForm.metric}
                    onChange={e => setRuleForm(f => ({ ...f, metric: e.target.value }))}
                    placeholder="ph"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Operator</label>
                  <select
                    value={ruleForm.operator}
                    onChange={e => setRuleForm(f => ({ ...f, operator: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  >
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label} ({o.value})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Value *</label>
                  <input
                    type="number"
                    value={ruleForm.value}
                    onChange={e => setRuleForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="8.5"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Severity</label>
                  <select
                    value={ruleForm.severity}
                    onChange={e => setRuleForm(f => ({ ...f, severity: e.target.value as AlertSeverity }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                  >
                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={handleAddRule}
                disabled={!ruleForm.name || !ruleForm.source || !ruleForm.metric || !ruleForm.value}
                className="w-full py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
              >
                <Plus className="inline h-4 w-4 mr-1" />
                Add Rule
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── SUPPRESSIONS ─────────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {tab === 'suppressions' && (
        <div className="space-y-3">
          {/* Built-in Automatic Suppression */}
          <Card className="border-indigo-200 bg-indigo-50/50">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-800">Automatic Suppression</span>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-600 text-[9px]">Always Active</Badge>
              </div>
              <p className="text-[11px] text-indigo-600/70 -mt-1">These suppression layers run automatically before manual suppressions are checked.</p>
              <div className="space-y-1.5">
                {[
                  {
                    name: 'Exact-Match Cooldown',
                    desc: 'Each alert has a severity-based cooldown (critical: 15 min, warning: 1 hr, info: 4 hr). Identical dedupKeys are suppressed within this window.',
                    badges: throttleStats && throttleStats.totalSuppressed > 0
                      ? [{ label: `${throttleStats.totalSuppressed} total`, color: 'bg-slate-200 text-slate-700' }]
                      : [],
                  },
                  {
                    name: 'Site-Level Throttle (4 hours)',
                    desc: 'After an alert fires, the same site + parameter combo is suppressed for 4 hours regardless of severity. Prevents spam from persistent readings.',
                    badges: [
                      ...(throttleStats && throttleStats.totalThrottled > 0
                        ? [{ label: `${throttleStats.totalThrottled} throttled`, color: 'bg-slate-200 text-slate-700' }]
                        : []),
                      ...(throttleStats && throttleStats.sitesInCooldown > 0
                        ? [{ label: `${throttleStats.sitesInCooldown} active`, color: 'bg-slate-200 text-slate-700' }]
                        : []),
                    ],
                  },
                  {
                    name: 'Rate Limit (20/hr)',
                    desc: 'Maximum 20 alert emails per hour across all recipients. Excess alerts are queued for the next window.',
                    badges: throttleStats
                      ? [{ label: `${throttleStats.sentThisHour}/${throttleStats.rateLimitCap} this hour`, color: throttleStats.sentThisHour >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700' }]
                      : [],
                  },
                ].map(rule => (
                  <div key={rule.name} className="flex items-start gap-2.5 rounded-lg border border-indigo-200 bg-white/60 px-3 py-2">
                    <ShieldOff className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-indigo-400" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800">{rule.name}</span>
                        {rule.badges.map(b => (
                          <Badge key={b.label} variant="secondary" className={`text-[8px] ${b.color}`}>{b.label}</Badge>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{rule.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Manual Suppressions */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">{suppressions.length} manual suppression{suppressions.length !== 1 ? 's' : ''}</span>
            <button onClick={fetchSuppressions} className="flex items-center gap-1.5 text-xs text-cyan-600 hover:text-cyan-700 font-medium transition-colors">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-sm text-slate-400">Loading...</div>
          ) : suppressions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <ShieldOff className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">No active suppressions</p>
                <p className="text-xs text-slate-400 mt-1">Suppressions prevent duplicate alerts from being sent.</p>
              </CardContent>
            </Card>
          ) : (
            suppressions.map(s => {
              const isExpired = s.expiresAt && new Date(s.expiresAt) < new Date();
              return (
                <div key={s.id} className={`rounded-lg border p-3 ${isExpired ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 font-mono">{s.dedupKey}</span>
                        {isExpired && <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[9px]">Expired</Badge>}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{s.reason}</p>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Created {new Date(s.createdAt).toLocaleDateString()} by {s.createdBy}
                        {s.expiresAt && ` · Expires ${new Date(s.expiresAt).toLocaleString()}`}
                        {!s.expiresAt && ' · Permanent'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSuppression(s.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 transition-colors"
                      title="Remove suppression"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Add Suppression Form */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Plus className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">Add Suppression</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Dedup Key Pattern *</label>
                <input
                  type="text"
                  value={suppressForm.dedupKey}
                  onChange={e => setSuppressForm(f => ({ ...f, dedupKey: e.target.value }))}
                  placeholder="sentinel:*:critical"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Pattern format: type:entityId:severity (supports * wildcard)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reason *</label>
                <input
                  type="text"
                  value={suppressForm.reason}
                  onChange={e => setSuppressForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Known maintenance window"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry (optional)</label>
                <input
                  type="datetime-local"
                  value={suppressForm.expiresAt}
                  onChange={e => setSuppressForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Leave empty for permanent suppression</p>
              </div>

              <button
                onClick={handleAddSuppression}
                disabled={!suppressForm.dedupKey || !suppressForm.reason}
                className="w-full py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
              >
                <Plus className="inline h-4 w-4 mr-1" />
                Add Suppression
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── TEST ─────────────────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {tab === 'test' && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-700">Send Test Alert</p>
                <p className="text-xs text-slate-400">Sends a test email to verify the alert system is working.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Recipient Email</label>
              <input
                type="email"
                value={testEmail}
                onChange={e => { setTestEmail(e.target.value); setTestStatus(null); }}
                placeholder="admin@example.com"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200 outline-none"
              />
            </div>

            <button
              onClick={handleSendTest}
              disabled={!testEmail || testSending}
              className="w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 disabled:opacity-60 transition-all"
            >
              {testSending ? (
                <>
                  <RefreshCw className="inline h-4 w-4 mr-1.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="inline h-4 w-4 mr-1.5" />
                  Send Test Alert
                </>
              )}
            </button>

            {testStatus && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                testStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {testStatus.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testStatus.message}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
