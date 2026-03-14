'use client';

import { useState } from 'react';
import { csrfHeaders } from '@/lib/csrf';
import type { EmailDraft } from '@/lib/outreach/types';
import EmailPreview from './EmailPreview';

interface Props {
  draft: EmailDraft;
  campaignId: string;
  onUpdate: (draft: EmailDraft) => void;
}

export default function EmailEditor({ draft, campaignId, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaignId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ segmentId: draft.segmentId }),
      });
      const data = await res.json();
      if (data.html) {
        setPreviewHtml(data.html);
        setPreviewSubject(data.subject);
        setActiveTab('preview');
      }
    } catch { /* ignore */ }
    finally { setLoadingPreview(false); }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch('/api/outreach/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          segmentId: draft.segmentId,
          campaignGoal: 'Introduce platform and schedule demo',
        }),
      });
      const data = await res.json();
      if (data.success && data.draft) {
        onUpdate({ ...data.draft, version: draft.version + 1 });
      }
    } catch { /* ignore */ }
    finally { setRegenerating(false); }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button
          onClick={() => setActiveTab('edit')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'edit'
              ? 'text-blue-600 border-b-2 border-blue-500'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => { setActiveTab('preview'); if (!previewHtml) loadPreview(); }}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'preview'
              ? 'text-blue-600 border-b-2 border-blue-500'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Preview
        </button>
        <div className="flex-1" />
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="px-3 py-1 m-1 text-xs font-medium text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-700 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50"
        >
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>

      {activeTab === 'edit' ? (
        <div className="p-4 space-y-4">
          {/* Subject line picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subject Line (pick one)
            </label>
            <div className="space-y-2">
              {draft.subjectLines.map((subj, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="subject"
                    checked={draft.selectedSubject === i}
                    onChange={() => onUpdate({ ...draft, selectedSubject: i })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">{subj}</span>
                </label>
              ))}
            </div>
          </div>

          {/* HTML body editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Body (HTML)
            </label>
            <textarea
              value={draft.htmlBody}
              onChange={e => onUpdate({ ...draft, htmlBody: e.target.value })}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
            />
          </div>

          {/* Plain text body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Plain Text Version
            </label>
            <textarea
              value={draft.textBody}
              onChange={e => onUpdate({ ...draft, textBody: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
            />
          </div>

          {/* Personalization tokens info */}
          {draft.personalizationTokens.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Tokens:</span>{' '}
              {draft.personalizationTokens.join(', ')}
            </div>
          )}

          <div className="text-xs text-gray-400 dark:text-gray-500">
            Version {draft.version} &middot; Generated {new Date(draft.generatedAt).toLocaleString()}
          </div>
        </div>
      ) : (
        <div className="p-4">
          {loadingPreview ? (
            <div className="text-center py-8 text-gray-500 animate-pulse">Loading preview...</div>
          ) : previewHtml ? (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">Subject: </span>
                <span className="text-gray-800 dark:text-gray-200">{previewSubject}</span>
              </div>
              <EmailPreview html={previewHtml} />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <button onClick={loadPreview} className="text-blue-600 hover:text-blue-800">
                Load preview
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
