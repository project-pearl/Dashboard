/** Shared date/time formatting utilities for consistent display across PIN. */

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Format an ISO date string as a relative time label (e.g. "2h ago", "3 days ago"). */
export function relativeTime(isoDate: string | Date): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const secs = Math.round(ms / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return rtf.format(-hrs, 'hour');
  const days = Math.round(hrs / 24);
  if (days < 30) return rtf.format(-days, 'day');
  const months = Math.round(days / 30);
  return rtf.format(-months, 'month');
}

/** Format a date as "Mar 11, 2026 3:45 PM EST" with the user's local timezone. */
export function absoluteDateTime(isoDate: string | Date): string {
  return new Date(isoDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/** Format a date as "Mar 11, 2026" without time. */
export function shortDate(isoDate: string | Date): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format as "3:45 PM EST" — time only with timezone. */
export function timeWithZone(isoDate: string | Date): string {
  return new Date(isoDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Calculate the number of days from today until a target date.
 * Positive = future, negative = past/overdue, 0 = today.
 * Accepts YYYY-MM-DD, "Mon DD, YYYY", "Mon YYYY", or Date objects.
 */
export function daysUntil(dateStr: string | Date): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

/** Deadline status badge: overdue / soon / upcoming / on-track. */
export function deadlineStatus(days: number): { label: string; className: string } {
  if (days < 0) return { label: 'Overdue', className: 'bg-red-200 text-red-900' };
  if (days <= 30) return { label: 'Soon', className: 'bg-amber-100 text-amber-800' };
  if (days <= 180) return { label: 'Upcoming', className: 'bg-blue-100 text-blue-800' };
  return { label: 'On Track', className: 'bg-emerald-100 text-emerald-800' };
}

/** Row styling for deadline cards based on days remaining. */
export function deadlineRowStyle(days: number): string {
  if (days < 0) return 'bg-red-50 border-2 border-red-300';
  return 'bg-white border border-slate-200';
}

/** Text color for deadline labels based on days remaining. */
export function deadlineTextColor(days: number): string {
  if (days < 0) return 'text-red-800';
  return 'text-slate-800';
}

/** Format days remaining as display text. */
export function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  return `${days} days`;
}
