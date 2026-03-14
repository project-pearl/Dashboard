'use client';

import { useState, useEffect } from 'react';
import { csrfHeaders } from '@/lib/csrf';
import type { AudienceSegment } from '@/lib/outreach/types';
import SegmentCard from './SegmentCard';

export default function AudienceDiscoveryPanel() {
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState('');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<{ segmentId: string; message: string } | null>(null);

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
      if (data.success) {
        setGenResult({ segmentId, message: `Generated ${data.draft.subjectLines.length} subject lines` });
      } else {
        setGenResult({ segmentId, message: data.error || 'Generation failed' });
      }
    } catch {
      setGenResult({ segmentId, message: 'Network error' });
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
              />
              {generatingFor === seg.id && (
                <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-300 animate-pulse">Generating email...</span>
                </div>
              )}
              {genResult?.segmentId === seg.id && (
                <div className="mt-1 text-xs text-green-600 dark:text-green-400">{genResult.message}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
