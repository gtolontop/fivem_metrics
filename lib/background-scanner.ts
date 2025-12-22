// Background Scanner - Runs on the server, scans resources once IPs are available
// Uses direct server hits - NO RATE LIMIT!

import { getServersWithIp, addScannedServer, getScannedCount, getCache } from './cache'

interface ScanResult {
  serverId: string
  resources: string[]
  players: number
  online: boolean
}

const PARALLEL_REQUESTS = 200
const TIMEOUT_MS = 3000
const SCAN_INTERVAL = 60 * 1000 // 1 minute

let isScanning = false
let lastScanTime = 0

async function scanServer(ip: string): Promise<string[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(`http://${ip}/info.json`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    clearTimeout(timeout)

    if (!res.ok) return []
    const data = await res.json()
    return data.resources || []
  } catch {
    return []
  }
}

export async function runScan(): Promise<{
  scanned: number
  online: number
  resources: number
  timeMs: number
}> {
  if (isScanning) {
    return { scanned: 0, online: 0, resources: 0, timeMs: 0 }
  }

  isScanning = true
  const startTime = Date.now()

  try {
    const serversWithIp = getServersWithIp()

    if (serversWithIp.length === 0) {
      return { scanned: 0, online: 0, resources: 0, timeMs: 0 }
    }

    let scanned = 0
    let online = 0
    const allResources = new Set<string>()

    // Process in batches
    for (let i = 0; i < serversWithIp.length; i += PARALLEL_REQUESTS) {
      const batch = serversWithIp.slice(i, i + PARALLEL_REQUESTS)

      const promises = batch.map(async ({ server, ip }): Promise<ScanResult> => {
        const resources = await scanServer(ip)
        return {
          serverId: server.id,
          resources,
          players: server.players,
          online: resources.length > 0
        }
      })

      const results = await Promise.all(promises)

      // Process results
      for (const result of results) {
        scanned++
        if (result.online) {
          online++
          addScannedServer(result.serverId, result.resources, result.players)
          result.resources.forEach(r => allResources.add(r))
        }
      }
    }

    lastScanTime = Date.now()
    const timeMs = Date.now() - startTime

    console.log(`[BG-SCAN] Done in ${timeMs}ms: ${scanned} servers, ${online} online, ${allResources.size} resources`)

    return { scanned, online, resources: allResources.size, timeMs }
  } finally {
    isScanning = false
  }
}

// Check if we should run a scan
export function shouldScan(): boolean {
  if (isScanning) return false
  if (Date.now() - lastScanTime < SCAN_INTERVAL) return false

  const serversWithIp = getServersWithIp()
  return serversWithIp.length > 0
}

// Get scan status
export function getScanStatus() {
  const cache = getCache()
  return {
    isScanning,
    lastScanTime,
    scannedCount: getScannedCount(),
    resourceCount: cache.resources.length,
    serversWithIp: getServersWithIp().length
  }
}

// Start background scanning loop (call this on server startup)
let scanInterval: ReturnType<typeof setInterval> | null = null

export function startBackgroundScanner() {
  if (scanInterval) return

  console.log('[BG-SCAN] Starting background scanner')

  scanInterval = setInterval(async () => {
    if (shouldScan()) {
      console.log('[BG-SCAN] Starting scan...')
      await runScan()
    }
  }, 30000) // Check every 30 seconds

  // Run initial scan
  if (shouldScan()) {
    runScan()
  }
}

export function stopBackgroundScanner() {
  if (scanInterval) {
    clearInterval(scanInterval)
    scanInterval = null
    console.log('[BG-SCAN] Stopped background scanner')
  }
}
