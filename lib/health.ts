// lib/health.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RunStatus = "success" | "partial" | "error";
type HealthStatus = "healthy" | "degraded" | "failing" | "unknown";

export async function recordIngestRun(opts: {
  source: string;
  job: string;
  status: RunStatus;
  startedAt: Date;
  finishedAt: Date;
  durationMs?: number;
  processed?: number;
  inserted?: number;
  warnings?: number;
  error_code?: string;
  error_message?: string;
  meta?: any;
}) {
  const {
    source, job, status, startedAt, finishedAt,
    durationMs, processed, inserted, warnings, error_code, error_message, meta
  } = opts;

  await supabaseAdmin.from("pin_meta.ingest_runs").insert({
    source,
    job,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: durationMs ?? Math.max(1, finishedAt.getTime() - startedAt.getTime()),
    status,
    processed,
    inserted,
    warnings,
    error_code,
    error_message,
    meta: meta ?? {},
  });

  // Map run status -> health
  let last_status: HealthStatus = "healthy";
  if (status === "partial") last_status = "degraded";
  if (status === "error")   last_status = "failing";

  await supabaseAdmin
    .from("pin_meta.ingest_health")
    .upsert({
      source,
      job,
      last_status,
      last_success: status === "success" ? finishedAt.toISOString() : undefined,
      last_error:   status === "error"   ? finishedAt.toISOString() : undefined,
      error_code,
      error_message,
      updated_at: finishedAt.toISOString(),
    }, { onConflict: "source" });
}