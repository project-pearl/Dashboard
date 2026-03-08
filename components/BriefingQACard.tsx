'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessageSquare, Send, Loader2 } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface BriefingQACardProps {
  role: 'Federal' | 'State' | 'MS4' | 'Local';
  state?: string;
  jurisdiction?: string;
  isMilitary?: boolean;
}

// ── Suggested questions per role ─────────────────────────────────────────────

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  Federal: [
    'What do I need to know right now?',
    'What changed since yesterday?',
    'Critical compliance deadlines this week?',
    'Which states need immediate attention?',
  ],
  'Federal+Military': [
    'Are there threats to my installation?',
    'What CISA advisories affect water infrastructure?',
    'What is my installation\'s compliance status?',
    'Are there contamination risks near my base?',
  ],
  State: [
    'What changed in my state since yesterday?',
    'Emerging compliance issues?',
    'What TMDL deadlines are approaching?',
    'Which systems have new violations?',
  ],
  Local: [
    'What do I need to know about my jurisdiction?',
    'Have any permits changed status?',
    'New impairments in my area?',
    'What deadlines should I prepare for?',
  ],
  MS4: [
    'What do I need to know about my jurisdiction?',
    'Have any permits changed status?',
    'New impairments in my area?',
    'What deadlines should I prepare for?',
  ],
};

// ── Component ───────────────────────────────────────────────────────────────

export function BriefingQACard({ role, state, jurisdiction, isMilitary }: BriefingQACardProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const chipKey = (role === 'Federal' && isMilitary) ? 'Federal+Military' : role;
  const chips = SUGGESTED_QUESTIONS[chipKey] || SUGGESTED_QUESTIONS.Federal;

  const askQuestion = useCallback(async (q: string) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setAnswer('');
    setSources([]);
    setError('');

    try {
      const res = await fetch('/api/ai/briefing-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, role, state, jurisdiction, isMilitary }),
      });

      if (res.status === 429) {
        setError('Too many requests. Please wait a moment.');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to get answer');
        return;
      }

      setAnswer(data.answer || '');
      setSources(data.sources || []);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loading, role, state, jurisdiction, isMilitary]);

  const handleChipClick = (q: string) => {
    setQuestion(q);
    askQuestion(q);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askQuestion(question);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
          Ask Your Briefing
        </CardTitle>
        <CardDescription>
          Ask a question &mdash; answered from your role&apos;s live data context
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Suggested question chips */}
        <div className="flex flex-wrap gap-2">
          {chips.map((q) => (
            <button
              key={q}
              onClick={() => handleChipClick(q)}
              disabled={loading}
              className="px-3 py-1.5 text-xs rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Freeform input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Or type your question..."
            disabled={loading}
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Ask
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Answer */}
        {(answer || loading) && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing your briefing data...
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{answer}</p>
                {sources.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Sources:</span>
                    {sources.map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
