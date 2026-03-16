'use client';

import { useEffect, useState, useCallback } from 'react';
import { csrfHeaders } from '@/lib/csrf';
import type { OutreachTarget } from '@/lib/outreach/types';

const ORG_TYPES = [
  'federal', 'state', 'municipal', 'utility',
  'university', 'corporate', 'military', 'other',
] as const;

const TYPE_COLORS: Record<string, string> = {
  federal:    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  state:      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  municipal:  'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
  utility:    'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  university: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  corporate:  'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  military:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  other:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  researched: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  contacted:  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
};

export default function TargetedOutreachPanel() {
  const [targets, setTargets] = useState<OutreachTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [creatingSegmentId, setCreatingSegmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<typeof ORG_TYPES[number]>('federal');
  const [whyTarget, setWhyTarget] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchTargets = useCallback(async () => {
    try {
      const res = await fetch('/api/outreach/targets');
      if (!res.ok) throw new Error('Failed to load targets');
      const data = await res.json();
      setTargets(data.targets || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim() || !whyTarget.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/outreach/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ orgName: orgName.trim(), orgType, whyTarget: whyTarget.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add target');
      }
      const data = await res.json();
      // Update local state directly from response to avoid stale GET
      if (data.target) {
        setTargets(prev => [...prev, data.target]);
      }
      setOrgName('');
      setWhyTarget('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleResearch(target: OutreachTarget) {
    setResearchingId(target.id);
    setError(null);
    try {
      const res = await fetch('/api/outreach/targets/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          targetId: target.id,
          orgName: target.orgName,
          orgType: target.orgType,
          whyTarget: target.whyTarget,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Research failed');
      }
      const data = await res.json();
      // Update local state directly from the response to avoid stale GET
      // (the GET endpoint is a separate serverless function with its own cache)
      if (data.target) {
        setTargets(prev => prev.map(t =>
          t.id === target.id ? { ...t, ...data.target } : t,
        ));
      }
      setExpandedId(target.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResearchingId(null);
    }
  }

  async function handleDelete(targetId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/outreach/targets?id=${targetId}`, {
        method: 'DELETE',
        headers: csrfHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete target');
      setTargets(prev => prev.filter(t => t.id !== targetId));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateSegment(target: OutreachTarget) {
    if (!target.aiResearch) return;
    setCreatingSegmentId(target.id);
    setError(null);
    try {
      const res = await fetch('/api/outreach/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          name: `${target.orgName} — Targeted`,
          description: target.aiResearch.summary,
          roleMapping: target.orgType === 'federal' ? 'Federal' : target.orgType === 'state' ? 'State' : 'Federal',
          painPoints: target.aiResearch.painPoints,
          buyingMotivations: target.aiResearch.talkingPoints,
          objections: [],
          decisionMakers: target.aiResearch.keyRoles.slice(0, 5),
          toneGuidance: target.aiResearch.approachStrategy,
          priority: 'high',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create segment');
      }
      const data = await res.json();
      // Update target with segment link
      const updated = targets.map(t =>
        t.id === target.id ? { ...t, segmentId: data.segment?.id } : t,
      );
      setTargets(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingSegmentId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
        Loading targets...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Targeted Outreach</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Name specific organizations, then let AI research them for tailored outreach intelligence.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Add Target Form */}
      <form onSubmit={handleAdd} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 space-y-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Add Target Organization</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="e.g. DARPA, EPA Office of Water"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Organization Type</label>
            <select
              value={orgType}
              onChange={e => setOrgType(e.target.value as typeof ORG_TYPES[number])}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              {ORG_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Why target this org?</label>
          <textarea
            value={whyTarget}
            onChange={e => setWhyTarget(e.target.value)}
            placeholder="e.g. They fund water security R&D and have a $50M annual budget for environmental tech"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !orgName.trim() || !whyTarget.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          {adding ? 'Adding...' : 'Add Target'}
        </button>
      </form>

      {/* Target Cards */}
      {targets.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          No targets yet. Add an organization above to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {targets.map(target => {
            const isExpanded = expandedId === target.id;
            const isResearching = researchingId === target.id;
            const isCreatingSegment = creatingSegmentId === target.id;
            const r = target.aiResearch;

            return (
              <div
                key={target.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : target.id)}
                        className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left"
                      >
                        {target.orgName}
                      </button>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TYPE_COLORS[target.orgType]}`}>
                        {target.orgType}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[target.status]}`}>
                        {target.status}
                      </span>
                      {target.segmentId && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          segment linked
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{target.whyTarget}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(target.status === 'pending' || !target.aiResearch) && (
                      <button
                        onClick={() => handleResearch(target)}
                        disabled={isResearching}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors disabled:opacity-50"
                      >
                        {isResearching ? 'Researching...' : 'Research'}
                      </button>
                    )}
                    {target.status === 'researched' && !target.segmentId && (
                      <button
                        onClick={() => handleCreateSegment(target)}
                        disabled={isCreatingSegment}
                        className="px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-md hover:bg-green-50 dark:hover:bg-green-900 transition-colors disabled:opacity-50"
                      >
                        {isCreatingSegment ? 'Creating...' : 'Create Segment'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(target.id)}
                      className="px-2 py-1.5 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      title="Delete target"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {/* Expanded Research Results */}
                {isExpanded && r && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-gray-50 dark:bg-gray-850">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Summary</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{r.summary}</p>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Why PIN Matters to Them</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{r.relevance}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Key Roles to Target</h4>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                          {r.keyRoles.map((role, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-blue-400 mt-0.5">&#x2022;</span> {role}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Pain Points</h4>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                          {r.painPoints.map((pt, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-red-400 mt-0.5">&#x2022;</span> {pt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Tailored Talking Points</h4>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                        {r.talkingPoints.map((tp, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-green-400 mt-0.5">&#x2022;</span> {tp}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {r.budgetCycle && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Budget Cycle</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{r.budgetCycle}</p>
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Approach Strategy</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{r.approachStrategy}</p>
                      </div>
                    </div>

                    {r.recentNews && r.recentNews.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Recent News & Initiatives</h4>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                          {r.recentNews.map((news, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-amber-400 mt-0.5">&#x2022;</span> {news}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      {!target.segmentId && (
                        <button
                          onClick={() => handleCreateSegment(target)}
                          disabled={isCreatingSegment}
                          className="px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-md hover:bg-green-50 dark:hover:bg-green-900 transition-colors disabled:opacity-50"
                        >
                          {isCreatingSegment ? 'Creating...' : 'Create Segment from Research'}
                        </button>
                      )}
                      <a
                        href={`/dashboard/outreach/contacts?org=${encodeURIComponent(target.orgName)}`}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                      >
                        Add Contacts
                      </a>
                    </div>
                  </div>
                )}

                {/* Collapsed research indicator — click to expand */}
                {!isExpanded && r && (
                  <button
                    onClick={() => setExpandedId(target.id)}
                    className="w-full border-t border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
                  >
                    {r.keyRoles.length} key roles, {r.painPoints.length} pain points, {r.talkingPoints.length} talking points — click to expand
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
