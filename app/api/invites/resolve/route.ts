import { NextRequest, NextResponse } from 'next/server';
import { decodeInviteToken } from '@/lib/inviteTokens';
import { inviteResolveSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, inviteResolveSchema);
  if (!parsed.success) return parsed.error;
  const { token } = parsed.data;
  let payload = null;
  try {
    payload = decodeInviteToken(token);
  } catch {
    payload = null;
  }

  if (!payload) {
    return NextResponse.json({ payload: null }, { status: 400 });
  }

  return NextResponse.json({ payload });
}
