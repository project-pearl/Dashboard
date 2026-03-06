'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Lightbulb, MessageSquare, Send } from 'lucide-react';

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
  minutes: number;
}

const TRAINING_MODULES: TrainingModule[] = [
  { id: 'orient', title: 'Platform Orientation', minutes: 5 },
  { id: 'filters', title: 'Filters and Scope Controls', minutes: 7 },
  { id: 'cards', title: 'Card Reading and Prioritization', minutes: 6 },
  { id: 'actions', title: 'Actions and Follow-ups', minutes: 6 },
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
  const [question, setQuestion] = useState('');
  const [copied, setCopied] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('improvement');
  const [feedback, setFeedback] = useState('');
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [completedModules, setCompletedModules] = useState<Record<string, boolean>>({});

  const explanation = useMemo(() => {
    const trimmed = (description || '').trim();
    if (trimmed) return trimmed;
    return `This card is showing current signals, trends, and decision support for ${label}.`;
  }, [description, label]);

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

  async function handleAskPin() {
    const prompt = [
      `Card: ${label} (${sectionId})`,
      `Context: ${explanation}`,
      `Question: ${question.trim() || 'What should I focus on first in this card?'}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // noop
    }
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
          <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Ask PIN</div>
          <p className="mt-0.5 text-xs text-slate-700">{explanation}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTrainingOpen(v => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Training
          </button>
          <button
            type="button"
            onClick={() => setSuggestionOpen(v => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Suggestion Box
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this card (copied to clipboard for PIN)"
          className="h-8 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-300"
        />
        <button
          type="button"
          onClick={handleAskPin}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Send className="h-3.5 w-3.5" />
          {copied ? 'Prompt Copied' : 'Ask PIN'}
        </button>
      </div>

      {trainingOpen && (
        <div className="mt-2 rounded-md border border-slate-200 bg-white p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-800">Training Path</div>
            <div className="text-[11px] text-slate-500">{completionPct}% complete</div>
          </div>
          <div className="space-y-1.5">
            {TRAINING_MODULES.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center justify-between rounded border border-slate-100 px-2 py-1.5 text-xs">
                <span className="text-slate-700">{m.title} ({m.minutes}m)</span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <input
                    type="checkbox"
                    checked={!!completedModules[m.id]}
                    onChange={() => toggleModule(m.id)}
                    className="h-3.5 w-3.5"
                  />
                  {completedModules[m.id] && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                </span>
              </label>
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
            <div className="mt-1.5 text-[11px] text-emerald-700">Feedback saved. Thank you.</div>
          )}
        </div>
      )}
    </div>
  );
}
