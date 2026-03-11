'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp, Download } from 'lucide-react';

// ── Types ──

interface Initiative {
  id: string;
  name: string;
  description: string;
  category: 'restoration' | 'monitoring' | 'advocacy' | 'education' | 'infrastructure';
  status: 'proposed' | 'active' | 'paused' | 'completed';
  priority: 'high' | 'medium' | 'low';
  startDate: string;
  targetDate: string;
  lead: string;
  watershed: string;
  goals: string[];
  progressPct: number;
  createdAt: string;
  updatedAt: string;
}

type StatusFilter = 'all' | Initiative['status'];

const STORAGE_KEY = 'pin-ngo-initiatives';

const CATEGORY_COLORS: Record<Initiative['category'], string> = {
  restoration: 'bg-green-100 text-green-700 border-green-300',
  monitoring: 'bg-blue-100 text-blue-700 border-blue-300',
  advocacy: 'bg-purple-100 text-purple-700 border-purple-300',
  education: 'bg-amber-100 text-amber-700 border-amber-300',
  infrastructure: 'bg-slate-100 text-slate-700 border-slate-300',
};

const STATUS_COLORS: Record<Initiative['status'], string> = {
  proposed: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-slate-100 text-slate-600',
  completed: 'bg-blue-100 text-blue-700',
};

const PRIORITY_COLORS: Record<Initiative['priority'], string> = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-slate-500',
};

// ── Helpers ──

function loadInitiatives(): Initiative[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveInitiatives(items: Initiative[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Empty form state ──

const EMPTY_FORM = {
  name: '',
  description: '',
  category: 'restoration' as Initiative['category'],
  priority: 'medium' as Initiative['priority'],
  startDate: new Date().toISOString().slice(0, 10),
  targetDate: '',
  lead: '',
  watershed: '',
  goalsText: '',
};

// ── Component ──

interface Props {
  stateAbbr: string;
}

export function InitiativesTrackerPanel({ stateAbbr }: Props) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Load on mount
  useEffect(() => { setInitiatives(loadInitiatives()); }, []);

  // Persist on change
  const persist = useCallback((next: Initiative[]) => {
    setInitiatives(next);
    saveInitiatives(next);
  }, []);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    const list = filter === 'all' ? initiatives : initiatives.filter(i => i.status === filter);
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [initiatives, filter]);

  // ── Summary stats ──
  const stats = useMemo(() => ({
    active: initiatives.filter(i => i.status === 'active').length,
    completed: initiatives.filter(i => i.status === 'completed').length,
    avgProgress: initiatives.length > 0
      ? Math.round(initiatives.reduce((s, i) => s + i.progressPct, 0) / initiatives.length)
      : 0,
  }), [initiatives]);

  // ── Form handlers ──
  const resetForm = () => { setForm(EMPTY_FORM); setShowForm(false); setEditingId(null); };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const now = new Date().toISOString();
    const goals = form.goalsText.split(',').map(g => g.trim()).filter(Boolean);

    if (editingId) {
      persist(initiatives.map(i => i.id === editingId ? {
        ...i,
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        startDate: form.startDate,
        targetDate: form.targetDate,
        lead: form.lead.trim(),
        watershed: form.watershed.trim(),
        goals,
        updatedAt: now,
      } : i));
    } else {
      const newInit: Initiative = {
        id: makeId(),
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        status: 'proposed',
        priority: form.priority,
        startDate: form.startDate,
        targetDate: form.targetDate,
        lead: form.lead.trim(),
        watershed: form.watershed.trim(),
        goals,
        progressPct: 0,
        createdAt: now,
        updatedAt: now,
      };
      persist([...initiatives, newInit]);
    }
    resetForm();
  };

  const startEdit = (i: Initiative) => {
    setForm({
      name: i.name,
      description: i.description,
      category: i.category,
      priority: i.priority,
      startDate: i.startDate,
      targetDate: i.targetDate,
      lead: i.lead,
      watershed: i.watershed,
      goalsText: i.goals.join(', '),
    });
    setEditingId(i.id);
    setShowForm(true);
  };

  const deleteInit = (id: string) => {
    persist(initiatives.filter(i => i.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateStatus = (id: string, status: Initiative['status']) => {
    persist(initiatives.map(i => i.id === id ? { ...i, status, updatedAt: new Date().toISOString(), progressPct: status === 'completed' ? 100 : i.progressPct } : i));
  };

  const updateProgress = (id: string, pct: number) => {
    persist(initiatives.map(i => i.id === id ? { ...i, progressPct: pct, updatedAt: new Date().toISOString() } : i));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(initiatives, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `initiatives-${stateAbbr}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'proposed', label: 'Proposed' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Initiatives Tracker</CardTitle>
            <CardDescription>Track conservation initiatives for {stateAbbr}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportJson} disabled={initiatives.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" />Export
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />New Initiative
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Summary strip ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-2xs font-medium uppercase tracking-wider text-slate-500">Active</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
            <div className="text-2xs font-medium uppercase tracking-wider text-slate-500">Completed</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.avgProgress}%</div>
            <div className="text-2xs font-medium uppercase tracking-wider text-slate-500">Avg Progress</div>
          </div>
        </div>

        {/* ── Status filter tabs ── */}
        <div className="flex gap-1 border-b pb-2">
          {statusTabs.map(t => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                filter === t.value
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── New / Edit form ── */}
        {showForm && (
          <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
            <div className="text-sm font-semibold">{editingId ? 'Edit Initiative' : 'New Initiative'}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded px-3 py-1.5 text-sm w-full" placeholder="Initiative name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <select className="border rounded px-3 py-1.5 text-sm w-full" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Initiative['category'] })}>
                <option value="restoration">Restoration</option>
                <option value="monitoring">Monitoring</option>
                <option value="advocacy">Advocacy</option>
                <option value="education">Education</option>
                <option value="infrastructure">Infrastructure</option>
              </select>
              <input className="border rounded px-3 py-1.5 text-sm w-full" placeholder="Lead person / org" value={form.lead} onChange={e => setForm({ ...form, lead: e.target.value })} />
              <input className="border rounded px-3 py-1.5 text-sm w-full" placeholder="Target watershed" value={form.watershed} onChange={e => setForm({ ...form, watershed: e.target.value })} />
              <select className="border rounded px-3 py-1.5 text-sm w-full" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Initiative['priority'] })}>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
              <div className="flex gap-2">
                <input type="date" className="border rounded px-3 py-1.5 text-sm flex-1" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                <input type="date" className="border rounded px-3 py-1.5 text-sm flex-1" placeholder="Target date" value={form.targetDate} onChange={e => setForm({ ...form, targetDate: e.target.value })} />
              </div>
            </div>
            <textarea className="border rounded px-3 py-1.5 text-sm w-full" rows={2} placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <input className="border rounded px-3 py-1.5 text-sm w-full" placeholder="Goals (comma-separated)" value={form.goalsText} onChange={e => setForm({ ...form, goalsText: e.target.value })} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={resetForm}><X className="h-3.5 w-3.5 mr-1" />Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={!form.name.trim()}><Check className="h-3.5 w-3.5 mr-1" />{editingId ? 'Save' : 'Create'}</Button>
            </div>
          </div>
        )}

        {/* ── Initiative cards ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">
            {initiatives.length === 0 ? 'No initiatives yet. Click "+ New Initiative" to get started.' : 'No initiatives match this filter.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(init => {
              const expanded = expandedId === init.id;
              return (
                <div key={init.id} className="border rounded-lg overflow-hidden">
                  {/* Header row */}
                  <div
                    className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : init.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{init.name}</span>
                        <Badge variant="outline" className={`text-2xs ${CATEGORY_COLORS[init.category]}`}>{init.category}</Badge>
                        <Badge variant="outline" className={`text-2xs ${STATUS_COLORS[init.status]}`}>{init.status}</Badge>
                        <span className={`text-2xs font-bold uppercase ${PRIORITY_COLORS[init.priority]}`}>{init.priority}</span>
                      </div>
                      {init.lead && <div className="text-xs text-slate-500 mt-0.5">{init.lead}{init.watershed ? ` · ${init.watershed}` : ''}</div>}
                    </div>
                    {/* Progress bar mini */}
                    <div className="w-20 flex-shrink-0">
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${init.progressPct}%` }} />
                      </div>
                      <div className="text-2xs text-slate-500 text-right mt-0.5">{init.progressPct}%</div>
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="border-t px-4 py-3 bg-slate-50 space-y-3">
                      {init.description && <p className="text-sm text-slate-600">{init.description}</p>}

                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        {init.startDate && <span>Start: {init.startDate}</span>}
                        {init.targetDate && <span>Target: {init.targetDate}</span>}
                        <span>Created: {new Date(init.createdAt).toLocaleDateString()}</span>
                      </div>

                      {/* Progress slider */}
                      <div>
                        <label className="text-xs font-medium text-slate-600">Progress: {init.progressPct}%</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={init.progressPct}
                          onChange={e => updateProgress(init.id, Number(e.target.value))}
                          className="w-full h-2 mt-1 accent-green-600"
                        />
                      </div>

                      {/* Goals */}
                      {init.goals.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-slate-600 mb-1">Goals</div>
                          <ul className="space-y-1">
                            {init.goals.map((g, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                                <span className="mt-0.5 h-3 w-3 rounded-full border border-slate-300 flex-shrink-0" />
                                {g}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Status change + actions */}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span className="text-xs text-slate-500">Set status:</span>
                        {(['proposed', 'active', 'paused', 'completed'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => updateStatus(init.id, s)}
                            className={`px-2 py-0.5 text-2xs rounded border transition-colors ${
                              init.status === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                        <div className="flex-1" />
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startEdit(init)}>
                          <Edit2 className="h-3 w-3 mr-1" />Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteInit(init.id)}>
                          <Trash2 className="h-3 w-3 mr-1" />Delete
                        </Button>
                      </div>
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
