'use client';

import { useState, useEffect, useCallback } from 'react';
import { csrfHeaders } from '@/lib/csrf';
import type { BusinessProfile } from '@/lib/outreach/types';

const STEPS = ['Basics', 'Value Props', 'Stats', 'Differentiators', 'Review'] as const;

export default function BusinessProfileWizard() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [website, setWebsite] = useState('');
  const [valueProps, setValueProps] = useState<string[]>(['']);
  const [stats, setStats] = useState<{ label: string; value: string }[]>([{ label: '', value: '' }]);
  const [differentiators, setDifferentiators] = useState<string[]>(['']);

  useEffect(() => {
    fetch('/api/outreach/profile')
      .then(r => r.json())
      .then(d => {
        if (d.profile) {
          const p: BusinessProfile = d.profile;
          setName(p.name);
          setTagline(p.tagline);
          setWebsite(p.website || '');
          setValueProps(p.valueProps.length ? p.valueProps : ['']);
          setStats(p.stats.length ? p.stats : [{ label: '', value: '' }]);
          setDifferentiators(p.differentiators.length ? p.differentiators : ['']);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/outreach/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          name,
          tagline,
          website: website || undefined,
          valueProps: valueProps.filter(v => v.trim()),
          stats: stats.filter(s => s.label.trim() && s.value.trim()),
          differentiators: differentiators.filter(d => d.trim()),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Profile saved!');
      } else {
        setMessage(data.error || 'Failed to save');
      }
    } catch {
      setMessage('Network error');
    } finally {
      setSaving(false);
    }
  }, [name, tagline, website, valueProps, stats, differentiators]);

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading profile...</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Step indicators */}
      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              i === step
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : i < step
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Step 0: Basics */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Business Basics</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="PEARL Intelligence Network"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tagline</label>
            <input
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Real-time water quality intelligence for everyone"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website (optional)</label>
            <input
              value={website}
              onChange={e => setWebsite(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="https://pin-dashboard.com"
            />
          </div>
        </div>
      )}

      {/* Step 1: Value Props */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Value Propositions</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">What makes your product valuable to customers?</p>
          {valueProps.map((vp, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={vp}
                onChange={e => {
                  const next = [...valueProps];
                  next[i] = e.target.value;
                  setValueProps(next);
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder={`Value proposition ${i + 1}`}
              />
              {valueProps.length > 1 && (
                <button
                  onClick={() => setValueProps(valueProps.filter((_, j) => j !== i))}
                  className="px-2 text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setValueProps([...valueProps, ''])}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            + Add value proposition
          </button>
        </div>
      )}

      {/* Step 2: Stats */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Key Statistics</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Numbers that demonstrate your platform&apos;s capabilities.</p>
          {stats.map((stat, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={stat.label}
                onChange={e => {
                  const next = [...stats];
                  next[i] = { ...next[i], label: e.target.value };
                  setStats(next);
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Label (e.g., States monitored)"
              />
              <input
                value={stat.value}
                onChange={e => {
                  const next = [...stats];
                  next[i] = { ...next[i], value: e.target.value };
                  setStats(next);
                }}
                className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Value (e.g., 50+)"
              />
              {stats.length > 1 && (
                <button
                  onClick={() => setStats(stats.filter((_, j) => j !== i))}
                  className="px-2 text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setStats([...stats, { label: '', value: '' }])}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            + Add statistic
          </button>
        </div>
      )}

      {/* Step 3: Differentiators */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Competitive Differentiators</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">What sets you apart from alternatives?</p>
          {differentiators.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={d}
                onChange={e => {
                  const next = [...differentiators];
                  next[i] = e.target.value;
                  setDifferentiators(next);
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder={`Differentiator ${i + 1}`}
              />
              {differentiators.length > 1 && (
                <button
                  onClick={() => setDifferentiators(differentiators.filter((_, j) => j !== i))}
                  className="px-2 text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setDifferentiators([...differentiators, ''])}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            + Add differentiator
          </button>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review Profile</h2>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3 text-sm">
            <div><span className="font-medium text-gray-700 dark:text-gray-300">Name:</span> {name}</div>
            <div><span className="font-medium text-gray-700 dark:text-gray-300">Tagline:</span> {tagline}</div>
            {website && <div><span className="font-medium text-gray-700 dark:text-gray-300">Website:</span> {website}</div>}
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Value Props:</span>
              <ul className="list-disc list-inside mt-1 text-gray-600 dark:text-gray-400">
                {valueProps.filter(v => v.trim()).map((v, i) => <li key={i}>{v}</li>)}
              </ul>
            </div>
            {stats.filter(s => s.label.trim()).length > 0 && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Stats:</span>
                <ul className="list-disc list-inside mt-1 text-gray-600 dark:text-gray-400">
                  {stats.filter(s => s.label.trim()).map((s, i) => <li key={i}>{s.label}: {s.value}</li>)}
                </ul>
              </div>
            )}
            {differentiators.filter(d => d.trim()).length > 0 && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Differentiators:</span>
                <ul className="list-disc list-inside mt-1 text-gray-600 dark:text-gray-400">
                  {differentiators.filter(d => d.trim()).map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation + Save */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md disabled:opacity-50"
        >
          Back
        </button>
        <div className="flex gap-3 items-center">
          {message && (
            <span className={`text-sm ${message.includes('saved') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </span>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              Next
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving || !name.trim() || !tagline.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
