// lib/scoringUtils.ts
// Centralized scoring utilities — single source of truth for all grading,
// alert-level mapping, and ecological/EJ styling across the dashboard.

export { scoreToLetter, type GradeLetter } from './waterQualityScore';
import { scoreToLetter } from './waterQualityScore';
import { ecoScoreLabel } from './ecologicalSensitivity';
import { ejScoreLabel } from './ejVulnerability';

// ── PEARL-derived styled grade (A+ through F) ──────────────────────────────────

export function scoreToGrade(score: number): { letter: string; color: string; bg: string; textColor: string } {
  const letter = scoreToLetter(score);
  const l = letter.charAt(0);
  const minor = letter.length > 1 ? letter.charAt(1) : '';

  switch (l) {
    case 'A':
      return minor === '+'
        ? { letter, color: 'text-green-700',  bg: 'bg-green-600 border-green-700',    textColor: 'text-white' }
        : minor === '-'
        ? { letter, color: 'text-green-600',  bg: 'bg-green-500 border-green-600',    textColor: 'text-white' }
        : { letter, color: 'text-green-700',  bg: 'bg-green-600 border-green-700',    textColor: 'text-white' };
    case 'B':
      return minor === '+'
        ? { letter, color: 'text-emerald-700', bg: 'bg-emerald-600 border-emerald-700', textColor: 'text-white' }
        : minor === '-'
        ? { letter, color: 'text-teal-600',    bg: 'bg-teal-500 border-teal-600',       textColor: 'text-white' }
        : { letter, color: 'text-emerald-600', bg: 'bg-emerald-500 border-emerald-600', textColor: 'text-white' };
    case 'C':
      return minor === '-'
        ? { letter, color: 'text-yellow-600',  bg: 'bg-yellow-500 border-yellow-600',   textColor: 'text-white' }
        : { letter, color: 'text-yellow-700',  bg: 'bg-yellow-500 border-yellow-600',   textColor: 'text-white' };
    case 'D':
      return minor === '+'
        ? { letter, color: 'text-orange-700',  bg: 'bg-orange-600 border-orange-700',   textColor: 'text-white' }
        : minor === '-'
        ? { letter, color: 'text-orange-500',  bg: 'bg-orange-500 border-orange-600',   textColor: 'text-white' }
        : { letter, color: 'text-orange-600',  bg: 'bg-orange-500 border-orange-600',   textColor: 'text-white' };
    case 'F':
      return { letter, color: 'text-red-700',  bg: 'bg-red-600 border-red-700',         textColor: 'text-white' };
    default:
      return { letter, color: 'text-slate-500', bg: 'bg-slate-400 border-slate-500',    textColor: 'text-white' };
  }
}

// ── Alert level → numeric score (PEARL-derived) ────────────────────────────────

export const ALERT_LEVEL_SCORES: Record<string, number> = {
  none: 100,
  low: 85,
  medium: 65,
  high: 40,
};

export function alertLevelAvgScore(regions: { alertLevel: string }[]): number {
  const assessed = regions.filter(r => r.alertLevel && r.alertLevel !== 'unknown');
  if (assessed.length === 0) return -1;
  return Math.round(
    assessed.reduce((s, r) => s + (ALERT_LEVEL_SCORES[r.alertLevel] ?? 65), 0) / assessed.length,
  );
}

// ── Eco sensitivity styling (80/60/40/20 thresholds) ────────────────────────────

export function ecoScoreStyle(score: number): { bg: string; label: string } {
  const label = ecoScoreLabel(score);
  if (score >= 80) return { bg: 'bg-red-50 border-red-200 text-red-700', label };
  if (score >= 60) return { bg: 'bg-orange-50 border-orange-200 text-orange-700', label };
  if (score >= 40) return { bg: 'bg-amber-50 border-amber-200 text-amber-700', label };
  if (score >= 20) return { bg: 'bg-blue-50 border-blue-200 text-blue-700', label };
  return { bg: 'bg-slate-50 border-slate-200 text-slate-700', label };
}

// ── EJ vulnerability styling (70/50/30 thresholds) ──────────────────────────────

export function ejScoreStyle(score: number): {
  bg: string;
  border: string;
  color: string;
  label: string;
} {
  const label = ejScoreLabel(score);
  if (score >= 70) return { bg: 'bg-red-600',    border: 'border-red-200',    color: '#dc2626', label };
  if (score >= 50) return { bg: 'bg-orange-500',  border: 'border-orange-200',  color: '#ea580c', label };
  if (score >= 30) return { bg: 'bg-amber-500',   border: 'border-amber-200',   color: '#d97706', label };
  return              { bg: 'bg-green-500',   border: 'border-green-200',   color: '#16a34a', label };
}

// ── Simple letter grade (A-F, 10pt bands) ───────────────────────────────────────

export function letterGrade(pct: number): string {
  if (pct < 0) return 'N/A';
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}
