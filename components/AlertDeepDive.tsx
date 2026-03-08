'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X, AlertTriangle, XCircle, Info, CheckCircle, Clock,
  TrendingDown, TrendingUp, ClipboardList, Send, MessageSquare,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine,
} from 'recharts';
import type { AlertSeverity } from '@/lib/alerts/types';
import { useAuth } from '@/lib/authContext';
import { csrfHeaders } from '@/lib/csrf';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface DeepDiveAlert {
  id: string;
  deployment_id: string;
  deploymentName?: string;
  parameter: string;
  value: number;
  baseline: number;
  delta: number;
  unit: string;
  severity: AlertSeverity;
  status: 'open' | 'acknowledged' | 'resolved';
  title: string;
  diagnosis: string | null;
  recommendation: string | null;
  pipeline_event_id?: string | null;
  created_at: string;
  updated_at?: string;
}

interface TimelineEntry {
  id: string;
  recorded_at: string;
  value: number;
  baseline: number;
  severity: string | null;
}

interface Acknowledgment {
  id: string;
  user_name: string | null;
  note: string | null;
  action_taken: string | null;
  acknowledged_at: string;
}

interface AlertDeepDiveProps {
  alert: DeepDiveAlert;
  /** If provided, pre-loaded data (skips fetch). For inline mode. */
  inlineTimeline?: TimelineEntry[];
  inlineAcknowledgments?: Acknowledgment[];
  onClose: () => void;
  onStatusChange?: (alertId: string, newStatus: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Severity Helpers                                                  */
/* ------------------------------------------------------------------ */

const SEV_CONFIG: Record<AlertSeverity, { bg: string; border: string; text: string; icon: typeof XCircle; label: string }> = {
  critical: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', icon: XCircle, label: 'Critical' },
  warning:  { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', icon: AlertTriangle, label: 'Warning' },
  info:     { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', icon: Info, label: 'Info' },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  open:         { bg: 'bg-red-100', text: 'text-red-700', label: 'Open' },
  acknowledged: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Acknowledged' },
  resolved:     { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Resolved' },
};

function formatDuration(isoStart: string): string {
  const ms = Date.now() - new Date(isoStart).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function AlertDeepDive({ alert, inlineTimeline, inlineAcknowledgments, onClose, onStatusChange }: AlertDeepDiveProps) {
  const { user } = useAuth();
  const sev = SEV_CONFIG[alert.severity];
  const SevIcon = sev.icon;
  const statusCfg = STATUS_CONFIG[alert.status] || STATUS_CONFIG.open;

  // ── Data state ──
  const [timeline, setTimeline] = useState<TimelineEntry[]>(inlineTimeline || []);
  const [acknowledgments, setAcknowledgments] = useState<Acknowledgment[]>(inlineAcknowledgments || []);
  const [loading, setLoading] = useState(!inlineTimeline);

  // ── Acknowledge form ──
  const [showAckForm, setShowAckForm] = useState(false);
  const [ackNote, setAckNote] = useState('');
  const [ackAction, setAckAction] = useState('inspected');
  const [ackSubmitting, setAckSubmitting] = useState(false);

  // ── Fetch from Supabase if no inline data ──
  const fetchDetails = useCallback(async () => {
    if (inlineTimeline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts/deployment-alerts?alertId=${alert.id}`);
      if (res.ok) {
        const data = await res.json();
        setTimeline(data.timeline || []);
        setAcknowledgments(data.acknowledgments || []);
      }
    } catch { /* best effort */ }
    setLoading(false);
  }, [alert.id, inlineTimeline]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  // ── Acknowledge handler ──
  async function handleAcknowledge() {
    setAckSubmitting(true);
    try {
      const res = await fetch('/api/alerts/deployment-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          action: 'acknowledge',
          alert_id: alert.id,
          user_id: user?.uid || null,
          user_name: user?.name || 'Operator',
          note: ackNote || null,
          action_taken: ackAction,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setShowAckForm(false);
        setAckNote('');
        // Refresh acknowledgments
        fetchDetails();
        onStatusChange?.(alert.id, result.status);
      }
    } catch { /* ignore */ }
    setAckSubmitting(false);
  }

  // ── Work order stub ──
  function handleCreateWorkOrder() {
    console.log('[PIN] Work order created:', {
      alertId: alert.id,
      deploymentId: alert.deployment_id,
      parameter: alert.parameter,
      severity: alert.severity,
      title: alert.title,
      createdBy: user?.name || 'Operator',
      createdAt: new Date().toISOString(),
    });
    // Show feedback
    setAckAction('created_work_order');
    setAckNote('Work order created');
    setShowAckForm(true);
  }

  // ── Timeline chart data ──
  const chartData = timeline.map(t => ({
    time: new Date(t.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: t.value,
    baseline: t.baseline,
  }));

  // ── Duration calculation ──
  const duration = formatDuration(alert.created_at);
  const isRecent = Date.now() - new Date(alert.created_at).getTime() < 2 * 60 * 60_000;

  return (
    <Card className={`${sev.border} border-2 overflow-hidden`}>
      {/* Header */}
      <CardHeader className={`${sev.bg} pb-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <SevIcon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${sev.text}`} />
            <div className="min-w-0">
              <CardTitle className={`text-base ${sev.text}`}>
                {alert.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge className={`${statusCfg.bg} ${statusCfg.text} text-[10px]`}>{statusCfg.label}</Badge>
                <Badge variant="outline" className="text-[10px]">{alert.parameter}</Badge>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {isRecent ? `${duration} ago — sudden onset` : `Ongoing for ${duration}`}
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* ── Readings ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 border text-center">
            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Baseline</div>
            <div className="text-lg font-bold font-mono text-slate-700">{alert.baseline} <span className="text-xs font-normal">{alert.unit}</span></div>
          </div>
          <div className={`rounded-lg p-3 border text-center ${sev.bg} ${sev.border}`}>
            <div className={`text-[10px] font-medium uppercase tracking-wider ${sev.text}`}>Current</div>
            <div className={`text-lg font-bold font-mono ${sev.text}`}>{alert.value} <span className="text-xs font-normal">{alert.unit}</span></div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border text-center">
            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Delta</div>
            <div className="text-lg font-bold font-mono flex items-center justify-center gap-1">
              {alert.delta < 0 ? <TrendingDown className="h-4 w-4 text-red-600" /> : <TrendingUp className="h-4 w-4 text-emerald-600" />}
              <span className={alert.delta < 0 ? 'text-red-700' : 'text-emerald-700'}>
                {alert.delta > 0 ? '+' : ''}{typeof alert.delta === 'number' ? alert.delta.toFixed(1) : alert.delta}
                {alert.unit === '%' ? '%' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* ── Trend Chart ── */}
        {chartData.length > 1 && (
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Parameter Trend</div>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={alert.severity === 'critical' ? '#ef4444' : '#f59e0b'} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={alert.severity === 'critical' ? '#ef4444' : '#f59e0b'} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
                  <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <ReferenceLine y={alert.baseline} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Baseline', fontSize: 9, fill: '#64748b' }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={alert.severity === 'critical' ? '#ef4444' : '#f59e0b'}
                    strokeWidth={2}
                    fill="url(#valueGrad)"
                    name={`${alert.parameter} (${alert.unit})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {chartData.length <= 1 && !loading && (
          <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 border text-center">
            Timeline data will populate as readings are collected over time.
          </div>
        )}

        {/* ── Diagnosis ── */}
        {alert.diagnosis && (
          <div className="bg-slate-50 rounded-lg p-3 border space-y-2">
            <div className="text-xs font-semibold text-slate-600">Diagnosis</div>
            <p className="text-sm text-slate-700 leading-relaxed">{alert.diagnosis}</p>
            {alert.recommendation && (
              <>
                <div className="text-xs font-semibold text-slate-600 pt-1">Recommended Action</div>
                <p className="text-sm text-slate-700 leading-relaxed">{alert.recommendation}</p>
              </>
            )}
          </div>
        )}

        {/* ── Acknowledgment History ── */}
        {acknowledgments.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Acknowledgment History</div>
            <div className="space-y-2">
              {acknowledgments.map(ack => (
                <div key={ack.id} className="flex items-start gap-2 bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <span className="font-semibold text-emerald-800">{ack.user_name || 'Operator'}</span>
                    {ack.action_taken && (
                      <Badge variant="outline" className="ml-1.5 text-[9px]">{ack.action_taken.replace(/_/g, ' ')}</Badge>
                    )}
                    <span className="text-slate-500 ml-1.5">{new Date(ack.acknowledged_at).toLocaleString()}</span>
                    {ack.note && <p className="text-slate-600 mt-0.5">{ack.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        {alert.status !== 'resolved' && (
          <div className="space-y-2">
            {!showAckForm ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowAckForm(true)}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Acknowledge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateWorkOrder}
                  className="flex-1"
                >
                  <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                  Work Order
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setAckAction('resolved'); setShowAckForm(true); }}
                  className="flex-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Resolve
                </Button>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-3 border space-y-2">
                <div className="text-xs font-semibold text-slate-600">
                  {ackAction === 'resolved' ? 'Resolve Alert' : 'Acknowledge Alert'}
                </div>
                <select
                  value={ackAction}
                  onChange={e => setAckAction(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-sm bg-white"
                >
                  <option value="inspected">Inspected</option>
                  <option value="dispatched_tech">Dispatched field tech</option>
                  <option value="created_work_order">Created work order</option>
                  <option value="dismissed">Dismissed (false alarm)</option>
                  <option value="resolved">Resolved</option>
                </select>
                <textarea
                  value={ackNote}
                  onChange={e => setAckNote(e.target.value)}
                  placeholder="Add a note (optional)..."
                  rows={2}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-sm resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAcknowledge} disabled={ackSubmitting} className="flex-1">
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {ackSubmitting ? 'Saving...' : 'Submit'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAckForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="text-center py-4 text-xs text-slate-400">Loading alert details...</div>
        )}
      </CardContent>
    </Card>
  );
}
