// lib/scheduler.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordIngestRun } from "@/lib/health";

type SourceKey = "attains" | "wqp" | "sdwis" | "icis" | "tri" | "echo" | "bwb";

// Instance id for soft locking across parallel servers
const INSTANCE_ID =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_URL ||
  `local-${Math.random().toString(36).slice(2, 9)}`;

function minutes(n: number) { return n * 60 * 1000; }
function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }
function addJitter(ms: number, pct: number) {
  const j = (Math.random() * 2 - 1) * (pct / 100);
  return Math.round(ms * (1 + j));
}

// --- Runner map: define how to call each source's own cron route
async function callCron(path: string): Promise<{ ok: boolean; meta?: any; status?: number }> {
  const secret = process.env.CRON_SECRET!;
  const isAbsolute = /^https?:\/\//i.test(path);
  const base = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SITE_HOST || "";
  const finalUrl = isAbsolute ? path : new URL(path, `https://${base}`).toString();

  const res = await fetch(finalUrl, {
    headers: { Authorization: `Bearer ${secret}` },
    // Generous timeout for chunked builds
    signal: AbortSignal.timeout(240_000),
  });
  let meta: any = undefined;
  try { meta = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, meta, status: res.status };
}

const RUNNERS: Partial<Record<SourceKey, () => Promise<{ status: "success" | "partial" | "error"; meta?: any }>>> = {
  // Start with ATTAINS only; add others later by mapping to their cron endpoints
  attains: async () => {
    // Prefer absolute URL if you have a custom domain; otherwise relative is fine in Vercel
    const endpoint = process.env.NEXT_PUBLIC_APP_ORIGIN
      ? `${process.env.NEXT_PUBLIC_APP_ORIGIN}/api/cron/rebuild-attains`
      : `/api/cron/rebuild-attains`;

    const r = await callCron(endpoint);
    // Determine run status from response payload if available
    // Heuristic: any failed states => partial; HTTP !ok => error
    if (!r.ok) return { status: "error", meta: r.meta };
    const failed = Array.isArray(r.meta?.failed) ? r.meta.failed.length : 0;
    const processed = Array.isArray(r.meta?.processed) ? r.meta.processed.length : 0;
    if (failed > 0 && processed > 0) return { status: "partial", meta: r.meta };
    return { status: "success", meta: r.meta };
  },

  // Example placeholders for later:
  // wqp:   async () => { const r = await callCron("/api/cron/rebuild-wqp");   return { status: r.ok ? "success" : "error", meta: r.meta }; },
  // sdwis: async () => { const r = await callCron("/api/cron/rebuild-sdwis"); return { status: r.ok ? "success" : "error", meta: r.meta }; },
};

// --- DB helpers (pin_meta.scheduler)
async function getSchedulerRow(source: SourceKey) {
  const { data, error } = await supabaseAdmin
    .schema("pin_meta").from("scheduler").select("*").eq("source", source).single();
  if (error) throw error;
  return data as any;
}

async function setScheduler(source: SourceKey, patch: Record<string, any>) {
  patch.updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin
    .schema("pin_meta").from("scheduler").update(patch).eq("source", source);
  if (error) throw error;
}

async function acquireLock(source: SourceKey): Promise<boolean> {
  const now = new Date();
  const until = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

  // Check if lock is free (null or expired)
  const { data: row, error: readErr } = await supabaseAdmin
    .schema("pin_meta")
    .from("scheduler")
    .select("lock_until")
    .eq("source", source)
    .single();
  if (readErr) throw readErr;

  const lockUntil = row?.lock_until ? new Date(row.lock_until) : null;
  if (lockUntil && lockUntil > now) return false; // still locked

  // Acquire lock
  const { error: writeErr } = await supabaseAdmin
    .schema("pin_meta")
    .from("scheduler")
    .update({ lock_owner: INSTANCE_ID, lock_until: until.toISOString() })
    .eq("source", source);
  if (writeErr) throw writeErr;
  return true;
}

async function releaseLock(source: SourceKey) {
  await setScheduler(source, { lock_owner: null, lock_until: null });
}

// --- Backoff logic: base interval + health-aware escalation + jitter
function nextIntervalMs(
  baseMin: number, maxMin: number, failCount: number, jitterPct: number,
  lastStatus: "healthy" | "degraded" | "failing" | "unknown"
) {
  let m = baseMin;
  if (lastStatus === "degraded") m = baseMin * 2;
  if (lastStatus === "failing")  m = baseMin * Math.pow(2, clamp(failCount, 1, 10));
  return addJitter(minutes(clamp(m, baseMin, maxMin)), jitterPct);
}

// --- Public: one tick
export async function schedulerTick(sources?: SourceKey[]) {
  const now = new Date();
  const results: any[] = [];

  // Which sources we consider this tick
  const all = (sources && sources.length ? sources : (["attains"] as SourceKey[])); // start with attains only

  for (const src of all) {
    const row = await getSchedulerRow(src);
    if (!row?.enabled) { results.push({ source: src, skipped: "disabled" }); continue; }

    const due = !row.next_run_at || new Date(row.next_run_at) <= now;
    if (!due) { results.push({ source: src, skipped: "not_due" }); continue; }

    const got = await acquireLock(src);
    if (!got) { results.push({ source: src, skipped: "locked" }); continue; }

    const started = new Date();
    let runStatus: "success" | "partial" | "error" = "error";
    let meta: any = undefined;

    try {
      const runner = RUNNERS[src];
      if (!runner) {
        results.push({ source: src, error: "no_runner" });
        await releaseLock(src);
        continue;
      }

      const out = await runner();
      runStatus = out.status;
      meta = out.meta || {};
    } catch (e: any) {
      runStatus = "error";
      meta = { error: e?.message || "runner error" };
    } finally {
      const finished = new Date();
      // Record run & health
      await recordIngestRun({
        source: src,
        job: `cron/scheduler/${src}`,
        status: runStatus,
        startedAt: started,
        finishedAt: finished,
        durationMs: finished.getTime() - started.getTime(),
        processed: Array.isArray(meta?.processed) ? meta.processed.length : undefined,
        warnings: Array.isArray(meta?.failed) ? meta.failed.length : undefined,
        meta,
      });

      // Compute next schedule
      let last_status: "healthy" | "degraded" | "failing" = "healthy";
      if (runStatus === "partial") last_status = "degraded";
      if (runStatus === "error")   last_status = "failing";

      const newFail = runStatus === "error" ? (row.fail_count + 1) : 0;
      const intervalMs = nextIntervalMs(
        row.base_interval_min,
        row.max_interval_min,
        newFail,
        row.jitter_pct ?? 10,
        last_status
      );

      await setScheduler(src, {
        last_run_at: finished.toISOString(),
        last_status,
        fail_count: newFail,
        next_run_at: new Date(now.getTime() + intervalMs).toISOString(),
      });

      results.push({ source: src, status: last_status, next_in_min: Math.round(intervalMs / 60000) });
      await releaseLock(src);
    }
  }

  return { ok: true, now: now.toISOString(), results };
}