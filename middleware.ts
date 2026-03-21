import { NextRequest, NextResponse } from 'next/server';

// ─── CSP nonce + CSRF double-submit cookie middleware ────────────────────────

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

// Routes that skip CSRF validation
const CSRF_SKIP_PREFIXES = ['/api/cron/'];

function shouldSkipCsrf(request: NextRequest): boolean {
  const path = request.nextUrl.pathname;

  // Skip cron routes (authenticated via Bearer token)
  if (CSRF_SKIP_PREFIXES.some((p) => path.startsWith(p))) return true;

  // Skip Bearer-token-authenticated requests (cron jobs, external callers)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return true;

  return false;
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();

  // ── CSP policy ──────────────────────────────────────────────────────────
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' blob:`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https://*.mapbox.com https://*.tiles.mapbox.com`,
    `connect-src 'self' https://*.supabase.co https://api.openai.com https://*.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com https://*.sentry.io https://va.vercel-scripts.com blob:`,
    `media-src 'self' https://*.public.blob.vercel-storage.com`,
    `worker-src blob:`,
    `child-src blob:`,
    `font-src 'self' https://*.mapbox.com https://fonts.gstatic.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');

  const method = request.method.toUpperCase();

  // ── CSRF validation on mutation methods ─────────────────────────────────
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && !shouldSkipCsrf(request)) {
    const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
    const headerToken = request.headers.get(CSRF_HEADER);

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }
  }

  // ── Build response with CSP + nonce header ──────────────────────────────
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-csp-nonce', nonce);

  // ── Set CSRF cookie on GET requests to pages (not API/static) ───────────
  if (method === 'GET' && !request.nextUrl.pathname.startsWith('/api/')) {
    const existingToken = request.cookies.get(CSRF_COOKIE)?.value;
    if (!existingToken) {
      const csrfToken = generateCsrfToken();
      response.cookies.set(CSRF_COOKIE, csrfToken, {
        httpOnly: false, // Client JS must read this
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // Changed from 'strict' for better compatibility
        path: '/',
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icons, manifest, logos, etc.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|.*\\.png$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
