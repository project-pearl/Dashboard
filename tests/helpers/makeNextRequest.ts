/**
 * Creates a NextRequest-like object for API route testing.
 * Adds cookies and nextUrl properties that Next.js route handlers expect.
 */
export function makeNextRequest(url: string, init?: RequestInit) {
  const req = new Request(url, init);
  (req as any).cookies = {
    has: () => false,
    get: () => undefined,
  };
  (req as any).nextUrl = new URL(url);
  return req as any;
}

export const AUTH_HEADER = {
  authorization: `Bearer ${process.env.CRON_SECRET}`,
};
