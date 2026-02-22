// app/api/cron/scheduler/route.ts
export const maxDuration = 300;
import { NextRequest, NextResponse } from "next/server";
import { schedulerTick } from "@/lib/scheduler";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  const ok = secret && (auth === `Bearer ${secret}` || auth === secret);
  if (!ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const out = await schedulerTick(); // runs due sources (attains only for now)
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "scheduler failed" }, { status: 500 });
  }
}