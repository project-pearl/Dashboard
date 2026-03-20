import { NextRequest, NextResponse } from 'next/server'
import { assignEndpointToCustomer, getRMMCache } from '@/lib/rmmCache'

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

    const body = await request.json()

    // Validate required fields
    if (!body.endpointId || !body.customerId) {
      return NextResponse.json({
        error: 'Missing required fields: endpointId, customerId'
      }, { status: 400 })
    }

    const success = await assignEndpointToCustomer(body.endpointId, body.customerId)

    if (!success) {
      return NextResponse.json({
        error: 'Endpoint or customer not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Endpoint assigned successfully'
    })

  } catch (error) {
    console.error('RMM endpoint assign error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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

    // Batch endpoint assignment
    if (!body.assignments || !Array.isArray(body.assignments)) {
      return NextResponse.json({
        error: 'Missing required field: assignments (array)'
      }, { status: 400 })
    }

    const results = await Promise.allSettled(
      body.assignments.map(async (assignment: { endpointId: string; customerId: string }) => {
        if (!assignment.endpointId || !assignment.customerId) {
          throw new Error(`Invalid assignment: ${JSON.stringify(assignment)}`)
        }
        return await assignEndpointToCustomer(assignment.endpointId, assignment.customerId)
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length
    const failed = results.length - successful

    return NextResponse.json({
      success: true,
      message: `${successful} assignments successful, ${failed} failed`,
      successful,
      failed,
      total: results.length
    })

  } catch (error) {
    console.error('RMM batch assign error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}