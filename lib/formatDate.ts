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
