import { NextRequest, NextResponse } from 'next/server';
import { decodeInviteToken } from '@/lib/inviteTokens';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === 'string' ? body.token : '';
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
