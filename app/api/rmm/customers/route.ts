import { NextRequest, NextResponse } from 'next/server'
import { getRMMCache, createCustomer, updateCustomer, getEndpointsByCustomer, getAlertsByCustomer } from '@/lib/rmmCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const cache = getRMMCache()
    const customers = Object.values(cache.customers).sort((a, b) => a.name.localeCompare(b.name))

    // Add endpoint and alert counts for each customer
    const customersWithStats = customers.map(customer => ({
      ...customer,
      endpoints: getEndpointsByCustomer(customer.id),
      activeAlerts: getAlertsByCustomer(customer.id).length
    }))

    return NextResponse.json({
      customers: customersWithStats,
      total: customers.length
    })

  } catch (error) {
    console.error('RMM customers GET error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

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
    if (!body.name) {
      return NextResponse.json({
        error: 'Missing required field: name'
      }, { status: 400 })
    }

    const customer = await createCustomer({
      name: body.name,
      contact: body.contact || {},
      status: body.status || 'active',
      notes: body.notes || ''
    })

    return NextResponse.json({
      success: true,
      customer
    })

  } catch (error) {
    console.error('RMM customers POST error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}