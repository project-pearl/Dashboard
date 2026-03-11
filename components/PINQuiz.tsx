'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle, XCircle, ChevronRight, RotateCcw, Flame, BookOpen } from 'lucide-react';
import {
  QUIZ_BANK, QUIZ_CATEGORIES, getDefaultProgress, getQuestionsByCategory,
  type QuizQuestion, type QuizCategory, type CardState, type QuizProgress,
} from '@/lib/pinQuizBank';

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pin-quiz-progress';
const DAY_MS = 86_400_000;

const CATEGORY_COLORS: Record<QuizCategory, string> = {
  'data-sources': 'bg-blue-500',
  architecture:   'bg-violet-500',
  science:        'bg-emerald-500',
  regulations:    'bg-amber-500',
  roles:          'bg-rose-500',
  endpoints:      'bg-cyan-500',
  monitoring:     'bg-indigo-500',
  emerging:       'bg-orange-500',
};

const CATEGORY_BG: Record<QuizCategory, string> = {
  'data-sources': 'bg-blue-50 text-blue-700 border-blue-200',
  architecture:   'bg-violet-50 text-violet-700 border-violet-200',
  science:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  regulations:    'bg-amber-50 text-amber-700 border-amber-200',
  roles:          'bg-rose-50 text-rose-700 border-rose-200',
  endpoints:      'bg-cyan-50 text-cyan-700 border-cyan-200',
  monitoring:     'bg-indigo-50 text-indigo-700 border-indigo-200',
  emerging:       'bg-orange-50 text-orange-700 border-orange-200',
};

const DIFFICULTY_LABELS = ['', 'Basic', 'Intermediate', 'Expert'] as const;
const DIFFICULTY_STARS  = ['', '\u2605\u2606\u2606', '\u2605\u2605\u2606', '\u2605\u2605\u2605'] as const;

// ─── SM-2 Engine ────────────────────────────────────────────────────────────

function newCard(): CardState {
  return { easeFactor: 2.5, interval: 1, repetitions: 0, nextReview: 0, lastScore: 0 };
}

function updateCard(card: CardState, score: number): CardState {
  const c = { ...card, lastScore: score };
  if (score < 3) {
    // Wrong — reset
    c.repetitions = 0;
    c.interval = 1;
    c.easeFactor = Math.max(1.3, c.easeFactor - 0.2);
  } else {
    c.repetitions += 1;
    if (c.repetitions === 1) {
      c.interval = 1;
    } else if (c.repetitions === 2) {
      c.interval = 3;
    } else {
      c.interval = Math.round(c.interval * c.easeFactor);
    }
    c.easeFactor = Math.max(
      1.3,
      c.easeFactor + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02)),
    );
    if (score === 5) c.interval = Math.round(c.interval * 1.3);
  }
  c.nextReview = Date.now() + c.interval * DAY_MS;
  return c;
}

// ─── Persistence ────────────────────────────────────────────────────────────

function loadProgress(): QuizProgress {
  if (typeof window === 'undefined') return getDefaultProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as QuizProgress;
  } catch { /* ignore */ }
  return getDefaultProgress();
}

function saveProgress(p: QuizProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch { /* quota exceeded — silently ignore */ }
}

// ─── Question Selection ─────────────────────────────────────────────────────

function selectNextQuestion(
  pool: QuizQuestion[],
  cards: Record<string, CardState>,
): QuizQuestion | null {
  if (pool.length === 0) return null;
  const now = Date.now();

  // Due for review (past nextReview)
  const due = pool.filter(q => {
    const c = cards[q.id];
    return c && c.nextReview <= now && c.repetitions > 0;
  });
  if (due.length > 0) {
    // Prioritize lowest ease factor (hardest)
    due.sort((a, b) => (cards[a.id]?.easeFactor ?? 2.5) - (cards[b.id]?.easeFactor ?? 2.5));
    return due[0];
  }

  // New questions (never seen)
  const unseen = pool.filter(q => !cards[q.id]);
  if (unseen.length > 0) {
    // Randomize to keep it fresh
    return unseen[Math.floor(Math.random() * unseen.length)];
  }

  // Recently failed (repetitions === 0)
  const failed = pool.filter(q => {
    const c = cards[q.id];
    return c && c.repetitions === 0;
  });
  if (failed.length > 0) {
    failed.sort((a, b) => (cards[a.id]?.nextReview ?? 0) - (cards[b.id]?.nextReview ?? 0));
    return failed[0];
  }

  // All mastered — pick the one due soonest
  const sorted = [...pool].sort(
    (a, b) => (cards[a.id]?.nextReview ?? 0) - (cards[b.id]?.nextReview ?? 0),
  );
  return sorted[0];
}

// ─── Component ──────────────────────────────────────────────────────────────

type Phase = 'question' | 'feedback';

export default function PINQuiz() {
  const [progress, setProgress] = useState<QuizProgress>(getDefaultProgress);
  const [categoryFilter, setCategoryFilter] = useState<QuizCategory | 'all'>('all');
  const [currentQ, setCurrentQ] = useState<QuizQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('question');
  const [wasCorrect, setWasCorrect] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadProgress();
    setProgress(loaded);
    setMounted(true);
  }, []);

  // Pick first question after mount
  useEffect(() => {
    if (!mounted) return;
    const pool = categoryFilter === 'all' ? QUIZ_BANK : getQuestionsByCategory(categoryFilter);
    const next = selectNextQuestion(pool, progress.cards);
    setCurrentQ(next);
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute stats
  const totalQuestions = QUIZ_BANK.length;

  const mastered = useMemo(() => {
    let count = 0;
    for (const q of QUIZ_BANK) {
      const c = progress.cards[q.id];
      if (c && c.repetitions >= 2) count++;
    }
    return count;
  }, [progress.cards]);

  const dueCount = useMemo(() => {
    const now = Date.now();
    const pool = categoryFilter === 'all' ? QUIZ_BANK : getQuestionsByCategory(categoryFilter);
    return pool.filter(q => {
      const c = progress.cards[q.id];
      if (!c) return true; // unseen counts as due
      return c.nextReview <= now;
    }).length;
  }, [progress.cards, categoryFilter]);

  const categoryStats = useMemo(() => {
    return QUIZ_CATEGORIES.map(cat => {
      const qs = getQuestionsByCategory(cat.id);
      const m = progress.stats.categoryMastery[cat.id] || { answered: 0, correct: 0 };
      const pct = m.answered > 0 ? Math.round((m.correct / m.answered) * 100) : 0;
      return { ...cat, total: qs.length, ...m, pct };
    });
  }, [progress.stats.categoryMastery]);

  // Advance to next question
  const advanceQuestion = useCallback((updatedProgress: QuizProgress) => {
    const pool = categoryFilter === 'all' ? QUIZ_BANK : getQuestionsByCategory(categoryFilter);
    const next = selectNextQuestion(pool, updatedProgress.cards);
    setCurrentQ(next);
    setSelectedOption(null);
    setPhase('question');
  }, [categoryFilter]);

  // Submit answer
  const handleSubmit = useCallback(() => {
    if (selectedOption === null || !currentQ) return;
    const correct = selectedOption === currentQ.correctIndex;
    setWasCorrect(correct);
    setPhase('feedback');

    // Update progress (don't update card state yet — wait for self-rating)
    setProgress(prev => {
      const catM = { ...prev.stats.categoryMastery };
      const prevCat = catM[currentQ.category] || { answered: 0, correct: 0 };
      catM[currentQ.category] = {
        answered: prevCat.answered + 1,
        correct: prevCat.correct + (correct ? 1 : 0),
      };
      const updated: QuizProgress = {
        ...prev,
        stats: {
          ...prev.stats,
          totalAnswered: prev.stats.totalAnswered + 1,
          totalCorrect: prev.stats.totalCorrect + (correct ? 1 : 0),
          streakCurrent: correct ? prev.stats.streakCurrent + 1 : 0,
          streakBest: correct
            ? Math.max(prev.stats.streakBest, prev.stats.streakCurrent + 1)
            : prev.stats.streakBest,
          categoryMastery: catM as Record<QuizCategory, { answered: number; correct: number }>,
          lastSession: new Date().toISOString(),
        },
      };
      saveProgress(updated);
      return updated;
    });
    setTodayCount(c => c + 1);
  }, [selectedOption, currentQ]);

  // Self-rate (after seeing feedback)
  const handleRate = useCallback((score: number) => {
    if (!currentQ) return;
    setProgress(prev => {
      const card = prev.cards[currentQ.id] || newCard();
      const updated: QuizProgress = {
        ...prev,
        cards: { ...prev.cards, [currentQ.id]: updateCard(card, score) },
      };
      saveProgress(updated);
      advanceQuestion(updated);
      return updated;
    });
  }, [currentQ, advanceQuestion]);

  // Handle "Next" for wrong answers (auto-rate as score=1)
  const handleNextAfterWrong = useCallback(() => {
    if (!currentQ) return;
    setProgress(prev => {
      const card = prev.cards[currentQ.id] || newCard();
      const updated: QuizProgress = {
        ...prev,
        cards: { ...prev.cards, [currentQ.id]: updateCard(card, 1) },
      };
      saveProgress(updated);
      advanceQuestion(updated);
      return updated;
    });
  }, [currentQ, advanceQuestion]);

  // Category filter change
  const handleCategoryChange = useCallback((val: string) => {
    const filter = val as QuizCategory | 'all';
    setCategoryFilter(filter);
    const pool = filter === 'all' ? QUIZ_BANK : getQuestionsByCategory(filter);
    setCurrentQ(selectNextQuestion(pool, progress.cards));
    setSelectedOption(null);
    setPhase('question');
  }, [progress.cards]);

  // Reset progress
  const handleReset = useCallback(() => {
    const fresh = getDefaultProgress();
    setProgress(fresh);
    saveProgress(fresh);
    setTodayCount(0);
    const pool = categoryFilter === 'all' ? QUIZ_BANK : getQuestionsByCategory(categoryFilter);
    setCurrentQ(selectNextQuestion(pool, fresh.cards));
    setSelectedOption(null);
    setPhase('question');
  }, [categoryFilter]);

  // Question index (for display)
  const qIndex = currentQ ? QUIZ_BANK.findIndex(q => q.id === currentQ.id) + 1 : 0;

  if (!mounted) return null;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-800">PIN Knowledge Quiz</h2>
          <Badge variant="outline" className="text-xs">
            {totalQuestions} questions
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {QUIZ_CATEGORIES.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 px-2 text-xs text-slate-500">
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* ── Overall Progress ── */}
      <Card className="border-slate-200">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center justify-between text-sm text-slate-600 mb-1.5">
            <span>Overall Mastery</span>
            <span className="font-medium">{mastered}/{totalQuestions} mastered ({totalQuestions > 0 ? Math.round((mastered / totalQuestions) * 100) : 0}%)</span>
          </div>
          <Progress value={totalQuestions > 0 ? (mastered / totalQuestions) * 100 : 0} className="h-2.5" />
        </CardContent>
      </Card>

      {/* ── Category Mastery Grid ── */}
      <Card className="border-slate-200">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {categoryStats.map(cat => (
              <div key={cat.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 truncate">{cat.label}</span>
                  <span className={`text-xs font-semibold ${
                    cat.pct >= 80 ? 'text-emerald-600' : cat.pct >= 50 ? 'text-amber-600' : 'text-slate-400'
                  }`}>
                    {cat.pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      cat.pct >= 80 ? 'bg-emerald-500' : cat.pct >= 50 ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Question Card ── */}
      {currentQ ? (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/40 via-white to-slate-50/40">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-2xs border ${CATEGORY_BG[currentQ.category]}`}>
                  {QUIZ_CATEGORIES.find(c => c.id === currentQ.category)?.label}
                </Badge>
                <span className="text-2xs text-slate-400" title={DIFFICULTY_LABELS[currentQ.difficulty]}>
                  {DIFFICULTY_STARS[currentQ.difficulty]}
                </span>
              </div>
              <span className="text-xs text-slate-400">Q {qIndex}/{totalQuestions}</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm font-medium text-slate-800 mb-4 leading-relaxed">
              {currentQ.question}
            </p>

            {phase === 'question' ? (
              <>
                <RadioGroup
                  value={selectedOption !== null ? String(selectedOption) : undefined}
                  onValueChange={(v) => setSelectedOption(Number(v))}
                  className="space-y-2"
                >
                  {currentQ.options.map((opt, i) => (
                    <label
                      key={i}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        selectedOption === i
                          ? 'border-blue-400 bg-blue-50/60'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <RadioGroupItem value={String(i)} className="mt-0.5" />
                      <span className="text-sm text-slate-700">{opt}</span>
                    </label>
                  ))}
                </RadioGroup>
                <Button
                  onClick={handleSubmit}
                  disabled={selectedOption === null}
                  className="mt-4 w-full"
                  size="sm"
                >
                  Submit Answer
                </Button>
              </>
            ) : (
              /* ── Feedback Phase ── */
              <div className="space-y-3">
                {/* Show options with correct/wrong indicators */}
                <div className="space-y-2">
                  {currentQ.options.map((opt, i) => {
                    const isCorrect = i === currentQ.correctIndex;
                    const isSelected = i === selectedOption;
                    let border = 'border-slate-100 bg-slate-50/40';
                    if (isCorrect) border = 'border-emerald-300 bg-emerald-50';
                    else if (isSelected && !isCorrect) border = 'border-red-300 bg-red-50';

                    return (
                      <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg border ${border}`}>
                        {isCorrect ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                        ) : isSelected ? (
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        ) : (
                          <div className="h-4 w-4 mt-0.5 shrink-0" />
                        )}
                        <span className={`text-sm ${isCorrect ? 'text-emerald-800 font-medium' : isSelected && !isCorrect ? 'text-red-700' : 'text-slate-500'}`}>
                          {opt}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                <div className={`rounded-lg border p-3 ${wasCorrect ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5">{wasCorrect ? '\u2705' : '\u274C'}</span>
                    <div className="text-sm text-slate-700 space-y-1">
                      <p className="font-medium">
                        {wasCorrect ? 'Correct!' : `Not quite. The correct answer is: "${currentQ.options[currentQ.correctIndex]}"`}
                      </p>
                      <p className="text-slate-600 leading-relaxed">{currentQ.explanation}</p>
                      {currentQ.source && (
                        <p className="text-xs text-slate-400 mt-1">Source: {currentQ.source}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Self-rating or Next */}
                {wasCorrect ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 mr-1">How did it feel?</span>
                    <Button variant="outline" size="sm" className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => handleRate(3)}>
                      Hard
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => handleRate(4)}>
                      Good
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => handleRate(5)}>
                      Easy
                    </Button>
                  </div>
                ) : (
                  <Button onClick={handleNextAfterWrong} className="w-full" size="sm">
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 text-sm">No questions available for this category.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Stats Footer ── */}
      <Card className="border-slate-200">
        <CardContent className="py-2.5 px-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              <span>Streak: <span className="font-semibold text-slate-700">{progress.stats.streakCurrent}</span></span>
              {progress.stats.streakBest > 0 && (
                <span className="text-slate-400 ml-1">(best: {progress.stats.streakBest})</span>
              )}
            </div>
            <span>Today: <span className="font-semibold text-slate-700">{todayCount}</span></span>
            <span>Due: <span className="font-semibold text-blue-600">{dueCount}</span></span>
            <span>Accuracy: <span className="font-semibold text-slate-700">
              {progress.stats.totalAnswered > 0
                ? Math.round((progress.stats.totalCorrect / progress.stats.totalAnswered) * 100)
                : 0}%
            </span></span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
