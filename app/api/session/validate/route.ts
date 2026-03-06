import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/sessionGuard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('pin_session')?.value;
  if (!token) {
    return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 401 });
  }

  const result = await validateSession(token);
  if (!result.valid) {
    const response = NextResponse.json(result, { status: 401 });
    response.cookies.delete('pin_session');
    return response;
  }

  return NextResponse.json(result);
}

