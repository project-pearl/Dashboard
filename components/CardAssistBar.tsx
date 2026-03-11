'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Lightbulb, MessageSquare } from 'lucide-react';

type FeedbackType = 'bug' | 'improvement' | 'ease-of-use';

interface CardAssistBarProps {
  sectionId: string;
  label: string;
  description?: string;
  userKey?: string;
}

interface TrainingModule {
  id: string;
  title: string;
  takeaway: string;
  detail: string;
  minutes: number;
}

const TRAINING_MODULES: TrainingModule[] = [
  {
    id: 'orient',
    title: 'What You Are Looking At',
    takeaway: 'This page is a decision snapshot, not raw data dump.',
    detail: 'The top cards summarize current status, risk pressure, and where attention is needed first. Treat it like a briefing screen.',
    minutes: 2,
  },
  {
    id: 'filters',
    title: 'How Scope Changes Results',
    takeaway: 'State/jurisdiction filters change the story.',
    detail: 'When you switch scope, all scores, counts, and priorities recalculate for that slice. Always confirm scope before acting.',
    minutes: 2,
  },
  {
    id: 'cards',
    title: 'How To Read Priority Cards',
    takeaway: 'Red/amber cards indicate immediate risk and workflow load.',
    detail: 'Start with high-severity indicators first, then check trend cards to see whether risk is improving or compounding.',
    minutes: 2,
  },
  {
    id: 'actions',
    title: 'What To Do Next',
    takeaway: 'Use this page to decide the next concrete step.',
    detail: 'Pick one high-priority follow-up: inspection routing, permit/compliance closure, or funding/project escalation.',
    minutes: 2,
  },
];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function CardAssistBar({
  sectionId,
  label,
  description,
  userKey = 'anonymous',
}: CardAssistBarProps) {
  const [resolvedUserKey, setResolvedUserKey] = useState(userKey);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('improvement');
  const [feedback, setFeedback] = useState('');
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [completedModules, setCompletedModules] = useState<Record<string, boolean>>({});
  const [activeModuleId, setActiveModuleId] = useState<string>(TRAINING_MODULES[0]?.id || 'orient');

  const explanation = useMemo(() => {
    const trimmed = (description || '').trim();
    if (trimmed) return trimmed;
    return `This card is showing current signals, trends, and decision support for ${label}.`;
  }, [description, label]);

  const plainLanguageSummary = useMemo(() => {
    const base = explanation
      .replace(/jurisdiction/gi, 'area')
      .replace(/compliance/gi, 'whether requirements are being met')
      .replace(/analytics/gi, 'patterns')
      .replace(/impairment/gi, 'water quality problems');
    return `In plain language: ${base} This helps you understand what is okay, what is at risk, and what should be handled next.`;
  }, [explanation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (userKey && userKey !== 'anonymous') {
      setResolvedUserKey(userKey);
      return;
    }
    const fromStorage = window.localStorage.getItem('pin-user-key');
    if (fromStorage) setResolvedUserKey(fromStorage);
  }, [userKey]);

  const trainingStorageKey = `pin-training:${resolvedUserKey}`;
  const feedbackStorageKey = `pin-suggestions:${resolvedUserKey}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = safeParse<Record<string, boolean>>(window.localStorage.getItem(trainingStorageKey), {});
    setCompletedModules(saved);
  }, [trainingStorageKey]);

  const completionPct = Math.round(
    (Object.values(completedModules).filter(Boolean).length / TRAINING_MODULES.length) * 100,
  );

  function toggleModule(moduleId: string) {
    setCompletedModules(prev => {
      const next = { ...prev, [moduleId]: !prev[moduleId] };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(trainingStorageKey, JSON.stringify(next));
      }
      return next;
    });
  }

  function saveSuggestion() {
    if (!feedback.trim() || typeof window === 'undefined') return;
    const existing = safeParse<any[]>(window.localStorage.getItem(feedbackStorageKey), []);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      sectionId,
      label,
      category: feedbackType,
      message: feedback.trim(),
      status: 'new',
    };
    window.localStorage.setItem(feedbackStorageKey, JSON.stringify([entry, ...existing]));
    setFeedback('');
    setFeedbackSaved(true);
    setTimeout(() => setFeedbackSaved(false), 1800);
  }

  return (
    <div data-no-collapse className="mb-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Ask PIN</div>
          <p className="mt-0.5 text-xs text-slate-700">{plainLanguageSummary}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTrainingOpen(v => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Training
          </button>
          <button
            type="button"
            onClick={() => setSuggestionOpen(v => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Suggestion Box
          </button>
        </div>
      </div>

      <div className="mt-2 rounded-md border border-blue-200 bg-white px-2.5 py-2 text-xs text-slate-700">
        <span className="font-semibold text-blue-700">Page purpose:</span>{' '}
        This section is here to give you quick context, highlight risk, and point you to the next best action.
      </div>

      {trainingOpen && (
        <div className="mt-2 rounded-md border border-slate-200 bg-white p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-800">Guided Walkthrough</div>
            <div className="text-xs text-slate-500">{completionPct}% complete</div>
          </div>
          <div className="space-y-1.5">
            {TRAINING_MODULES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setActiveModuleId(m.id);
                  if (!completedModules[m.id]) toggleModule(m.id);
                }}
                className={`w-full text-left rounded border px-2 py-2 text-xs ${
                  activeModuleId === m.id ? 'border-blue-200 bg-blue-50/40' : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-700 font-medium">{m.title} ({m.minutes}m)</span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <input
                      type="checkbox"
                      checked={!!completedModules[m.id]}
                      onChange={() => {
                        setActiveModuleId(m.id);
                        toggleModule(m.id);
                      }}
                      className="h-3.5 w-3.5"
                    />
                    {completedModules[m.id] && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  </span>
                </div>
                {activeModuleId === m.id && (
                  <div className="mt-1.5 space-y-1">
                    <div className="text-xs font-semibold text-blue-700">{m.takeaway}</div>
                    <div className="text-xs text-slate-600 leading-relaxed">{m.detail}</div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {suggestionOpen && (
        <div className="mt-2 rounded-md border border-slate-200 bg-white p-2.5">
          <div className="mb-1.5 text-xs font-semibold text-slate-800">Feedback</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
            <select
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
              className="h-8 rounded-md border border-slate-200 px-2 text-xs text-slate-700"
            >
              <option value="bug">Bug</option>
              <option value="improvement">Improvement</option>
              <option value="ease-of-use">Ease of Use</option>
            </select>
            <div className="flex gap-2">
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share bug, improvement, or usability feedback"
                className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={saveSuggestion}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </div>
          {feedbackSaved && (
            <div className="mt-1.5 text-xs text-emerald-700">Feedback saved. Thank you.</div>
          )}
        </div>
      )}
    </div>
  );
}
