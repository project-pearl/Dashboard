'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle,
  Clock,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Users,
  Wifi,
  XCircle,
  UserCheck
} from 'lucide-react'

interface RMMCustomer {
  id: string
  name: string
  contact?: {
    email?: string
    phone?: string
    address?: string
  }
  created: string
  lastModified: string
  endpointCount: number
  status: 'active' | 'inactive' | 'trial'
  notes?: string
  endpoints?: RMMEndpoint[]
  activeAlerts?: number
}

interface RMMEndpoint {
  endpointId: string
  customerId: string
  hostname: string
  description?: string
  lastSeen: string
  status: 'online' | 'offline' | 'warning' | 'critical'
  agentVersion: string
  platform: {
    system: string
    release: string
    version: string
    architecture: string
    processor: string
  }
  tags?: string[]
}

interface RMMSystemData {
  endpointId: string
  timestamp: string
  hostname: string
  cpu: { percent: number; count: number }
  memory: { total_gb: number; used_gb: number; percent: number }
  disks: Array<{
    device: string
    total_gb: number
    used_gb: number
    percent_used: number
  }>
  uptime_hours: number
}

interface RMMAlert {
  id: string
  endpointId: string
  customerId: string
  timestamp: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  resolved: boolean
}

interface RMMStats {
  totalCustomers: number
  totalEndpoints: number
  onlineEndpoints: number
  offlineEndpoints: number
  criticalEndpoints: number
  warningEndpoints: number
  totalAlerts: number
  criticalAlerts: number
}

interface RMMData {
  stats: RMMStats
  customers: RMMCustomer[]
  endpoints: RMMEndpoint[]
  lastUpdated: string | null
  recentAlerts?: RMMAlert[]
  endpointsByCustomer?: Record<string, RMMEndpoint[]>
}

export default function RMMCustomerDashboard() {
  const [data, setData] = useState<RMMData | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null)
  const [endpointDetails, setEndpointDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [showAssignEndpoint, setShowAssignEndpoint] = useState(false)
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [debugData, setDebugData] = useState<any>(null)
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  })

  const fetchRMMData = async (includeDetails = false, endpointsLimit = 200) => {
    try {
      const response = await fetch(`/api/rmm/status?includeDetails=${includeDetails}&endpointsLimit=${endpointsLimit}&alertsLimit=100`)
      const rmmData = await response.json()
      setData(rmmData)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching RMM data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEndpointDetails = async (endpointId: string) => {
    try {
      const response = await fetch(`/api/rmm/status?endpointId=${endpointId}&includeDetails=true`)
      const details = await response.json()
      setEndpointDetails(details)
    } catch (error) {
      console.error('Error fetching endpoint details:', error)
    }
  }

  const createCustomer = async () => {
    try {
      const response = await fetch('/api/rmm/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RMM_API_KEY || 'demo-key'}`
        },
        body: JSON.stringify({
          name: newCustomer.name,
          contact: {
            email: newCustomer.email,
            phone: newCustomer.phone
          },
          status: 'active',
          notes: newCustomer.notes
        })
      })

      if (response.ok) {
        setShowNewCustomer(false)
        setNewCustomer({ name: '', email: '', phone: '', notes: '' })
        fetchRMMData(true) // Refresh data
      }
    } catch (error) {
      console.error('Error creating customer:', error)
    }
  }

  const assignEndpointToCustomer = async (endpointId: string, customerId: string) => {
    try {
      const response = await fetch('/api/rmm/endpoints/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RMM_API_KEY || 'demo-key'}`
        },
        body: JSON.stringify({
          endpointId,
          customerId
        })
      })

      if (response.ok) {
        fetchRMMData(true) // Refresh data
      }
    } catch (error) {
      console.error('Error assigning endpoint:', error)
    }
  }

  const fetchDebugData = async () => {
    try {
      const response = await fetch('/api/rmm/debug')
      const debug = await response.json()
      setDebugData(debug)
      setShowDebugInfo(true)
    } catch (error) {
      console.error('Error fetching debug data:', error)
    }
  }

  useEffect(() => {
    fetchRMMData(true)

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchRMMData(), 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedEndpoint) {
      fetchEndpointDetails(selectedEndpoint)
    }
  }, [selectedEndpoint])

  const selectedCustomerData = useMemo(() => {
    if (!selectedCustomer || !data) return null
    return data.customers.find(c => c.id === selectedCustomer) || null
  }, [selectedCustomer, data])

  const customerEndpoints = useMemo(() => {
    if (!selectedCustomer || !data) return []
    return data.endpoints.filter(e => e.customerId === selectedCustomer)
  }, [selectedCustomer, data])

  const unassignedEndpoints = useMemo(() => {
    if (!data) return []
    return data.endpoints.filter(e => !e.customerId || e.customerId === 'unknown')
  }, [data])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />
      case 'offline': return <Clock className="h-4 w-4 text-gray-500" />
      default: return <Monitor className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-red-100 text-red-800'
      case 'offline': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading RMM data...</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Unable to load RMM data</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">RMM Customer Dashboard</h2>
          <p className="text-sm text-gray-500">
            Showing {data.endpoints.length} of {data.stats.totalEndpoints} total endpoints
            {data.pagination && data.pagination.endpoints.hasMore && (
              <span className="text-orange-600 ml-1">
                (+ {data.pagination.endpoints.total - data.endpoints.length} more)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDebugData}
          >
            🔍 Debug Info
          </Button>
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRMMData(true)}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Customers</p>
                <p className="text-2xl font-bold">{data.stats.totalCustomers}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Endpoints</p>
                <p className="text-2xl font-bold">{data.stats.totalEndpoints}</p>
              </div>
              <Monitor className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Online</p>
                <p className="text-2xl font-bold text-green-600">{data.stats.onlineEndpoints}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Alerts</p>
                <p className="text-2xl font-bold text-red-600">{data.stats.totalAlerts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Customers</CardTitle>
            <Dialog open={showNewCustomer} onOpenChange={setShowNewCustomer}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Customer</DialogTitle>
                  <DialogDescription>
                    Add a new customer to organize your endpoints
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Customer Name</Label>
                    <Input
                      id="name"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={newCustomer.notes}
                      onChange={(e) => setNewCustomer({...newCustomer, notes: e.target.value})}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewCustomer(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createCustomer} disabled={!newCustomer.name}>
                    Create Customer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-2 p-4">
              {data.customers.sort((a, b) => a.name.localeCompare(b.name)).map((customer) => (
                <div
                  key={customer.id}
                  className={`p-3 rounded-lg cursor-pointer border ${
                    selectedCustomer === customer.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedCustomer(customer.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{customer.name}</h4>
                      <p className="text-sm text-gray-500">
                        {customer.endpointCount} endpoints
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs">
                        {customer.status}
                      </Badge>
                      {(customer.activeAlerts || 0) > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {customer.activeAlerts}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {unassignedEndpoints.length > 0 && (
                <div
                  className={`p-3 rounded-lg cursor-pointer border border-orange-200 bg-orange-50`}
                  onClick={() => setSelectedCustomer('unassigned')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-orange-800">Unassigned Endpoints</h4>
                      <p className="text-sm text-orange-600">
                        {unassignedEndpoints.length} endpoints need assignment
                      </p>
                    </div>
                    <UserCheck className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer Details & Endpoints */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCustomer === 'unassigned' ? (
            <Card>
              <CardHeader>
                <CardTitle>Unassigned Endpoints</CardTitle>
                <CardDescription>
                  These endpoints need to be assigned to a customer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {unassignedEndpoints.map((endpoint) => (
                  <div key={endpoint.endpointId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(endpoint.status)}
                      <div>
                        <h4 className="font-medium">{endpoint.hostname}</h4>
                        <p className="text-sm text-gray-500">
                          {endpoint.platform.system} • {endpoint.agentVersion}
                        </p>
                      </div>
                    </div>
                    <Select onValueChange={(customerId) => assignEndpointToCustomer(endpoint.endpointId, customerId)}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Assign to..." />
                      </SelectTrigger>
                      <SelectContent>
                        {data.customers.sort((a, b) => a.name.localeCompare(b.name)).map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : selectedCustomerData ? (
            <>
              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <CardTitle>{selectedCustomerData.name}</CardTitle>
                  <CardDescription>
                    Customer since {new Date(selectedCustomerData.created).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {customerEndpoints.length}
                      </p>
                      <p className="text-sm text-gray-500">Total Endpoints</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {customerEndpoints.filter(e => e.status === 'online').length}
                      </p>
                      <p className="text-sm text-gray-500">Online</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {customerEndpoints.filter(e => e.status === 'critical').length}
                      </p>
                      <p className="text-sm text-gray-500">Critical</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-600">
                        {customerEndpoints.filter(e => e.status === 'offline').length}
                      </p>
                      <p className="text-sm text-gray-500">Offline</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Endpoints */}
              <Card>
                <CardHeader>
                  <CardTitle>Endpoints</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {customerEndpoints.map((endpoint) => (
                    <div
                      key={endpoint.endpointId}
                      className="p-4 border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedEndpoint(endpoint.endpointId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(endpoint.status)}
                          <div>
                            <h4 className="font-medium">{endpoint.hostname}</h4>
                            <p className="text-sm text-gray-500">
                              {endpoint.platform.system} {endpoint.platform.release} •
                              Agent v{endpoint.agentVersion}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusBadgeColor(endpoint.status)}>
                            {endpoint.status}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(endpoint.lastSeen).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {customerEndpoints.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Monitor className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No endpoints assigned to this customer</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium">Select a Customer</p>
                <p className="text-gray-500">Choose a customer from the list to view their endpoints and details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Endpoint Details Modal */}
      {selectedEndpoint && endpointDetails && (
        <Dialog open={!!selectedEndpoint} onOpenChange={() => setSelectedEndpoint(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{endpointDetails.endpoint?.hostname || 'Endpoint Details'}</DialogTitle>
              <DialogDescription>
                System information and current status
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <EndpointDetails endpoint={endpointDetails.endpoint} details={endpointDetails} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Debug Info Modal */}
      {showDebugInfo && debugData && (
        <Dialog open={showDebugInfo} onOpenChange={setShowDebugInfo}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>RMM Debug Information</DialogTitle>
              <DialogDescription>
                System cache and endpoint details for troubleshooting
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Cache Counts</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Endpoints in cache:</span>
                      <span className="font-mono">{debugData.cache_endpoints_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Customers in cache:</span>
                      <span className="font-mono">{debugData.cache_customers_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>System data records:</span>
                      <span className="font-mono">{debugData.cache_systemdata_count}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Endpoint Status</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Online:</span>
                      <span className="font-mono text-green-600">{debugData.endpoints_by_status.online}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Offline:</span>
                      <span className="font-mono text-gray-600">{debugData.endpoints_by_status.offline}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Warning:</span>
                      <span className="font-mono text-yellow-600">{debugData.endpoints_by_status.warning}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Critical:</span>
                      <span className="font-mono text-red-600">{debugData.endpoints_by_status.critical}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Recent Endpoints (Last 10)</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {debugData.recent_endpoints.map((endpoint: any, index: number) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium">{endpoint.hostname}</span>
                          <span className="text-gray-500 ml-2">({endpoint.endpointId.slice(0, 8)}...)</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs">Status: {endpoint.status}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(endpoint.lastSeen).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Cache Last Updated</h4>
                <p className="text-sm font-mono">
                  {debugData.cache_last_updated ? new Date(debugData.cache_last_updated).toLocaleString() : 'Never'}
                </p>
              </div>

              {debugData.cache_endpoints_count !== debugData.all_endpoints_count && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Data Mismatch Detected</AlertTitle>
                  <AlertDescription>
                    Cache shows {debugData.cache_endpoints_count} endpoints but array shows {debugData.all_endpoints_count}.
                    This might indicate a cache synchronization issue.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDebugInfo(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function EndpointDetails({ endpoint, details }: { endpoint: any; details: any }) {
  const latestSystemData = details.systemData?.[0]

  if (!latestSystemData) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No system data available for this endpoint</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">System Information</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Operating System:</span>
              <span>{latestSystemData.platform.system} {latestSystemData.platform.release}</span>
            </div>
            <div className="flex justify-between">
              <span>Architecture:</span>
              <span>{latestSystemData.platform.architecture}</span>
            </div>
            <div className="flex justify-between">
              <span>Processor:</span>
              <span className="truncate ml-2">{latestSystemData.platform.processor}</span>
            </div>
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span>{Math.floor(latestSystemData.uptime_hours / 24)}d {Math.floor(latestSystemData.uptime_hours % 24)}h</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Customer</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>{details.customer?.name || 'Unassigned'}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span>{details.customer?.status || 'Unknown'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">CPU Usage</span>
            <span className="text-sm">{latestSystemData.cpu.percent.toFixed(1)}%</span>
          </div>
          <Progress value={latestSystemData.cpu.percent} className="h-2" />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Memory Usage</span>
            <span className="text-sm">
              {latestSystemData.memory.used_gb.toFixed(1)} / {latestSystemData.memory.total_gb.toFixed(1)} GB
              ({latestSystemData.memory.percent.toFixed(1)}%)
            </span>
          </div>
          <Progress value={latestSystemData.memory.percent} className="h-2" />
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">Disk Usage</span>
          {latestSystemData.disks.map((disk: any, index: number) => (
            <div key={index}>
              <div className="flex justify-between mb-1">
                <span className="text-xs">{disk.device}</span>
                <span className="text-xs">
                  {disk.used_gb.toFixed(1)} / {disk.total_gb.toFixed(1)} GB ({disk.percent_used.toFixed(1)}%)
                </span>
              </div>
              <Progress value={disk.percent_used} className="h-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}