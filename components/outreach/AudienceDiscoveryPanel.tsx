'use client';

import { useState, useEffect } from 'react';
import { csrfHeaders } from '@/lib/csrf';
import type { AudienceSegment, EmailDraft } from '@/lib/outreach/types';
import SegmentCard from './SegmentCard';

export default function AudienceDiscoveryPanel() {
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState('');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<{ segmentId: string; draft?: EmailDraft; error?: string } | null>(null);

  useEffect(() => {
    fetch('/api/outreach/segments')
      .then(r => r.json())
      .then(d => setSegments(d.segments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const discover = async () => {
    setDiscovering(true);
    setError('');
    try {
      const res = await fetch('/api/outreach/discover-segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        // Reload segments
        const reload = await fetch('/api/outreach/segments').then(r => r.json());
        setSegments(reload.segments || []);
      } else {
        setError(data.error || 'Discovery failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setDiscovering(false);
    }
  };

  const handleDeleteSegment = async (segmentId: string) => {
    try {
      const res = await fetch(`/api/outreach/segments?id=${segmentId}`, {
        method: 'DELETE',
        headers: csrfHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete segment');
        return;
      }
      setSegments(prev => prev.filter(s => s.id !== segmentId));
    } catch {
      setError('Network error');
    }
  };

  const handleGenerateEmail = async (segmentId: string) => {
    setGeneratingFor(segmentId);
    setGenResult(null);
    try {
      const res = await fetch('/api/outreach/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ segmentId, campaignGoal: 'Introduce platform and schedule demo' }),
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setGenResult({ segmentId, draft: data.draft });
      } else {
        setGenResult({ segmentId, error: data.error || 'Generation failed' });
      }
    } catch {
      setGenResult({ segmentId, error: 'Network error' });
    } finally {
      setGeneratingFor(null);
    }
  };

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading segments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Audience Segments</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {segments.length} segment{segments.length !== 1 ? 's' : ''} discovered
          </p>
        </div>
        <button
          onClick={discover}
          disabled={discovering}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
        >
          {discovering ? 'Discovering...' : 'Discover Audiences'}
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
          {error}
        </div>
      )}

      {discovering && (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          <div className="animate-pulse">AI is analyzing your business profile and discovering ideal audience segments...</div>
        </div>
      )}

      {segments.length === 0 && !discovering ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium mb-2">No segments yet</p>
          <p className="text-sm">Set up your business profile, then click &quot;Discover Audiences&quot; to find your ideal customer segments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {segments.map(seg => (
            <div key={seg.id} className="relative">
              <SegmentCard
                segment={seg}
                onGenerateEmail={generatingFor ? undefined : handleGenerateEmail}
                onDelete={handleDeleteSegment}
              />
              {generatingFor === seg.id && (
                <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-300 animate-pulse">Generating email...</span>
                </div>
              )}
              {genResult?.segmentId === seg.id && genResult.error && (
                <div className="mt-2 p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                  {genResult.error}
                </div>
              )}
              {genResult?.segmentId === seg.id && genResult.draft && (
                <div className="mt-2 border border-green-200 dark:border-green-800 rounded-lg bg-green-50/50 dark:bg-green-900/20 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-green-100/60 dark:bg-green-900/40 border-b border-green-200 dark:border-green-800">
                    <span className="text-sm font-semibold text-green-800 dark:text-green-300">
                      Email Draft Generated
                    </span>
                    <button
                      onClick={() => setGenResult(null)}
                      className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                    >
                      Dismiss
                    </button>
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Subject Lines ({genResult.draft.subjectLines.length})
                      </div>
                      <div className="space-y-1">
                        {genResult.draft.subjectLines.map((subj, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
                            <span className="text-green-500 mt-0.5">{i === genResult.draft!.selectedSubject ? '\u25C9' : '\u25CB'}</span>
                            <span>{subj}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Body Preview</div>
                      <div
                        className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3 max-h-48 overflow-y-auto prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: genResult.draft.htmlBody }}
                      />
                    </div>
                    {genResult.draft.personalizationTokens.length > 0 && (
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        <span className="font-medium">Tokens:</span>{' '}
                        {genResult.draft.personalizationTokens.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
