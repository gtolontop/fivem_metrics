/**
 * Background Scanner - Runs on Railway (can do HTTP requests)
 * CF Workers can't do HTTP, only HTTPS
 *
 * FAST MODE: 500 concurrent requests, continuous scanning
 * Target: 30k servers in ~3-5 minutes
 */

import { getWorkerBatch, submitScanResults, getQueueStats, isQueueEnabled, ScanResult } from './queue'

let isRunning = false
let shouldStop = false

// FAST: 500 concurrent connections, 3s timeout
const BATCH_SIZE = 500
const TIMEOUT_MS = 3000

async function scanServer(serverId: string, ip: string): Promise<ScanResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

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

async function runContinuousScan(): Promise<void> {
  if (isRunning || !isQueueEnabled()) return

  isRunning = true
  shouldStop = false

  console.log(`[BG-Scan] Starting FAST scan (${BATCH_SIZE} concurrent, ${TIMEOUT_MS}ms timeout)`)

  const startTime = Date.now()
  let totalScanned = 0
  let totalOnline = 0
  let lastLogTime = Date.now()

  while (!shouldStop) {
    try {
      // Get big batch of servers
      const tasks = await getWorkerBatch('railway-scanner', 'scan', BATCH_SIZE)

      if (tasks.length === 0) {
        // Queue empty, wait a bit and check again
        await new Promise(r => setTimeout(r, 5000))

        const stats = await getQueueStats()
        if (stats.pendingScan === 0) {
          console.log(`[BG-Scan] Queue empty, waiting for more work...`)
          await new Promise(r => setTimeout(r, 30000))
        }
        continue
      }

      // Filter scan tasks with IPs
      const scanTasks = tasks.filter(t => t.type === 'scan' && t.ip)
      if (scanTasks.length === 0) continue

      // Scan ALL in parallel (no chunking - full speed!)
      const results = await Promise.all(
        scanTasks.map(t => scanServer(t.serverId, t.ip!))
      )

      // Submit results
      const { online } = await submitScanResults(results)

      totalScanned += results.length
      totalOnline += online

      // Log progress every 5 seconds
      if (Date.now() - lastLogTime > 5000) {
        const elapsed = (Date.now() - startTime) / 1000
        const rate = Math.round(totalScanned / elapsed)
        const stats = await getQueueStats()
        console.log(`[BG-Scan] ${totalScanned} scanned (${totalOnline} online) | ${rate}/s | ${stats.pendingScan} pending`)
        lastLogTime = Date.now()
      }

    } catch (e) {
      console.error('[BG-Scan] Error:', e)
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  isRunning = false
  console.log(`[BG-Scan] Stopped. Total: ${totalScanned} scanned, ${totalOnline} online`)
}

export function startBackgroundScanner() {
  if (isRunning) return
  runContinuousScan()
}

export function stopBackgroundScanner() {
  shouldStop = true
  console.log('[BG-Scan] Stop requested')
}

// For backwards compatibility
async function runScanBatch(): Promise<{ scanned: number, online: number }> {
  // Just trigger the continuous scan if not running
  if (!isRunning) startBackgroundScanner()
  return { scanned: 0, online: 0 }
}

export { runScanBatch }
