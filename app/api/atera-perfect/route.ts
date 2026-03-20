import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Temporary endpoint to stop 404 errors
  // This appears to be called by some JavaScript code with retry logic

  return NextResponse.json({
    status: 'ok',
    message: 'Temporary endpoint created to stop 404 errors',
    timestamp: new Date().toISOString(),
    note: 'Identify and remove the source code making these requests'
  })
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'POST received',
    timestamp: new Date().toISOString()
  })
}