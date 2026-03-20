/**
 * RMM Cache - Remote Monitoring and Management endpoint data
 * Replaces ATERA functionality with custom solution
 * Enhanced with Customer Management
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence'
import { loadCacheFromDisk, saveCacheToDisk } from './cacheUtils'

export interface RMMCustomer {
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
}

export interface RMMEndpoint {
  endpointId: string
  customerId: string  // Added customer association
  hostname: string
  description?: string  // Added for better organization
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
  location?: {
    lat?: number
    lng?: number
    address?: string
  }
  tags?: string[]  // Added for categorization
}

export interface RMMSystemData {
  endpointId: string
  timestamp: string
  hostname: string
  platform: RMMEndpoint['platform']
  cpu: {
    percent: number
    count: number
    frequency_mhz?: number
  }
  memory: {
    total_gb: number
    available_gb: number
    used_gb: number
    percent: number
  }
  swap: {
    total_gb: number
    used_gb: number
    percent: number
  }
  disks: Array<{
    device: string
    mountpoint: string
    fstype: string
    total_gb: number
    used_gb: number
    free_gb: number
    percent_used: number
  }>
  network: {
    bytes_sent: number
    bytes_recv: number
    packets_sent: number
    packets_recv: number
    interfaces: Array<{
      interface: string
      ip_address: string
      netmask: string
    }>
  }
  uptime_hours: number
  boot_time: string
}

export interface RMMProcess {
  pid: number
  name: string
  cpu_percent: number
  memory_percent: number
  created: string
}

export interface RMMProcessData {
  endpointId: string
  timestamp: string
  processes: RMMProcess[]
}

export interface RMMAssetData {
  endpointId: string
  timestamp: string
  hardware: {
    system?: {
      manufacturer: string
      model: string
      total_memory_gb?: number
    }
    cpu?: {
      name: string
      manufacturer: string
      cores: number
      threads: number
      max_speed_ghz?: number
    }
  }
  software: Array<{
    name: string
    version: string
    publisher: string
  }>
}

export interface RMMAlert {
  id: string
  endpointId: string
  customerId: string  // Added customer association
  timestamp: string
  type: 'cpu_high' | 'memory_high' | 'disk_low' | 'offline' | 'security_issue'
  severity: 'info' | 'warning' | 'critical'
  message: string
  resolved: boolean
  resolvedAt?: string
  acknowledgedBy?: string
  acknowledgedAt?: string
}

export interface RMMSecurityData {
  endpointId: string
  timestamp: string
  antivirus: {
    status: string
    product?: string
    last_scan?: string
    signatures_updated?: string
  }
  windows_updates: {
    status: string
    pending_count?: number
  }
  firewall: {
    status: string
  }
}

export interface RMMCacheData {
  customers: Record<string, RMMCustomer>     // Added customer management
  endpoints: Record<string, RMMEndpoint>
  systemData: Record<string, RMMSystemData[]>
  processes: Record<string, RMMProcessData>
  assets: Record<string, RMMAssetData>
  alerts: Record<string, RMMAlert[]>
  security: Record<string, RMMSecurityData>
  _buildInProgress?: boolean
  _buildStartedAt?: number
  _lastUpdated?: string
}

let rmmCache: RMMCacheData = {
  customers: {},
  endpoints: {},
  systemData: {},
  processes: {},
  assets: {},
  alerts: {},
  security: {}
}

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000 // 12 minutes

function isBuildInProgress(): boolean {
  if (!rmmCache._buildInProgress) return false
  if (!rmmCache._buildStartedAt) return false

  const now = Date.now()
  if (now - rmmCache._buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    rmmCache._buildInProgress = false
    rmmCache._buildStartedAt = undefined
    console.log('RMM cache build lock auto-cleared (timeout)')
    return false
  }

  return true
}

export function getRMMCache(): RMMCacheData {
  if (Object.keys(rmmCache.endpoints).length === 0 && Object.keys(rmmCache.customers).length === 0) {
    const diskData = loadCacheFromDisk<RMMCacheData>('rmm')
    if (diskData && (Object.keys(diskData.endpoints || {}).length > 0 || Object.keys(diskData.customers || {}).length > 0)) {
      rmmCache = diskData
    }
  }
  return rmmCache
}

export async function setRMMCache(data: RMMCacheData): Promise<void> {
  rmmCache = {
    ...data,
    _lastUpdated: new Date().toISOString()
  }
  saveCacheToDisk('rmm', rmmCache)
  await saveCacheToBlob('rmm', rmmCache)
}

export async function ensureWarmed(): Promise<RMMCacheData> {
  if (Object.keys(rmmCache.endpoints).length === 0 && Object.keys(rmmCache.customers).length === 0) {
    const diskData = loadCacheFromDisk<RMMCacheData>('rmm')
    if (diskData && (Object.keys(diskData.endpoints || {}).length > 0 || Object.keys(diskData.customers || {}).length > 0)) {
      rmmCache = diskData
    }
  }

  if (Object.keys(rmmCache.endpoints).length === 0 && Object.keys(rmmCache.customers).length === 0) {
    console.log('RMM cache empty, loading from blob...')
    const blobData = await loadCacheFromBlob<RMMCacheData>('rmm')
    if (blobData && (Object.keys(blobData.endpoints || {}).length > 0 || Object.keys(blobData.customers || {}).length > 0)) {
      rmmCache = blobData
      saveCacheToDisk('rmm', rmmCache)
    }
  }

  return rmmCache
}

// Customer management functions
export async function createCustomer(customerData: Omit<RMMCustomer, 'id' | 'created' | 'lastModified' | 'endpointCount'>): Promise<RMMCustomer> {
  const cache = getRMMCache()

  const customer: RMMCustomer = {
    ...customerData,
    id: generateCustomerId(),
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    endpointCount: 0
  }

  cache.customers[customer.id] = customer
  await setRMMCache(cache)

  return customer
}

export async function updateCustomer(customerId: string, updates: Partial<RMMCustomer>): Promise<RMMCustomer | null> {
  const cache = getRMMCache()

  if (!cache.customers[customerId]) {
    return null
  }

  cache.customers[customerId] = {
    ...cache.customers[customerId],
    ...updates,
    lastModified: new Date().toISOString()
  }

  await setRMMCache(cache)
  return cache.customers[customerId]
}

export async function assignEndpointToCustomer(endpointId: string, customerId: string): Promise<boolean> {
  const cache = getRMMCache()

  if (!cache.endpoints[endpointId] || !cache.customers[customerId]) {
    return false
  }

  const oldCustomerId = cache.endpoints[endpointId].customerId

  // Update endpoint
  cache.endpoints[endpointId].customerId = customerId

  // Update customer endpoint counts
  if (oldCustomerId && cache.customers[oldCustomerId]) {
    cache.customers[oldCustomerId].endpointCount = Math.max(0, cache.customers[oldCustomerId].endpointCount - 1)
    cache.customers[oldCustomerId].lastModified = new Date().toISOString()
  }

  cache.customers[customerId].endpointCount += 1
  cache.customers[customerId].lastModified = new Date().toISOString()

  // Update alerts with customer ID
  if (cache.alerts[endpointId]) {
    cache.alerts[endpointId] = cache.alerts[endpointId].map(alert => ({
      ...alert,
      customerId
    }))
  }

  await setRMMCache(cache)
  return true
}

function generateCustomerId(): string {
  return 'cust_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
}

// Enhanced data update functions
export async function updateEndpointHeartbeat(endpointId: string, hostname: string, agentVersion: string): Promise<void> {
  const cache = getRMMCache()

  const existing = cache.endpoints[endpointId]
  if (existing) {
    // Update existing endpoint
    cache.endpoints[endpointId] = {
      ...existing,
      hostname,
      agentVersion,
      lastSeen: new Date().toISOString(),
      status: 'online'
    }
  } else {
    // Create new endpoint - assign to default customer if none exists
    let defaultCustomerId = Object.keys(cache.customers)[0]

    if (!defaultCustomerId) {
      // Create default customer
      const defaultCustomer = await createCustomer({
        name: 'Default Customer',
        status: 'active',
        notes: 'Auto-created for unassigned endpoints'
      })
      defaultCustomerId = defaultCustomer.id
    }

    cache.endpoints[endpointId] = {
      endpointId,
      customerId: defaultCustomerId,
      hostname,
      agentVersion,
      lastSeen: new Date().toISOString(),
      status: 'online',
      platform: {
        system: 'Unknown',
        release: 'Unknown',
        version: 'Unknown',
        architecture: 'Unknown',
        processor: 'Unknown'
      }
    }

    // Update customer endpoint count
    cache.customers[defaultCustomerId].endpointCount += 1
    cache.customers[defaultCustomerId].lastModified = new Date().toISOString()
  }

  await setRMMCache(cache)
}

export async function updateSystemData(data: RMMSystemData): Promise<void> {
  const cache = getRMMCache()

  // Keep last 24 hours of data (288 samples at 5-min intervals)
  if (!cache.systemData[data.endpointId]) {
    cache.systemData[data.endpointId] = []
  }

  cache.systemData[data.endpointId].unshift(data)
  cache.systemData[data.endpointId] = cache.systemData[data.endpointId].slice(0, 288)

  // Update endpoint status based on metrics
  if (cache.endpoints[data.endpointId]) {
    const endpoint = cache.endpoints[data.endpointId]
    endpoint.lastSeen = data.timestamp

    // Determine status based on thresholds
    if (data.cpu.percent > 90 || data.memory.percent > 95) {
      endpoint.status = 'critical'
    } else if (data.cpu.percent > 80 || data.memory.percent > 85 ||
               data.disks.some(disk => disk.percent_used > 90)) {
      endpoint.status = 'warning'
    } else {
      endpoint.status = 'online'
    }

    // Update platform info
    endpoint.platform = data.platform
  }

  // Generate alerts for critical conditions
  await checkAndGenerateAlerts(data)

  await setRMMCache(cache)
}

export async function updateProcessData(data: RMMProcessData): Promise<void> {
  const cache = getRMMCache()
  cache.processes[data.endpointId] = data
  await setRMMCache(cache)
}

export async function updateAssetData(data: RMMAssetData): Promise<void> {
  const cache = getRMMCache()
  cache.assets[data.endpointId] = data
  await setRMMCache(cache)
}

export async function updateSecurityData(data: RMMSecurityData): Promise<void> {
  const cache = getRMMCache()
  cache.security[data.endpointId] = data

  // Generate security alerts
  const endpoint = cache.endpoints[data.endpointId]
  const customerId = endpoint?.customerId || 'unknown'
  const alerts: RMMAlert[] = []

  if (data.antivirus.status === 'disabled') {
    alerts.push({
      id: `${data.endpointId}-antivirus-disabled`,
      endpointId: data.endpointId,
      customerId,
      timestamp: data.timestamp,
      type: 'security_issue',
      severity: 'critical',
      message: 'Antivirus protection is disabled',
      resolved: false
    })
  }

  if (data.windows_updates.status === 'updates_available' &&
      (data.windows_updates.pending_count || 0) > 10) {
    alerts.push({
      id: `${data.endpointId}-updates-pending`,
      endpointId: data.endpointId,
      customerId,
      timestamp: data.timestamp,
      type: 'security_issue',
      severity: 'warning',
      message: `${data.windows_updates.pending_count} Windows updates pending`,
      resolved: false
    })
  }

  if (alerts.length > 0) {
    if (!cache.alerts[data.endpointId]) {
      cache.alerts[data.endpointId] = []
    }
    cache.alerts[data.endpointId].push(...alerts)
  }

  await setRMMCache(cache)
}

async function checkAndGenerateAlerts(systemData: RMMSystemData): Promise<void> {
  const cache = getRMMCache()
  const endpoint = cache.endpoints[systemData.endpointId]
  const customerId = endpoint?.customerId || 'unknown'
  const alerts: RMMAlert[] = []

  // CPU alerts
  if (systemData.cpu.percent > 90) {
    alerts.push({
      id: `${systemData.endpointId}-cpu-critical`,
      endpointId: systemData.endpointId,
      customerId,
      timestamp: systemData.timestamp,
      type: 'cpu_high',
      severity: 'critical',
      message: `CPU usage at ${systemData.cpu.percent.toFixed(1)}%`,
      resolved: false
    })
  }

  // Memory alerts
  if (systemData.memory.percent > 95) {
    alerts.push({
      id: `${systemData.endpointId}-memory-critical`,
      endpointId: systemData.endpointId,
      customerId,
      timestamp: systemData.timestamp,
      type: 'memory_high',
      severity: 'critical',
      message: `Memory usage at ${systemData.memory.percent.toFixed(1)}%`,
      resolved: false
    })
  }

  // Disk space alerts
  for (const disk of systemData.disks) {
    if (disk.percent_used > 95) {
      alerts.push({
        id: `${systemData.endpointId}-disk-${disk.device.replace(':', '')}-critical`,
        endpointId: systemData.endpointId,
        customerId,
        timestamp: systemData.timestamp,
        type: 'disk_low',
        severity: 'critical',
        message: `Disk ${disk.device} at ${disk.percent_used.toFixed(1)}% capacity`,
        resolved: false
      })
    }
  }

  if (alerts.length > 0) {
    if (!cache.alerts[systemData.endpointId]) {
      cache.alerts[systemData.endpointId] = []
    }

    // Add new alerts and remove duplicates
    for (const alert of alerts) {
      const existingIndex = cache.alerts[systemData.endpointId].findIndex(a => a.id === alert.id)
      if (existingIndex === -1) {
        cache.alerts[systemData.endpointId].push(alert)
      } else {
        // Update existing alert
        cache.alerts[systemData.endpointId][existingIndex] = alert
      }
    }
  }
}

export async function markEndpointsOffline(): Promise<void> {
  const cache = getRMMCache()
  const now = new Date()
  const offlineThreshold = 15 * 60 * 1000 // 15 minutes

  for (const [endpointId, endpoint] of Object.entries(cache.endpoints)) {
    const lastSeen = new Date(endpoint.lastSeen)
    const timeSinceLastSeen = now.getTime() - lastSeen.getTime()

    if (timeSinceLastSeen > offlineThreshold && endpoint.status !== 'offline') {
      endpoint.status = 'offline'

      // Generate offline alert
      if (!cache.alerts[endpointId]) {
        cache.alerts[endpointId] = []
      }

      cache.alerts[endpointId].push({
        id: `${endpointId}-offline`,
        endpointId,
        customerId: endpoint.customerId,
        timestamp: now.toISOString(),
        type: 'offline',
        severity: 'warning',
        message: `Endpoint went offline (last seen: ${endpoint.lastSeen})`,
        resolved: false
      })
    }
  }

  await setRMMCache(cache)
}

export function getRMMStats(): {
  totalCustomers: number
  totalEndpoints: number
  onlineEndpoints: number
  offlineEndpoints: number
  criticalEndpoints: number
  warningEndpoints: number
  totalAlerts: number
  criticalAlerts: number
} {
  const cache = getRMMCache()

  const endpoints = Object.values(cache.endpoints)
  const totalAlerts = Object.values(cache.alerts).flat()

  return {
    totalCustomers: Object.keys(cache.customers).length,
    totalEndpoints: endpoints.length,
    onlineEndpoints: endpoints.filter(e => e.status === 'online').length,
    offlineEndpoints: endpoints.filter(e => e.status === 'offline').length,
    criticalEndpoints: endpoints.filter(e => e.status === 'critical').length,
    warningEndpoints: endpoints.filter(e => e.status === 'warning').length,
    totalAlerts: totalAlerts.filter(a => !a.resolved).length,
    criticalAlerts: totalAlerts.filter(a => !a.resolved && a.severity === 'critical').length
  }
}

// Customer-specific functions
export function getEndpointsByCustomer(customerId: string): RMMEndpoint[] {
  const cache = getRMMCache()
  return Object.values(cache.endpoints).filter(endpoint => endpoint.customerId === customerId)
}

export function getAlertsByCustomer(customerId: string): RMMAlert[] {
  const cache = getRMMCache()
  return Object.values(cache.alerts)
    .flat()
    .filter(alert => alert.customerId === customerId && !alert.resolved)
}