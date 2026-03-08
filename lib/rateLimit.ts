import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Sliding window: 10 requests per 60 seconds per identifier
let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null; // Graceful fallback: allow all if env vars missing
  }
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    analytics: true,
    prefix: 'pin-ratelimit',
  });
  return ratelimit;
}

/**
 * Check rate limit for a given identifier (usually user IP or user ID).
 * Returns null if allowed, or a 429 NextResponse if rate limited.
 */
export async function checkRateLimit(
  identifier: string,
): Promise<NextResponse | null> {
  const rl = getRatelimit();
  if (!rl) return null; // Allow if Upstash not configured

  const { success, limit, remaining, reset } = await rl.limit(identifier);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      },
    );
  }
  return null;
}
