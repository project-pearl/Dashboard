'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  CalendarDays, Plus, Check, SkipForward, MessageSquare,
  ChevronDown, ChevronUp, Clock, AlertTriangle, X,
} from 'lucide-react';
import type { PearlUser } from '@/lib/authTypes';
import type { CalendarEvent } from '@/lib/complianceCalendarEvents';

// ── Props ────────────────────────────────────────────────────────────────────

interface ComplianceCalendarProps {
  stateAbbr: string;
  orgId?: string;
  user: PearlUser | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: 'permit-deadline', label: 'Permit Deadline' },
  { value: 'bmp-inspection', label: 'BMP Inspection' },
  { value: 'dmr-submission', label: 'DMR Submission' },
  { value: 'idde-followup', label: 'IDDE Follow-up' },
  { value: 'annual-report', label: 'Annual Report' },
  { value: 'public-meeting', label: 'Public Meeting' },
  { value: 'mcm-milestone', label: 'MCM Milestone' },
  { value: 'custom', label: 'Custom' },
];

const CATEGORIES = [
  { value: 'compliance', label: 'Compliance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'reporting', label: 'Reporting' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'maintenance', label: 'Maintenance' },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-500',
  'in-progress': 'bg-amber-500',
  completed: 'bg-green-500',
  overdue: 'bg-red-500',
  skipped: 'bg-slate-400',
};

// ── Component ────────────────────────────────────────────────────────────────

export function ComplianceCalendar({ stateAbbr, orgId, user }: ComplianceCalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Quick-add form state
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState('custom');
  const [newCategory, setNewCategory] = useState('compliance');
  const [newPriority, setNewPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [newDescription, setNewDescription] = useState('');

  // Action form state
  const [completionNote, setCompletionNote] = useState('');
  const [addNoteText, setAddNoteText] = useState('');

  // ── Fetch ──
  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({ state: stateAbbr });
      if (orgId) params.set('org_id', orgId);
      const res = await fetch(`/api/compliance-calendar?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [stateAbbr, orgId]);

  useEffect(() => {
    setLoading(true);
    fetchEvents();
    const interval = setInterval(fetchEvents, 60_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // ── Derived data ──
  const activeEvents = useMemo(() => events.filter(e => e.status !== 'completed' && e.status !== 'skipped'), [events]);
  const completedEvents = useMemo(() => events.filter(e => e.status === 'completed' || e.status === 'skipped'), [events]);

  const filteredEvents = useMemo(() => {
    if (!selectedDay) return activeEvents;
    const dayStr = selectedDay.toISOString().split('T')[0];
    return activeEvents.filter(e => e.date === dayStr);
  }, [activeEvents, selectedDay]);

  const topUrgent = useMemo(
    () => activeEvents.filter(e => e.status !== 'completed').sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 3),
    [activeEvents],
  );

  // Days with events (for calendar dots)
  const eventDates = useMemo(() => {
    const map = new Map<string, CalendarEvent['priority']>();
    for (const e of activeEvents) {
      const existing = map.get(e.date);
      if (!existing || priorityRank(e.priority) > priorityRank(existing)) {
        map.set(e.date, e.priority);
      }
    }
    return map;
  }, [activeEvents]);

  // ── Actions ──
  const doAction = async (action: string, eventId: string, extra: Record<string, string> = {}) => {
    if (!user) return;
    setActionLoading(eventId);
    try {
      const res = await fetch('/api/compliance-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          event_id: eventId,
          user_uid: user.uid,
          user_name: user.name,
          ...extra,
        }),
      });
      if (res.ok) {
        await fetchEvents();
        setCompletionNote('');
        setAddNoteText('');
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreate = async () => {
    if (!user || !newTitle || !newDate) return;
    setActionLoading('creating');
    try {
      const res = await fetch('/api/compliance-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: newTitle,
          description: newDescription || undefined,
          event_date: newDate,
          event_type: newType,
          category: newCategory,
          priority: newPriority,
          state: stateAbbr,
          org_id: orgId || stateAbbr,
          user_uid: user.uid,
          user_name: user.name,
        }),
      });
      if (res.ok) {
        await fetchEvents();
        setNewTitle('');
        setNewDate('');
        setNewType('custom');
        setNewCategory('compliance');
        setNewPriority('medium');
        setNewDescription('');
        setShowAddForm(false);
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  // ── Render ──
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-sm font-bold">Compliance Calendar</CardTitle>
              <CardDescription className="text-2xs">Deadlines, inspections, and milestones</CardDescription>
            </div>
          </div>
          {user && (
            <Button size="sm" variant="outline" className="text-2xs h-7 gap-1" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showAddForm ? 'Cancel' : 'Add Event'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Add Form */}
        {showAddForm && (
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 space-y-2">
            <input
              type="text"
              placeholder="Event title..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white"
              />
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white"
              >
                {EVENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as typeof newPriority)}
                className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <textarea
              placeholder="Description (optional)..."
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white resize-none"
              rows={2}
            />
            <Button
              size="sm"
              className="text-2xs h-7 w-full"
              disabled={!newTitle || !newDate || actionLoading === 'creating'}
              onClick={handleCreate}
            >
              {actionLoading === 'creating' ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-6 text-xs text-slate-400">Loading calendar...</div>
        )}

        {/* Countdown Tiles */}
        {!loading && topUrgent.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {topUrgent.map(ev => {
              const isOverdue = ev.daysUntil < 0;
              const tileColor = isOverdue || ev.daysUntil <= 30
                ? 'border-red-200 bg-red-50'
                : ev.daysUntil <= 90
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-blue-200 bg-blue-50';
              const textColor = isOverdue || ev.daysUntil <= 30
                ? 'text-red-600'
                : ev.daysUntil <= 90
                  ? 'text-amber-600'
                  : 'text-blue-600';
              return (
                <div
                  key={ev.id}
                  className={`rounded-lg border p-3 ${tileColor} ${isOverdue ? 'animate-pulse' : ''}`}
                >
                  <div className={`text-2xs uppercase tracking-wider font-bold ${textColor} truncate`}>
                    {ev.title.length > 25 ? ev.title.slice(0, 25) + '...' : ev.title}
                  </div>
                  <div className={`text-2xl font-black font-mono ${textColor}`}>
                    {isOverdue ? `${Math.abs(ev.daysUntil)}` : ev.daysUntil}
                  </div>
                  <div className="text-2xs text-slate-400">
                    {isOverdue ? 'days overdue' : 'days remaining'} &middot; {ev.date.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Calendar + Event List */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Month Calendar */}
            <div className="bg-white rounded-lg border border-slate-200 p-1">
              <Calendar
                mode="single"
                selected={selectedDay}
                onSelect={(d) => setSelectedDay(d === selectedDay ? undefined : d)}
                modifiers={{
                  hasEvent: Array.from(eventDates.keys()).map(d => new Date(d + 'T12:00:00')),
                }}
                modifiersStyles={{
                  hasEvent: {
                    fontWeight: 700,
                    textDecoration: 'underline',
                    textDecorationColor: '#3b82f6',
                    textUnderlineOffset: '3px',
                  },
                }}
              />
              {selectedDay && (
                <div className="px-3 pb-2">
                  <button onClick={() => setSelectedDay(undefined)} className="text-2xs text-blue-500 hover:underline">
                    Clear date filter
                  </button>
                </div>
              )}
            </div>

            {/* Event List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {selectedDay ? `Events on ${selectedDay.toLocaleDateString()}` : 'Upcoming'}
              </div>

              {filteredEvents.length === 0 && (
                <div className="text-xs text-slate-400 italic py-4 text-center">
                  {selectedDay ? 'No events on this date' : 'No upcoming events'}
                </div>
              )}

              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {filteredEvents.map(ev => (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    expanded={expandedId === ev.id}
                    onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    user={user}
                    actionLoading={actionLoading}
                    completionNote={completionNote}
                    setCompletionNote={setCompletionNote}
                    addNoteText={addNoteText}
                    setAddNoteText={setAddNoteText}
                    onAction={doAction}
                  />
                ))}
              </div>

              {/* Completed toggle */}
              {completedEvents.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="text-2xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    {showCompleted ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {completedEvents.length} completed / skipped
                  </button>
                  {showCompleted && (
                    <div className="space-y-1 mt-2 opacity-60">
                      {completedEvents.map(ev => (
                        <EventRow
                          key={ev.id}
                          event={ev}
                          expanded={expandedId === ev.id}
                          onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                          user={user}
                          actionLoading={actionLoading}
                          completionNote={completionNote}
                          setCompletionNote={setCompletionNote}
                          addNoteText={addNoteText}
                          setAddNoteText={setAddNoteText}
                          onAction={doAction}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Event Row Sub-component ──────────────────────────────────────────────────

function EventRow({
  event: ev,
  expanded,
  onToggle,
  user,
  actionLoading,
  completionNote,
  setCompletionNote,
  addNoteText,
  setAddNoteText,
  onAction,
}: {
  event: CalendarEvent;
  expanded: boolean;
  onToggle: () => void;
  user: PearlUser | null;
  actionLoading: string | null;
  completionNote: string;
  setCompletionNote: (v: string) => void;
  addNoteText: string;
  setAddNoteText: (v: string) => void;
  onAction: (action: string, eventId: string, extra: Record<string, string>) => Promise<void>;
}) {
  const isUserEvent = ev.source === 'user';

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[ev.status] || 'bg-slate-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700 truncate">{ev.title}</span>
            <Badge variant="outline" className={`text-2xs px-1.5 py-0 ${PRIORITY_COLORS[ev.priority]}`}>
              {ev.priority}
            </Badge>
            {ev.source === 'auto' && (
              <span className="text-2xs text-slate-400 italic">auto</span>
            )}
          </div>
          <div className="text-2xs text-slate-400">
            {ev.date} &middot; {ev.type.replace(/-/g, ' ')}
            {ev.daysUntil < 0 && <span className="text-red-500 font-bold ml-1">{Math.abs(ev.daysUntil)}d overdue</span>}
            {ev.daysUntil >= 0 && ev.daysUntil <= 30 && <span className="text-amber-500 font-bold ml-1">{ev.daysUntil}d left</span>}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-3 w-3 text-slate-400 shrink-0" /> : <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2">
          {ev.description && <p className="text-2xs text-slate-500">{ev.description}</p>}
          {ev.permitId && <p className="text-2xs text-slate-400">Permit: {ev.permitId}</p>}
          {ev.facilityName && <p className="text-2xs text-slate-400">Facility: {ev.facilityName}</p>}

          {/* Actions — only for user-created events */}
          {isUserEvent && user && ev.status !== 'completed' && ev.status !== 'skipped' && (
            <div className="space-y-2 pt-1">
              {/* Complete */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Completion note (required)..."
                  value={completionNote}
                  onChange={e => setCompletionNote(e.target.value)}
                  className="flex-1 text-2xs border border-slate-200 rounded px-2 py-1 bg-white"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="text-2xs h-6 gap-1 text-green-600 border-green-200 hover:bg-green-50"
                  disabled={!completionNote || actionLoading === ev.id}
                  onClick={() => onAction('complete', ev.id, { completion_note: completionNote })}
                >
                  <Check className="h-3 w-3" /> Done
                </Button>
              </div>

              {/* Skip */}
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-2xs h-6 gap-1 text-slate-500"
                  disabled={actionLoading === ev.id}
                  onClick={() => onAction('skip', ev.id, {})}
                >
                  <SkipForward className="h-3 w-3" /> Skip
                </Button>
              </div>
            </div>
          )}

          {/* Add Note — available for user events in any state */}
          {isUserEvent && user && (
            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                placeholder="Add a note..."
                value={addNoteText}
                onChange={e => setAddNoteText(e.target.value)}
                className="flex-1 text-2xs border border-slate-200 rounded px-2 py-1 bg-white"
              />
              <Button
                size="sm"
                variant="outline"
                className="text-2xs h-6 gap-1"
                disabled={!addNoteText || actionLoading === ev.id}
                onClick={() => onAction('add_note', ev.id, { note: addNoteText })}
              >
                <MessageSquare className="h-3 w-3" /> Note
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function priorityRank(p: string): number {
  return p === 'critical' ? 4 : p === 'high' ? 3 : p === 'medium' ? 2 : 1;
}
