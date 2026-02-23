// =============================================================
// Session Guard — Prevent Credential Sharing
// PEARL Intelligence Network (PIN)
//
// Three files in one for easy review:
//   1. Database migration (SQL)
//   2. Server-side session enforcement (middleware + helpers)
//   3. Client-side session hook (React)
//
// How it works:
//   - On login, create a session record with device fingerprint
//   - On every request, validate session is still active
//   - Concurrent session limit per role tier enforced server-side
//   - If limit exceeded, oldest session gets killed
//   - IP velocity check flags impossible travel
//   - Client polls for session validity and handles forced logout
// =============================================================


// ═══════════════════════════════════════════════════════════════
// PART 1: DATABASE MIGRATION
// ═══════════════════════════════════════════════════════════════
//
// Run this SQL in Supabase SQL Editor:
//
// -----------------------------------------------------------
// CREATE TABLE IF NOT EXISTS public.active_sessions (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//   session_token TEXT NOT NULL UNIQUE,
//   device_fingerprint TEXT,          -- browser/device hash
//   ip_address INET,
//   user_agent TEXT,
//   city TEXT,
//   region TEXT,
//   country TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW(),
//   last_seen_at TIMESTAMPTZ DEFAULT NOW(),
//   expires_at TIMESTAMPTZ NOT NULL,
//   killed_by TEXT,                   -- NULL = active, 'concurrent_limit' | 'admin' | 'user' | 'expired' | 'velocity'
//   killed_at TIMESTAMPTZ
// );
//
// -- Fast lookups
// CREATE INDEX idx_sessions_user_id ON public.active_sessions(user_id) WHERE killed_by IS NULL;
// CREATE INDEX idx_sessions_token ON public.active_sessions(session_token) WHERE killed_by IS NULL;
// CREATE INDEX idx_sessions_expires ON public.active_sessions(expires_at) WHERE killed_by IS NULL;
//
// -- Auto-cleanup: remove dead sessions older than 30 days
// -- (Run via pg_cron or a scheduled function)
// -- DELETE FROM public.active_sessions WHERE killed_at < NOW() - INTERVAL '30 days';
//
// -- Session limits per role tier
// CREATE TABLE IF NOT EXISTS public.session_limits (
//   role TEXT PRIMARY KEY,
//   max_concurrent_sessions INT NOT NULL DEFAULT 1,
//   session_duration_hours INT NOT NULL DEFAULT 24,
//   velocity_check_enabled BOOLEAN DEFAULT TRUE
// );
//
// INSERT INTO public.session_limits (role, max_concurrent_sessions, session_duration_hours) VALUES
//   ('federal',      3, 24),
//   ('state',        3, 24),
//   ('ms4',          2, 24),
//   ('ms4_utility',  2, 24),
//   ('corporate',    3, 24),
//   ('university',   2, 24),
//   ('ngo',          2, 24),
//   ('k12',          1, 12),
//   ('infrastructure', 2, 24),
//   ('admin',        5, 24)
// ON CONFLICT (role) DO NOTHING;
//
// -- RLS: users can only see their own sessions
// ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
//
// CREATE POLICY "Users see own sessions"
//   ON public.active_sessions FOR SELECT
//   USING (user_id = auth.uid());
//
// CREATE POLICY "Service role full access"
//   ON public.active_sessions FOR ALL
//   USING (auth.role() = 'service_role');
// -----------------------------------------------------------


// ═══════════════════════════════════════════════════════════════
// PART 2: SERVER-SIDE SESSION ENFORCEMENT
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Use service role for session management — bypasses RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Types ──

export interface SessionInfo {
  id: string;
  userId: string;
  sessionToken: string;
  deviceFingerprint: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  killedBy: string | null;
  killedAt: string | null;
}

export interface SessionValidation {
  valid: boolean;
  reason?: "active" | "expired" | "killed" | "not_found" | "velocity_flag";
  session?: SessionInfo;
  killedBy?: string;
}

// ── Session Token Generation ──

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ── Device Fingerprint (server-side, from request headers) ──

export function getDeviceFingerprint(request: NextRequest): string {
  const ua = request.headers.get("user-agent") || "";
  const accept = request.headers.get("accept-language") || "";
  const raw = `${ua}|${accept}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

// ── IP Extraction ──

export function getClientIP(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

// ── Create Session (called on login) ──

export async function createSession(
  userId: string,
  role: string,
  request: NextRequest
): Promise<{ token: string; killed: string[] }> {
  const token = generateSessionToken();
  const fingerprint = getDeviceFingerprint(request);
  const ip = getClientIP(request);
  const ua = request.headers.get("user-agent") || null;

  // Get session limit for this role
  const { data: limitRow } = await supabaseAdmin
    .from("session_limits")
    .select("max_concurrent_sessions, session_duration_hours, velocity_check_enabled")
    .eq("role", role)
    .single();

  const maxSessions = limitRow?.max_concurrent_sessions ?? 1;
  const durationHours = limitRow?.session_duration_hours ?? 24;
  const velocityEnabled = limitRow?.velocity_check_enabled ?? true;

  const expiresAt = new Date(
    Date.now() + durationHours * 60 * 60 * 1000
  ).toISOString();

  // Check velocity (impossible travel) before creating session
  if (velocityEnabled && ip) {
    const velocityFlag = await checkVelocity(userId, ip);
    if (velocityFlag) {
      // Don't block — just flag. Admin can review.
      console.warn(
        `[Session Guard] Velocity flag for user ${userId}: ${velocityFlag}`
      );
    }
  }

  // Get current active sessions for this user
  const { data: activeSessions } = await supabaseAdmin
    .from("active_sessions")
    .select("id, session_token, created_at")
    .eq("user_id", userId)
    .is("killed_by", null)
    .order("created_at", { ascending: true });

  const killed: string[] = [];

  // If at or over limit, kill oldest sessions to make room
  if (activeSessions && activeSessions.length >= maxSessions) {
    const toKill = activeSessions.slice(
      0,
      activeSessions.length - maxSessions + 1
    );
    for (const s of toKill) {
      await supabaseAdmin
        .from("active_sessions")
        .update({
          killed_by: "concurrent_limit",
          killed_at: new Date().toISOString(),
        })
        .eq("id", s.id);
      killed.push(s.session_token);
    }
  }

  // Create new session
  await supabaseAdmin.from("active_sessions").insert({
    user_id: userId,
    session_token: token,
    device_fingerprint: fingerprint,
    ip_address: ip,
    user_agent: ua,
    expires_at: expiresAt,
  });

  return { token, killed };
}

// ── Validate Session (called on every protected request) ──

export async function validateSession(
  token: string
): Promise<SessionValidation> {
  if (!token) return { valid: false, reason: "not_found" };

  const { data: session, error } = await supabaseAdmin
    .from("active_sessions")
    .select("*")
    .eq("session_token", token)
    .single();

  if (error || !session) return { valid: false, reason: "not_found" };

  // Check if killed
  if (session.killed_by) {
    return {
      valid: false,
      reason: "killed",
      killedBy: session.killed_by,
    };
  }

  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    await supabaseAdmin
      .from("active_sessions")
      .update({
        killed_by: "expired",
        killed_at: new Date().toISOString(),
      })
      .eq("id", session.id);
    return { valid: false, reason: "expired" };
  }

  // Update last_seen
  await supabaseAdmin
    .from("active_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id);

  return { valid: true, reason: "active", session };
}

// ── Kill Session (called on logout or admin action) ──

export async function killSession(
  token: string,
  reason: "user" | "admin" | "velocity" = "user"
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("active_sessions")
    .update({
      killed_by: reason,
      killed_at: new Date().toISOString(),
    })
    .eq("session_token", token)
    .is("killed_by", null);

  return !error;
}

// ── Kill All Sessions for User (password reset, account compromise) ──

export async function killAllSessions(
  userId: string,
  reason: "admin" | "password_reset" | "compromise" = "admin"
): Promise<number> {
  const { data } = await supabaseAdmin
    .from("active_sessions")
    .update({
      killed_by: reason,
      killed_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .is("killed_by", null)
    .select("id");

  return data?.length ?? 0;
}

// ── Get Active Sessions for User (for account settings page) ──

export async function getUserSessions(
  userId: string
): Promise<SessionInfo[]> {
  const { data } = await supabaseAdmin
    .from("active_sessions")
    .select("*")
    .eq("user_id", userId)
    .is("killed_by", null)
    .order("last_seen_at", { ascending: false });

  return (data ?? []) as SessionInfo[];
}

// ── Velocity Check (impossible travel detection) ──

async function checkVelocity(
  userId: string,
  currentIP: string
): Promise<string | null> {
  // Get the most recent session
  const { data: lastSession } = await supabaseAdmin
    .from("active_sessions")
    .select("ip_address, last_seen_at, city, region, country")
    .eq("user_id", userId)
    .not("ip_address", "is", null)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .single();

  if (!lastSession?.ip_address) return null;
  if (lastSession.ip_address === currentIP) return null;

  // If different IP and last seen within 30 minutes, flag it
  const lastSeen = new Date(lastSession.last_seen_at);
  const minutesSince = (Date.now() - lastSeen.getTime()) / 60000;

  if (minutesSince < 30) {
    return `Different IP within ${Math.round(minutesSince)}min: ${lastSession.ip_address} → ${currentIP}`;
  }

  return null;
}

// ── Cleanup Expired Sessions ──

export async function cleanupExpiredSessions(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("active_sessions")
    .update({
      killed_by: "expired",
      killed_at: new Date().toISOString(),
    })
    .lt("expires_at", new Date().toISOString())
    .is("killed_by", null)
    .select("id");

  return data?.length ?? 0;
}


// ═══════════════════════════════════════════════════════════════
// PART 3: MIDDLEWARE — Drop into middleware.ts
// ═══════════════════════════════════════════════════════════════
//
// Add this to your existing Next.js middleware:
//
// import { validateSession } from "@/lib/sessionGuard";
//
// export async function middleware(request: NextRequest) {
//   // Skip non-dashboard routes
//   if (!request.nextUrl.pathname.startsWith("/dashboard")) {
//     return NextResponse.next();
//   }
//
//   const sessionToken = request.cookies.get("pin_session")?.value;
//
//   if (!sessionToken) {
//     return NextResponse.redirect(new URL("/login", request.url));
//   }
//
//   const validation = await validateSession(sessionToken);
//
//   if (!validation.valid) {
//     // Clear the dead cookie
//     const response = NextResponse.redirect(new URL("/login", request.url));
//     response.cookies.delete("pin_session");
//
//     // Pass reason as query param so login page can show message
//     const loginUrl = new URL("/login", request.url);
//     if (validation.reason === "killed" && validation.killedBy === "concurrent_limit") {
//       loginUrl.searchParams.set("reason", "session_limit");
//     } else if (validation.reason === "expired") {
//       loginUrl.searchParams.set("reason", "expired");
//     }
//     return NextResponse.redirect(loginUrl);
//   }
//
//   return NextResponse.next();
// }


// ═══════════════════════════════════════════════════════════════
// PART 4: CLIENT-SIDE SESSION HOOK
// ═══════════════════════════════════════════════════════════════

// useSessionGuard.ts — polls for session validity
// If session gets killed (concurrent login), user is redirected to login
//
// Usage in layout:
//   const { isValid, loading } = useSessionGuard();
//   if (!isValid) router.push("/login?reason=session_limit");

/*
"use client";

import { useState, useEffect, useCallback } from "react";

interface SessionStatus {
  valid: boolean;
  reason?: string;
  killedBy?: string;
}

export function useSessionGuard(pollIntervalMs: number = 30_000) {
  const [status, setStatus] = useState<SessionStatus>({ valid: true });
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session/validate", {
        credentials: "include",
      });
      const data = await res.json();
      setStatus(data);

      if (!data.valid) {
        // Session was killed or expired — redirect
        const reason = data.killedBy === "concurrent_limit"
          ? "session_limit"
          : data.reason || "unknown";
        window.location.href = `/login?reason=${reason}`;
      }
    } catch {
      // Network error — don't log out, just retry next poll
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
    const interval = setInterval(checkSession, pollIntervalMs);
    return () => clearInterval(interval);
  }, [checkSession, pollIntervalMs]);

  return { isValid: status.valid, loading, status };
}
*/


// ═══════════════════════════════════════════════════════════════
// PART 5: API ROUTE — /api/session/validate
// ═══════════════════════════════════════════════════════════════

// Create at: app/api/session/validate/route.ts
//
// import { NextRequest, NextResponse } from "next/server";
// import { validateSession } from "@/lib/sessionGuard";
//
// export async function GET(request: NextRequest) {
//   const token = request.cookies.get("pin_session")?.value;
//   if (!token) {
//     return NextResponse.json({ valid: false, reason: "not_found" });
//   }
//   const result = await validateSession(token);
//   return NextResponse.json(result);
// }


// ═══════════════════════════════════════════════════════════════
// PART 6: LOGIN ROUTE INTEGRATION
// ═══════════════════════════════════════════════════════════════

// In your login handler, after successful auth:
//
// import { createSession } from "@/lib/sessionGuard";
//
// async function handleLogin(userId: string, role: string, request: NextRequest) {
//   const { token, killed } = await createSession(userId, role, request);
//
//   const response = NextResponse.json({
//     success: true,
//     // Let client know if other sessions were killed
//     sessionsKilled: killed.length,
//   });
//
//   // Set session cookie — httpOnly, secure, sameSite strict
//   response.cookies.set("pin_session", token, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: "strict",
//     path: "/",
//     maxAge: 24 * 60 * 60, // matches session_duration_hours
//   });
//
//   return response;
// }


// ═══════════════════════════════════════════════════════════════
// PART 7: LOGIN PAGE MESSAGES
// ═══════════════════════════════════════════════════════════════

// On /login, check query params and show appropriate message:
//
// const messages: Record<string, string> = {
//   session_limit: "Your session was ended because your account was signed in on another device.",
//   expired: "Your session has expired. Please sign in again.",
//   password_reset: "Your password was changed. Please sign in with your new password.",
//   compromise: "Your account sessions were reset for security. Please sign in again.",
// };
