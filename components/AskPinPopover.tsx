'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Loader2, MessageSquare, Send } from 'lucide-react';
import { getKB, type SectionKB } from '@/lib/askPinKB';
import { csrfHeaders } from '@/lib/csrf';

interface AskPinPopoverProps {
  sectionId: string;
  label: string;
  userRole: string;
  onClose: () => void;
}

export function AskPinPopover({ sectionId, label, userRole, onClose }: AskPinPopoverProps) {
  const kb = getKB(sectionId, label);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [kbAnswer, setKbAnswer] = useState<string | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAskAi, setShowAskAi] = useState(false);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Focus input on open
  useEffect(() => { inputRef.current?.focus(); }, []);

  // KB keyword search
  const searchKB = useCallback((q: string): string | null => {
    const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return null;
    let bestMatch: { a: string; score: number } | null = null;
    for (const faq of kb.faq) {
      const score = faq.keywords.filter(kw => words.some(w => w.includes(kw) || kw.includes(w))).length;
      if (score >= 2 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { a: faq.a, score };
      }
    }
    return bestMatch?.a ?? null;
  }, [kb.faq]);

  const handleSubmit = useCallback(() => {
    const q = question.trim();
    if (!q) return;
    // Reset previous answers
    setAiAnswer(null);
    setShowAskAi(false);

    const match = searchKB(q);
    if (match) {
      setKbAnswer(match);
      setShowAskAi(false);
    } else {
      setKbAnswer(null);
      setShowAskAi(true);
    }
  }, [question, searchKB]);

  const handleAskAi = useCallback(async () => {
    setAiLoading(true);
    setShowAskAi(false);
    try {
      const res = await fetch('/api/ai/ask-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          sectionId,
          label,
          question: question.trim(),
          role: userRole,
          kbContext: kb.explanation,
        }),
      });
      const data = await res.json();
      setAiAnswer(data.answer || data.error || 'No answer received.');
    } catch {
      setAiAnswer('Unable to reach AI service. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }, [sectionId, label, question, userRole, kb.explanation]);

  return (
    <div
      ref={ref}
      data-no-collapse
      className="absolute top-10 right-2 z-50 w-80 max-h-[28rem] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl text-xs"
      style={{ scrollbarWidth: 'thin' }}
    >
      <div className="p-3 space-y-3">
        {/* ── Explanation ─────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 mb-1">
            <span>What This Card Shows</span>
          </div>
          <p className="text-slate-700 leading-relaxed">{kb.explanation}</p>
        </div>

        {/* ── Look For ────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 mb-1">
            <span>What To Look For</span>
          </div>
          <p className="text-slate-700 leading-relaxed">{kb.lookFor}</p>
        </div>

        {/* ── Action ──────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
            <span>What Action To Take</span>
          </div>
          <p className="text-slate-700 leading-relaxed">{kb.action}</p>
        </div>

        {/* ── FAQ Accordion ───────────────────────────────── */}
        {kb.faq.length > 0 && (
          <div>
            <div className="border-t border-slate-100 pt-2 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Common Questions</span>
            </div>
            <div className="space-y-1">
              {kb.faq.map((faq, i) => (
                <div key={i} className="rounded border border-slate-100">
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    className="flex items-center gap-1 w-full text-left px-2 py-1.5 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRight className={`h-3 w-3 text-slate-400 shrink-0 transition-transform ${expandedFaq === i ? 'rotate-90' : ''}`} />
                    <span className="text-slate-700 font-medium">{faq.q}</span>
                  </button>
                  {expandedFaq === i && (
                    <div className="px-2 pb-2 pl-6 text-slate-600 leading-relaxed">{faq.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Question Input ──────────────────────────────── */}
        <div className="border-t border-slate-100 pt-2">
          <div className="flex gap-1.5">
            <input
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="Ask a question..."
              className="flex-1 h-7 rounded-md border border-slate-200 px-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-300"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!question.trim()}
              className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              title="Search"
            >
              <Send className="h-3 w-3 text-slate-500" />
            </button>
          </div>

          {/* KB match answer */}
          {kbAnswer && (
            <div className="mt-2 rounded-md border border-blue-100 bg-blue-50/50 p-2 text-slate-700 leading-relaxed">
              {kbAnswer}
            </div>
          )}

          {/* Ask AI button */}
          {showAskAi && (
            <div className="mt-2">
              <p className="text-slate-500 mb-1.5">No pre-written answer found.</p>
              <button
                type="button"
                onClick={handleAskAi}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                Ask AI
              </button>
            </div>
          )}

          {/* AI loading */}
          {aiLoading && (
            <div className="mt-2 flex items-center gap-1.5 text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking...
            </div>
          )}

          {/* AI answer */}
          {aiAnswer && (
            <div className="mt-2">
              <div className="rounded-md border border-violet-100 bg-violet-50/50 p-2 text-slate-700 leading-relaxed">
                {aiAnswer}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Powered by AI &middot; may be inaccurate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
