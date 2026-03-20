import { NextRequest, NextResponse } from 'next/server'
import { updateEndpointHeartbeat } from '@/lib/rmmCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    // Check API key
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid API key' }, { status: 401 })
    }

    const apiKey = authHeader.substring(7)
    if (apiKey !== process.env.RMM_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const body = await request.json()
    const { endpoint_id, hostname, agent_version } = body

    if (!endpoint_id || !hostname || !agent_version) {
      return NextResponse.json({
        error: 'Missing required fields: endpoint_id, hostname, agent_version'
      }, { status: 400 })
    }

    await updateEndpointHeartbeat(endpoint_id, hostname, agent_version)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('RMM heartbeat error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}