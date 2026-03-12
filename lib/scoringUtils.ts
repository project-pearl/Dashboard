/**
 * Centralized scoring utilities — single source of truth for all grading,
 * alert-level mapping, and ecological/EJ styling across the dashboard.
 *
 * Re-exports {@link scoreToLetter} and {@link GradeLetter} from `waterQualityScore`.
 */

export { scoreToLetter, type GradeLetter } from './waterQualityScore';
import { scoreToLetter } from './waterQualityScore';
import { ecoScoreLabel } from './ecologicalSensitivity';
import { ejScoreLabel } from './ejVulnerability';

// ── PEARL-derived styled grade (A+ through F) ──────────────────────────────────

/**
 * Convert a numeric score (0-100) to a styled grade object with Tailwind classes.
 *
 * @param score - Numeric score from 0 to 100
 * @returns Object with `letter` (e.g. "A+"), `color`, `bg`, and `textColor` Tailwind classes
 */
export function scoreToGrade(score: number): { letter: string; color: string; bg: string; textColor: string } {
  const letter = scoreToLetter(score);
  const l = letter.charAt(0);
  const minor = letter.length > 1 ? letter.charAt(1) : '';

  switch (l) {
    case 'A':
      return minor === '+'
        ? { letter, color: 'text-green-700',    bg: 'bg-green-100 border-green-300',      textColor: 'text-green-800' }
        : minor === '-'
        ? { letter, color: 'text-green-600',    bg: 'bg-green-50 border-green-200',       textColor: 'text-green-700' }
        : { letter, color: 'text-green-700',    bg: 'bg-green-100 border-green-300',      textColor: 'text-green-800' };
    case 'B':
      return minor === '+'
        ? { letter, color: 'text-emerald-700',  bg: 'bg-emerald-100 border-emerald-300',  textColor: 'text-emerald-800' }
        : minor === '-'
        ? { letter, color: 'text-teal-600',     bg: 'bg-teal-50 border-teal-200',         textColor: 'text-teal-700' }
        : { letter, color: 'text-emerald-600',  bg: 'bg-emerald-50 border-emerald-200',   textColor: 'text-emerald-700' };
    case 'C':
      return minor === '-'
        ? { letter, color: 'text-yellow-700',   bg: 'bg-yellow-50 border-yellow-200',     textColor: 'text-yellow-800' }
        : { letter, color: 'text-yellow-700',   bg: 'bg-yellow-100 border-yellow-300',    textColor: 'text-yellow-800' };
    case 'D':
      return minor === '+'
        ? { letter, color: 'text-orange-700',   bg: 'bg-orange-100 border-orange-300',    textColor: 'text-orange-800' }
        : minor === '-'
        ? { letter, color: 'text-orange-600',   bg: 'bg-orange-50 border-orange-200',     textColor: 'text-orange-700' }
        : { letter, color: 'text-orange-600',   bg: 'bg-orange-50 border-orange-200',     textColor: 'text-orange-700' };
    case 'F':
      return { letter, color: 'text-red-700',   bg: 'bg-red-100 border-red-300',          textColor: 'text-red-800' };
    default:
      return { letter, color: 'text-slate-500', bg: 'bg-slate-100 border-slate-300',      textColor: 'text-slate-600' };
  }
}

// ── Alert level → numeric score (PEARL-derived) ────────────────────────────────

/** Maps alert level strings ("none" | "low" | "medium" | "high") to numeric scores (100→40). */
export const ALERT_LEVEL_SCORES: Record<string, number> = {
  none: 100,
  low: 85,
  medium: 65,
  high: 40,
};

/**
 * Compute the weighted-average score for a set of regions based on their alert levels.
 *
 * @param regions - Array of objects each with an `alertLevel` string
 * @returns Average score (0-100), or -1 if no assessable regions
 */
export function alertLevelAvgScore(regions: { alertLevel: string }[]): number {
  const assessed = regions.filter(r => r.alertLevel && r.alertLevel !== 'unknown');
  if (assessed.length === 0) return -1;
  return Math.round(
    assessed.reduce((s, r) => s + (ALERT_LEVEL_SCORES[r.alertLevel] ?? 65), 0) / assessed.length,
  );
}

// ── Eco sensitivity styling (80/60/40/20 thresholds) ────────────────────────────

/**
 * Return Tailwind background classes and a human-readable label for an ecological sensitivity score.
 *
 * @param score - Ecological sensitivity score (0-100, higher = more sensitive)
 * @returns Object with `bg` (Tailwind classes) and `label` (e.g. "Critical", "High")
 */
export function ecoScoreStyle(score: number): { bg: string; label: string } {
  const label = ecoScoreLabel(score);
  if (score >= 80) return { bg: 'bg-red-50 border-red-200 text-red-700', label };
  if (score >= 60) return { bg: 'bg-orange-50 border-orange-200 text-orange-700', label };
  if (score >= 40) return { bg: 'bg-amber-50 border-amber-200 text-amber-700', label };
  if (score >= 20) return { bg: 'bg-blue-50 border-blue-200 text-blue-700', label };
  return { bg: 'bg-slate-50 border-slate-200 text-slate-700', label };
}

// ── EJ vulnerability styling (70/50/30 thresholds) ──────────────────────────────

/**
 * Return Tailwind styling and a label for an environmental justice vulnerability score.
 *
 * @param score - EJ vulnerability score (0-100, higher = more vulnerable)
 * @returns Object with `bg`, `border`, `color` (hex), and `label` strings
 */
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

/**
 * Convert a percentage score to a simple letter grade (A/B/C/D/F).
 * Uses 10-point bands: 90+ = A, 80+ = B, 70+ = C, 60+ = D, below = F.
 *
 * @param pct - Percentage score (0-100). Negative values return "N/A".
 * @returns A single letter grade string
 */
export function letterGrade(pct: number): string {
  if (pct < 0) return 'N/A';
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}
