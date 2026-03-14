'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessageSquare, Send, Loader2, HelpCircle } from 'lucide-react';
import { csrfHeaders } from '@/lib/csrf';
import { UNIVERSAL_SUGGESTED_QUESTIONS } from '@/lib/askPinUniversalQuestions';

// ── Types ───────────────────────────────────────────────────────────────────

interface AskPinUniversalCardProps {
  role: string;
  state?: string;
  jurisdiction?: string;
  isMilitary?: boolean;
}

interface QAPair {
  question: string;
  answer: string;
  sources: string[];
}

// ── Component ───────────────────────────────────────────────────────────────

export function AskPinUniversalCard({ role, state, jurisdiction, isMilitary }: AskPinUniversalCardProps) {
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState<QAPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chipKey = (role === 'Federal' && isMilitary) ? 'Federal+Military' : role;
  const chips = UNIVERSAL_SUGGESTED_QUESTIONS[chipKey] || UNIVERSAL_SUGGESTED_QUESTIONS.Federal;

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation, loading]);

  const askQuestion = useCallback(async (q: string) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError('');

    // Build conversation history (last 5 pairs = 10 messages)
    const history = conversation.slice(-5).flatMap(pair => [
      { role: 'user' as const, content: pair.question },
      { role: 'assistant' as const, content: pair.answer },
    ]);

    try {
      const res = await fetch('/api/ai/ask-pin-universal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          question: q,
          role,
          state,
          jurisdiction,
          isMilitary,
          conversationHistory: history.length ? history : undefined,
        }),
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

      setConversation(prev => [...prev, {
        question: q,
        answer: data.answer || '',
        sources: data.sources || [],
      }]);
      setQuestion('');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loading, role, state, jurisdiction, isMilitary, conversation]);

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
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
          Ask PIN
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="ml-auto text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="About Ask PIN"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </CardTitle>
        <CardDescription>
          Ask anything about your dashboard — answers grounded in live data
        </CardDescription>
        {showInfo && (
          <p className="text-xs text-slate-500 mt-1">
            PIN answers are generated using live platform data including national water quality summaries,
            source health, sentinel alerts, and more. Responses are AI-generated and should be verified
            against source data before making decisions.
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Suggested question chips */}
        {conversation.length === 0 && (
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
        )}

        {/* Conversation history */}
        {(conversation.length > 0 || loading) && (
          <div ref={scrollRef} className="max-h-96 overflow-y-auto space-y-3">
            {conversation.map((pair, i) => (
              <div key={i} className="space-y-2">
                {/* User question */}
                <div className="flex justify-end">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 max-w-[85%]">
                    <p className="text-sm text-indigo-900">{pair.question}</p>
                  </div>
                </div>
                {/* PIN answer */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{pair.answer}</p>
                  {pair.sources.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
                      <span className="text-2xs text-slate-400 uppercase tracking-wider">Sources:</span>
                      {pair.sources.map((s) => (
                        <span key={s} className="text-2xs px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading state */}
            {loading && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing your data...
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={conversation.length ? 'Ask a follow-up...' : 'Type your question...'}
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
      </CardContent>
    </Card>
  );
}
