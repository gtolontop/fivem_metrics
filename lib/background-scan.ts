/**
 * Background Scanner - Runs on Railway (can do HTTP requests)
 * CF Workers can't do HTTP, only HTTPS
 */

import { getWorkerBatch, submitScanResults, getQueueStats, isQueueEnabled, ScanResult } from './queue'

let isScanning = false
let scanInterval: ReturnType<typeof setInterval> | null = null

// Railway can handle larger batches than CF Workers
const BATCH_SIZE = 100

async function scanServer(serverId: string, ip: string): Promise<ScanResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`http://${ip}/info.json`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return { serverId, ip, online: false, error: `http_${res.status}` }
    }

    const data = await res.json() as { resources?: string[], vars?: { sv_maxClients?: string } }
    return {
      serverId,
      ip,
      online: true,
      resources: data.resources || [],
      players: data.vars?.sv_maxClients ? parseInt(data.vars.sv_maxClients) : 0
    }
  } catch (e) {
    return { serverId, ip, online: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}

async function runScanBatch(): Promise<{ scanned: number, online: number }> {
  if (isScanning || !isQueueEnabled()) return { scanned: 0, online: 0 }

  isScanning = true

  try {
    // Get batch of servers to scan (100 at a time for Railway)
    const tasks = await getWorkerBatch('railway-scanner', 'scan', BATCH_SIZE)

    if (tasks.length === 0) {
      return { scanned: 0, online: 0 }
    }

    // Filter only scan tasks with IPs
    const scanTasks = tasks.filter(t => t.type === 'scan' && t.ip)

    if (scanTasks.length === 0) {
      return { scanned: 0, online: 0 }
    }

    // Scan in parallel
    const results = await Promise.all(
      scanTasks.map(t => scanServer(t.serverId, t.ip!))
    )

    // Submit results
    const { online } = await submitScanResults(results)

    console.log(`[BG-Scan] Scanned ${results.length}, online: ${online}`)
    return { scanned: results.length, online }

  } catch (e) {
    console.error('[BG-Scan] Error:', e)
    return { scanned: 0, online: 0 }
  } finally {
    isScanning = false
  }
}

export function startBackgroundScanner() {
  if (scanInterval) return

  console.log('[BG-Scan] Starting background scanner')

  // Run every 10 seconds
  scanInterval = setInterval(async () => {
    const stats = await getQueueStats()
    if (stats.pendingScan > 0) {
      await runScanBatch()
    }
  }, 10000)

  // Run immediately
  runScanBatch()
}

export function stopBackgroundScanner() {
  if (scanInterval) {
    clearInterval(scanInterval)
    scanInterval = null
    console.log('[BG-Scan] Stopped')
  }
}

export { runScanBatch }
