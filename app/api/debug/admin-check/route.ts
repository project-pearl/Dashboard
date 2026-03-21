/**
 * Debug endpoint to check admin authentication status
 * Temporary route to help troubleshoot admin access issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_EMAILS, checkIsAdmin, resolveAdminLevel } from '@/lib/authTypes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get email from query param for testing
    const url = new URL(request.url);
    const testEmail = url.searchParams.get('email');

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      adminEmailsEnv: {
        raw: process.env.ADMIN_EMAILS,
        parsed: ADMIN_EMAILS,
        length: ADMIN_EMAILS.length,
        isEmpty: ADMIN_EMAILS.length === 0
      },
      emailCheck: testEmail ? {
        input: testEmail,
        normalized: testEmail.toLowerCase().trim(),
        isAdmin: checkIsAdmin(testEmail),
        adminLevel: resolveAdminLevel(undefined, testEmail), // Test with no DB value
        adminLevelWithNone: resolveAdminLevel('none', testEmail), // Test with explicit 'none'
      } : null,
      allAdminEmails: ADMIN_EMAILS
    };

    return NextResponse.json(debugInfo);

  } catch (error) {
    return NextResponse.json({
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}