import { NextRequest, NextResponse } from 'next/server'
import { getRMMCache, updateCustomer, getEndpointsByCustomer, getAlertsByCustomer } from '@/lib/rmmCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest, { params }: { params: { customerId: string } }) {
  try {
    const cache = getRMMCache()
    const customer = cache.customers[params.customerId]

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const endpoints = getEndpointsByCustomer(params.customerId)
    const alerts = getAlertsByCustomer(params.customerId)

    return NextResponse.json({
      customer,
      endpoints,
      alerts,
      stats: {
        endpointCount: endpoints.length,
        onlineCount: endpoints.filter(e => e.status === 'online').length,
        offlineCount: endpoints.filter(e => e.status === 'offline').length,
        criticalCount: endpoints.filter(e => e.status === 'critical').length,
        warningCount: endpoints.filter(e => e.status === 'warning').length,
        alertCount: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length
      }
    })

  } catch (error) {
    console.error('RMM customer GET error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { customerId: string } }) {
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

    const updatedCustomer = await updateCustomer(params.customerId, body)

    if (!updatedCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      customer: updatedCustomer
    })

  } catch (error) {
    console.error('RMM customer PUT error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}