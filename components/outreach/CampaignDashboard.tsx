'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { csrfHeaders } from '@/lib/csrf';
import type { Campaign, AudienceSegment } from '@/lib/outreach/types';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  ready: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  sent: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
};

export default function CampaignDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Create form
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/outreach/campaigns').then(r => r.json()),
      fetch('/api/outreach/segments').then(r => r.json()),
    ]).then(([campData, segData]) => {
      setCampaigns(campData.campaigns || []);
      setSegments(segData.segments || []);
    }).catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const createCampaign = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/outreach/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          name: newName,
          goal: newGoal,
          segmentIds: selectedSegments,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCampaigns([...campaigns, data.campaign]);
        setNewName('');
        setNewGoal('');
        setSelectedSegments([]);
        setShowCreate(false);
      } else {
        setError(data.error || 'Failed to create campaign');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const toggleSegment = (id: string) => {
    setSelectedSegments(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading campaigns...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Campaigns</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
        >
          {showCreate ? 'Cancel' : 'New Campaign'}
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4 bg-gray-50 dark:bg-gray-800">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Campaign Name</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Q1 State Program Outreach"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Campaign Goal</label>
            <input
              value={newGoal}
              onChange={e => setNewGoal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Introduce PIN platform and schedule demo calls"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Segments</label>
            {segments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No segments available. <Link href="/dashboard/outreach/segments" className="text-blue-600 hover:underline">Discover segments first.</Link>
              </p>
            ) : (
              <div className="space-y-2">
                {segments.map(seg => (
                  <label key={seg.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSegments.includes(seg.id)}
                      onChange={() => toggleSegment(seg.id)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200">{seg.name}</span>
                    <span className={`ml-auto px-1.5 py-0.5 text-xs rounded-full ${
                      seg.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : seg.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {seg.priority}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={createCampaign}
              disabled={creating || !newName.trim() || !newGoal.trim() || selectedSegments.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 && !showCreate ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium mb-2">No campaigns yet</p>
          <p className="text-sm">Create your first campaign to start reaching your audience.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(campaign => {
            const emailCount = Object.keys(campaign.emails).length;
            return (
              <Link
                key={campaign.id}
                href={`/dashboard/outreach/campaigns/${campaign.id}`}
                className="block border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors bg-white dark:bg-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{campaign.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{campaign.goal}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[campaign.status] || ''}`}>
                    {campaign.status}
                  </span>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{campaign.segmentIds.length} segment{campaign.segmentIds.length !== 1 ? 's' : ''}</span>
                  <span>{emailCount} email{emailCount !== 1 ? 's' : ''} drafted</span>
                  <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                  {campaign.sentAt && <span>Sent {new Date(campaign.sentAt).toLocaleDateString()}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
