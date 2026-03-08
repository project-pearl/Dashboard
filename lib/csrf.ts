/** Client-side CSRF helper — reads the double-submit cookie and returns headers */

export function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
  return match?.[1] ?? '';
}

export function csrfHeaders(): HeadersInit {
  return { 'x-csrf-token': getCsrfToken() };
}
