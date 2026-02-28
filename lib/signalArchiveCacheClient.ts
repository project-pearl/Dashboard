/**
 * Client-safe signal archive stub.
 *
 * The full signalArchiveCache.ts uses Node `fs` for disk persistence and
 * cannot be bundled into client components. Client-side, the cache singleton
 * is never populated anyway — this stub returns [] and avoids the fs import.
 *
 * Server-only consumers (cron routes) continue to use signalArchiveCache.ts.
 */

export type { Signal } from './signals';
import type { Signal } from './signals';

/**
 * Client-safe stub — always returns [].
 * The real implementation lives in signalArchiveCache.ts (server-only).
 */
export function getArchivedSignals(_opts?: {
  state?: string;
  states?: string[];
  category?: Signal['category'] | Signal['category'][];
  pearlOnly?: boolean;
  since?: string;
  limit?: number;
}): Signal[] {
  return [];
}
