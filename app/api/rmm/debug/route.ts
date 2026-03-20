import { NextRequest, NextResponse } from 'next/server'
import { getRMMCache } from '@/lib/rmmCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const cache = getRMMCache()

    const endpointIds = Object.keys(cache.endpoints)
    const endpointsArray = Object.values(cache.endpoints)

    const debugInfo = {
      cache_endpoints_count: endpointIds.length,
      cache_customers_count: Object.keys(cache.customers).length,
      cache_systemdata_count: Object.keys(cache.systemData).length,
      cache_last_updated: cache._lastUpdated,
      endpoint_ids: endpointIds.slice(0, 50), // Show first 50 IDs
      all_endpoints_count: endpointsArray.length,
      endpoints_by_status: {
        online: endpointsArray.filter(e => e.status === 'online').length,
        offline: endpointsArray.filter(e => e.status === 'offline').length,
        warning: endpointsArray.filter(e => e.status === 'warning').length,
        critical: endpointsArray.filter(e => e.status === 'critical').length
      },
      recent_endpoints: endpointsArray
        .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
        .slice(0, 10)
        .map(e => ({
          endpointId: e.endpointId,
          hostname: e.hostname,
          customerId: e.customerId,
          status: e.status,
          lastSeen: e.lastSeen,
          agentVersion: e.agentVersion
        })),
      sample_cache_structure: {
        endpoints_sample: Object.keys(cache.endpoints).slice(0, 3),
        customers_sample: Object.keys(cache.customers).slice(0, 3),
        systemData_sample: Object.keys(cache.systemData).slice(0, 3)
      }
    }

    return NextResponse.json(debugInfo, { status: 200 })

  } catch (error) {
    console.error('RMM debug error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}