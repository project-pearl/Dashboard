import crypto from 'crypto';
import { InvitePayload, UserRole, normalizeUserRole } from '@/lib/authTypes';

const ALLOWED_ROLES = new Set<UserRole>([
  'Federal', 'State', 'Local', 'MS4', 'Corporate', 'Researcher', 'College',
  'NGO', 'K12', 'Temp', 'Pearl', 'Utility', 'Agriculture', 'Lab', 'Biotech', 'Investor',
]);

function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function getInviteSecret(): string {
  const secret = process.env.INVITE_TOKEN_SECRET
    || process.env.CRON_SECRET
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || '';
  if (!secret) {
    throw new Error('Missing invite token secret');
  }
  return secret;
}

function signMessage(message: string): string {
  return base64UrlEncode(crypto.createHmac('sha256', getInviteSecret()).update(message).digest());
}

export function encodeInviteToken(payload: InvitePayload): string {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(payloadJson);
  const sigB64 = signMessage(payloadB64);
  return `${payloadB64}.${sigB64}`;
}

export function decodeInviteToken(token: string): InvitePayload | null {
  if (!token || !token.includes('.')) return null;
  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = signMessage(payloadB64);
  const provided = Buffer.from(sigB64);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const raw = JSON.parse(base64UrlDecode(payloadB64)) as Partial<InvitePayload>;
    const role = normalizeUserRole(raw.role);
    if (!ALLOWED_ROLES.has(role)) return null;

    const payload: InvitePayload = {
      role,
      invitedBy: String(raw.invitedBy || '').trim(),
      createdAt: String(raw.createdAt || ''),
      expiresAt: String(raw.expiresAt || ''),
      email: raw.email ? String(raw.email).trim().toLowerCase() : undefined,
      organization: raw.organization ? String(raw.organization).trim() : undefined,
      state: raw.state ? String(raw.state).trim().toUpperCase() : undefined,
      jurisdiction: raw.jurisdiction ? String(raw.jurisdiction).trim() : undefined,
      isMilitary: raw.isMilitary === true ? true : undefined,
    };

    if (!payload.invitedBy || !payload.createdAt || !payload.expiresAt) return null;
    if (Number.isNaN(Date.parse(payload.expiresAt))) return null;
    if (new Date(payload.expiresAt).getTime() < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}
