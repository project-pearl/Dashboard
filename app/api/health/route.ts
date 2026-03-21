/**
 * Simple health check endpoint to verify deployment is working
 * No dependencies, no database calls, no cache loading
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    deployment: 'working',
    message: 'Emergency fix deployed successfully'
  });
}