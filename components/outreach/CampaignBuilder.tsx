'use client';

import { useState, useEffect, useCallback } from 'react';
import { csrfHeaders } from '@/lib/csrf';
import type { Campaign, AudienceSegment, EmailDraft } from '@/lib/outreach/types';
import SegmentCard from './SegmentCard';
import EmailEditor from './EmailEditor';

interface Props {
  campaignId: string;
}

export default function CampaignBuilder({ campaignId }: Props) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/outreach/campaigns/${campaignId}`).then(r => r.json()),
      fetch('/api/outreach/segments').then(r => r.json()),
    ]).then(([campData, segData]) => {
      setCampaign(campData.campaign || null);
      setSegments(segData.segments || []);
      if (campData.campaign?.segmentIds?.[0]) {
        setActiveSegment(campData.campaign.segmentIds[0]);
      }
    }).catch(() => setError('Failed to load campaign'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const generateEmail = useCallback(async (segmentId: string) => {
    if (!campaign) return;
    setGenerating(segmentId);
    setError('');
    try {
      const res = await fetch('/api/outreach/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ segmentId, campaignGoal: campaign.goal }),
      });
      const data = await res.json();
      if (data.success && data.draft) {
        const updated = {
          ...campaign,
          emails: { ...campaign.emails, [segmentId]: data.draft },
        };
        setCampaign(updated);
        // Persist to server
        await fetch(`/api/outreach/campaigns/${campaignId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
          body: JSON.stringify({ emails: { [segmentId]: data.draft } }),
        });
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setGenerating(null);
    }
  }, [campaign, campaignId]);

  const updateDraft = useCallback(async (draft: EmailDraft) => {
    if (!campaign) return;
    const updated = {
      ...campaign,
      emails: { ...campaign.emails, [draft.segmentId]: draft },
    };
    setCampaign(updated);

    setSaving(true);
    try {
      await fetch(`/api/outreach/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ emails: { [draft.segmentId]: draft } }),
      });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [campaign, campaignId]);

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading campaign...</div>;
  }

  if (!campaign) {
    return <div className="text-red-500">Campaign not found</div>;
  }

  const campaignSegments = segments.filter(s => campaign.segmentIds.includes(s.id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{campaign.name}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{campaign.goal}</p>
        <div className="flex gap-2 mt-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
            campaign.status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
              : campaign.status === 'ready' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
          }`}>
            {campaign.status}
          </span>
          {saving && <span className="text-xs text-gray-400 animate-pulse">Saving...</span>}
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: segment list */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Segments</h3>
          {campaignSegments.map(seg => (
            <div
              key={seg.id}
              onClick={() => setActiveSegment(seg.id)}
              className="cursor-pointer"
            >
              <SegmentCard
                segment={seg}
                selected={activeSegment === seg.id}
                onGenerateEmail={generating ? undefined : generateEmail}
              />
              {generating === seg.id && (
                <div className="text-xs text-blue-500 animate-pulse mt-1">Generating...</div>
              )}
              {campaign.emails[seg.id] && (
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Email ready (v{campaign.emails[seg.id].version})
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: email editor */}
        <div className="lg:col-span-2">
          {activeSegment && campaign.emails[activeSegment] ? (
            <EmailEditor
              draft={campaign.emails[activeSegment]}
              campaignId={campaignId}
              onUpdate={updateDraft}
            />
          ) : activeSegment ? (
            <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400 mb-3">No email draft for this segment yet</p>
              <button
                onClick={() => generateEmail(activeSegment)}
                disabled={!!generating}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                Generate Email
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Select a segment to edit its email
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
