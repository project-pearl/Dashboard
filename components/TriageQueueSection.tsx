'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, ChevronDown, Clock, User, MessageSquare, CheckCircle, AlertCircle, Search, Eye } from 'lucide-react';
import type { PearlUser } from '@/lib/authTypes';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TriageItem {
  id: string;
  alert_dedup_key: string;
  alert_type: string;
  alert_severity: string;
  title: string;
  body: string;
  entity_id: string;
  entity_label: string;
  state: string | null;
  huc8: string | null;
  status: 'pending' | 'acknowledged' | 'investigating' | 'resolved';
  priority: number;
  assigned_to_uid: string | null;
  assigned_to_name: string | null;
  resolved_by_name: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  notes?: TriageNote[];
}

interface TriageNote {
  id: string;
  triage_item_id: string;
  user_uid: string | null;
  user_name: string | null;
  action: string;
  note: string | null;
  created_at: string;
}

interface Props {
  scope: 'national' | 'state';
  stateFilter?: string;
  user: PearlUser | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const SEVERITY_COLORS: Record<string, string> = {
  anomaly: 'bg-red-100 text-red-800 border-red-300',
  critical: 'bg-orange-100 text-orange-800 border-orange-300',
  warning: 'bg-amber-100 text-amber-800 border-amber-300',
  info: 'bg-blue-100 text-blue-800 border-blue-300',
};

const SEVERITY_DOT: Record<string, string> = {
  anomaly: 'bg-red-500',
  critical: 'bg-orange-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

const STATUS_BADGE: Record<string, { label: string; style: string }> = {
  pending: { label: 'Pending', style: 'bg-slate-100 text-slate-700' },
  acknowledged: { label: 'Acknowledged', style: 'bg-blue-100 text-blue-700' },
  investigating: { label: 'Investigating', style: 'bg-purple-100 text-purple-700' },
  resolved: { label: 'Resolved', style: 'bg-green-100 text-green-700' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type FilterTab = 'all' | 'pending' | 'active' | 'mine' | 'resolved';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TriageQueueSection({ scope, stateFilter, user }: Props) {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [resolveText, setResolveText] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Fetch ──
  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (tab === 'pending') {
        params.append('status', 'pending');
      } else if (tab === 'active') {
        params.append('status', 'acknowledged');
        params.append('status', 'investigating');
      } else if (tab === 'resolved') {
        params.append('status', 'resolved');
      } else if (tab !== 'mine') {
        params.append('status', 'pending');
        params.append('status', 'acknowledged');
        params.append('status', 'investigating');
      }
      if (tab === 'mine' && user?.uid) {
        params.set('assigned_to', user.uid);
      }
      if (scope === 'state' && stateFilter) {
        params.set('state', stateFilter);
      }
      params.set('include_notes', 'true');
      params.set('limit', '50');

      const res = await fetch(`/api/triage?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tab, scope, stateFilter, user?.uid]);

  useEffect(() => {
    setLoading(true);
    fetchItems();
    const interval = setInterval(fetchItems, 60_000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  // ── Actions ──
  const doAction = async (action: string, itemId: string, extra: Record<string, string> = {}) => {
    if (!user) return;
    setActionLoading(itemId);
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          item_id: itemId,
          user_uid: user.uid,
          user_name: user.name,
          ...extra,
        }),
      });
      if (res.ok) {
        // Optimistic: re-fetch
        await fetchItems();
        setNoteText('');
        setResolveText('');
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  // ── Counts ──
  const pendingCount = items.filter(i => i.status === 'pending').length;
  const activeCount = items.filter(i => i.status === 'acknowledged' || i.status === 'investigating').length;

  // ── Tab filter ──
  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'active', label: 'In Progress' },
    { key: 'mine', label: 'Mine' },
    { key: 'resolved', label: 'Resolved' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-5 w-5 text-amber-600" />
          Triage Queue
          {pendingCount > 0 && (
            <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200 text-xs">
              {pendingCount} pending
            </Badge>
          )}
          {activeCount > 0 && (
            <Badge variant="outline" className="ml-1 bg-purple-50 text-purple-700 border-purple-200 text-xs">
              {activeCount} active
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Actionable alerts requiring investigation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tab bar */}
        <div className="flex gap-1 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                tab === t.key
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Items list */}
        {loading ? (
          <p className="text-xs text-slate-400 py-4 text-center">Loading triage items...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No items requiring triage</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const isExpanded = expandedId === item.id;
              const sevColor = SEVERITY_COLORS[item.alert_severity] || SEVERITY_COLORS.info;
              const dotColor = SEVERITY_DOT[item.alert_severity] || SEVERITY_DOT.info;
              const statusBadge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
              const isItemLoading = actionLoading === item.id;

              return (
                <div key={item.id} className={`rounded-lg border ${isExpanded ? 'border-slate-300 shadow-sm' : 'border-slate-200'}`}>
                  {/* Row header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50/50 transition-colors rounded-lg"
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-2xs shrink-0 ${sevColor}`}>
                          {item.alert_severity.toUpperCase()}
                        </Badge>
                        <span className="text-xs font-medium text-slate-800 truncate">{item.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-2xs text-slate-500">{item.entity_label}</span>
                        {item.assigned_to_name && (
                          <span className="text-2xs text-slate-400 flex items-center gap-0.5">
                            <User className="h-3 w-3" /> {item.assigned_to_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-2xs text-slate-400 flex items-center gap-0.5">
                        <Clock className="h-3 w-3" /> {timeAgo(item.created_at)}
                      </span>
                      <Badge variant="outline" className={`text-2xs ${statusBadge.style}`}>
                        {statusBadge.label}
                      </Badge>
                      <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
                      {/* Body */}
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{item.body}</p>

                      {/* Metadata row */}
                      <div className="flex flex-wrap gap-2 text-2xs text-slate-500">
                        <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {item.alert_type}</span>
                        {item.entity_id && <span className="flex items-center gap-1"><Search className="h-3 w-3" /> {item.entity_id}</span>}
                        {item.state && <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {item.state}</span>}
                        {item.huc8 && <span>HUC8: {item.huc8}</span>}
                      </div>

                      {/* Resolution note */}
                      {item.status === 'resolved' && item.resolution_note && (
                        <div className="rounded border border-green-200 bg-green-50 px-3 py-2">
                          <p className="text-2xs font-medium text-green-700">Resolution</p>
                          <p className="text-xs text-green-800 mt-0.5">{item.resolution_note}</p>
                          {item.resolved_by_name && (
                            <p className="text-2xs text-green-600 mt-1">By {item.resolved_by_name} {item.resolved_at ? timeAgo(item.resolved_at) : ''}</p>
                          )}
                        </div>
                      )}

                      {/* Activity log */}
                      {item.notes && item.notes.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wide">Activity</p>
                          {item.notes.map(note => (
                            <div key={note.id} className="flex items-start gap-2 text-2xs">
                              <MessageSquare className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                              <div>
                                <span className="font-medium text-slate-600">{note.user_name || 'System'}</span>
                                {' '}
                                <span className="text-slate-400">{note.action}</span>
                                {note.note && <span className="text-slate-600"> &mdash; {note.note}</span>}
                                <span className="text-slate-400 ml-1">{timeAgo(note.created_at)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      {item.status !== 'resolved' && user && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {item.status === 'pending' && (
                            <Button
                              size="sm" variant="outline"
                              className="text-xs h-7"
                              disabled={isItemLoading}
                              onClick={() => doAction('acknowledge', item.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                          {!item.assigned_to_uid && (
                            <Button
                              size="sm" variant="outline"
                              className="text-xs h-7"
                              disabled={isItemLoading}
                              onClick={() => doAction('assign', item.id, {
                                assigned_to_uid: user.uid,
                                assigned_to_name: user.name,
                              })}
                            >
                              Assign to Me
                            </Button>
                          )}
                          {item.status !== 'investigating' && (
                            <Button
                              size="sm" variant="outline"
                              className="text-xs h-7"
                              disabled={isItemLoading}
                              onClick={() => doAction('investigate', item.id)}
                            >
                              Investigating
                            </Button>
                          )}
                          <Button
                            size="sm" variant="outline"
                            className="text-xs h-7 text-green-700 border-green-300 hover:bg-green-50"
                            disabled={isItemLoading || !resolveText.trim()}
                            onClick={() => doAction('resolve', item.id, { resolution_note: resolveText })}
                          >
                            Resolve
                          </Button>
                        </div>
                      )}

                      {/* Reopen for resolved items */}
                      {item.status === 'resolved' && user && (
                        <Button
                          size="sm" variant="outline"
                          className="text-xs h-7"
                          disabled={isItemLoading}
                          onClick={() => doAction('reopen', item.id)}
                        >
                          Reopen
                        </Button>
                      )}

                      {/* Note/resolve input */}
                      {item.status !== 'resolved' && user && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add a note or resolution..."
                            className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            value={expandedId === item.id ? (resolveText || noteText) : ''}
                            onChange={e => {
                              setResolveText(e.target.value);
                              setNoteText(e.target.value);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && noteText.trim()) {
                                doAction('add_note', item.id, { note: noteText });
                              }
                            }}
                          />
                          <Button
                            size="sm" variant="outline"
                            className="text-xs h-7"
                            disabled={isItemLoading || !noteText.trim()}
                            onClick={() => doAction('add_note', item.id, { note: noteText })}
                          >
                            Note
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
