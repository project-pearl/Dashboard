import { NextRequest, NextResponse } from 'next/server'
import { getRMMCache, getRMMStats, getEndpointsByCustomer, getAlertsByCustomer } from '@/lib/rmmCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const cache = getRMMCache()
    const stats = getRMMStats()

    // Get query parameters for filtering
    const url = new URL(request.url)
    const endpointId = url.searchParams.get('endpointId')
    const customerId = url.searchParams.get('customerId')
    const includeDetails = url.searchParams.get('includeDetails') === 'true'

    if (endpointId) {
      // Return specific endpoint data
      const endpoint = cache.endpoints[endpointId]
      if (!endpoint) {
        return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
      }

      const customer = cache.customers[endpoint.customerId]

      const response: any = {
        endpoint,
        customer,
        systemData: cache.systemData[endpointId]?.slice(0, 12) || [], // Last hour (12 x 5min)
        processes: cache.processes[endpointId] || null,
        alerts: cache.alerts[endpointId]?.filter(a => !a.resolved) || [],
        security: cache.security[endpointId] || null
      }

      if (includeDetails) {
        response.assets = cache.assets[endpointId] || null
        response.systemDataFull = cache.systemData[endpointId] || [] // Full 24 hours
      }

      return NextResponse.json(response)
    }

    if (customerId) {
      // Return customer-specific data
      const customer = cache.customers[customerId]
      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }

      const endpoints = getEndpointsByCustomer(customerId)
      const alerts = getAlertsByCustomer(customerId)

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
    }

    // Return overview data
    const response: any = {
      stats,
      customers: Object.values(cache.customers).sort((a, b) => a.name.localeCompare(b.name)),
      endpoints: Object.values(cache.endpoints),
      lastUpdated: cache._lastUpdated || null
    }

    if (includeDetails) {
      // Support pagination for alerts
      const alertsLimit = parseInt(url.searchParams.get('alertsLimit') || '50')
      const alertsOffset = parseInt(url.searchParams.get('alertsOffset') || '0')

      response.recentAlerts = Object.values(cache.alerts)
        .flat()
        .filter(a => !a.resolved)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(alertsOffset, alertsOffset + alertsLimit)

      // Support pagination for endpoints
      const endpointsLimit = parseInt(url.searchParams.get('endpointsLimit') || '100')
      const endpointsOffset = parseInt(url.searchParams.get('endpointsOffset') || '0')

      // Apply pagination to main endpoints list too
      response.endpoints = response.endpoints.slice(endpointsOffset, endpointsOffset + endpointsLimit)

      // Group endpoints by customer
      response.endpointsByCustomer = response.customers.reduce((acc: any, customer: any) => {
        acc[customer.id] = getEndpointsByCustomer(customer.id)
        return acc
      }, {})

      // Add pagination metadata
      response.pagination = {
        endpoints: {
          total: Object.keys(cache.endpoints).length,
          limit: endpointsLimit,
          offset: endpointsOffset,
          hasMore: Object.keys(cache.endpoints).length > (endpointsOffset + endpointsLimit)
        },
        alerts: {
          total: Object.values(cache.alerts).flat().filter(a => !a.resolved).length,
          limit: alertsLimit,
          offset: alertsOffset
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('RMM status error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}