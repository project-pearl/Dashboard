import { NextRequest, NextResponse } from 'next/server'
import { updateSystemData, RMMSystemData } from '@/lib/rmmCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

    const body: RMMSystemData = await request.json()

    // Validate required fields
    const requiredFields = [
      'endpoint_id', 'timestamp', 'hostname', 'platform',
      'cpu', 'memory', 'disks', 'network'
    ]

    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json({
          error: `Missing required field: ${field}`
        }, { status: 400 })
      }
    }

    // Convert endpoint_id to endpointId for consistency
    const systemData: RMMSystemData = {
      ...body,
      endpointId: body.endpoint_id || (body as any).endpointId
    }
    delete (systemData as any).endpoint_id

    await updateSystemData(systemData)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('RMM system data error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}