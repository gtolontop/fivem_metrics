/**
 * Background Scanner - Runs on Railway (can do HTTP requests)
 * CF Workers can't do HTTP, only HTTPS
 *
 * CONTINUOUS MODE: Scans all servers, then immediately starts a new cycle
 * Target: 30k servers in ~3-5 minutes per cycle
 */

import { getWorkerBatch, submitScanResults, getQueueStats, requeueAllServersForScan, isQueueEnabled, ScanResult } from './queue'

let isRunning = false
let shouldStop = false

// Balanced: 300 concurrent with reliable timeout
const BATCH_SIZE = 300
const TIMEOUT_MS = 3000
const CYCLE_DELAY_MS = 10000  // 10s pause between cycles

async function scanServer(serverId: string, ip: string): Promise<ScanResult> {
  try {
    // Use AbortSignal.timeout for reliable timeout (Node 18+)
    const res = await fetch(`http://${ip}/info.json`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })

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
  } catch {
    return { serverId, ip, online: false, error: 'timeout' }
  }
}

// Wrapper with hard timeout fallback
async function scanServerSafe(serverId: string, ip: string): Promise<ScanResult> {
  const timeoutPromise = new Promise<ScanResult>((resolve) => {
    setTimeout(() => resolve({ serverId, ip, online: false, error: 'hard_timeout' }), TIMEOUT_MS + 1000)
  })
  return Promise.race([scanServer(serverId, ip), timeoutPromise])
}

async function runContinuousScan(): Promise<void> {
  if (isRunning || !isQueueEnabled()) return

  isRunning = true
  shouldStop = false

  console.log(`[BG-Scan] Starting CONTINUOUS scan (${BATCH_SIZE} concurrent, ${TIMEOUT_MS}ms timeout)`)

  let cycleNumber = 0

  while (!shouldStop) {
    cycleNumber++
    const cycleStart = Date.now()
    let cycleScanned = 0
    let cycleOnline = 0
    let lastLogTime = Date.now()

    console.log(`[BG-Scan] === CYCLE ${cycleNumber} STARTING ===`)

    // Scan until queue is empty
    while (!shouldStop) {
      try {
        // Get big batch of servers
        const tasks = await getWorkerBatch('railway-scanner', 'scan', BATCH_SIZE)

        if (tasks.length === 0) {
          // Queue empty - cycle complete!
          break
        }

        // Filter scan tasks with IPs
        const scanTasks = tasks.filter(t => t.type === 'scan' && t.ip)
        if (scanTasks.length === 0) continue

        const batchStart = Date.now()

        // Scan ALL in parallel with safe timeout wrapper
        const results = await Promise.all(
          scanTasks.map(t => scanServerSafe(t.serverId, t.ip!))
        )

        const batchTime = Date.now() - batchStart

        // Submit results
        const { online } = await submitScanResults(results)

        cycleScanned += results.length
        cycleOnline += online

        // Log progress every 5 seconds
        if (Date.now() - lastLogTime > 5000) {
          const elapsed = (Date.now() - cycleStart) / 1000
          const rate = Math.round(cycleScanned / elapsed)
          const stats = await getQueueStats()
          console.log(`[BG-Scan] Cycle ${cycleNumber}: ${cycleScanned} scanned (${cycleOnline} online) | ${rate}/s | ${stats.pendingScan} pending | batch ${batchTime}ms`)
          lastLogTime = Date.now()
        }

      } catch (e) {
        console.error('[BG-Scan] Error:', e)
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    // Cycle complete
    const cycleDuration = Math.round((Date.now() - cycleStart) / 1000)
    console.log(`[BG-Scan] === CYCLE ${cycleNumber} COMPLETE === ${cycleScanned} servers in ${cycleDuration}s (${cycleOnline} online)`)

    if (shouldStop) break

    // Small pause before starting next cycle
    console.log(`[BG-Scan] Waiting ${CYCLE_DELAY_MS / 1000}s before next cycle...`)
    await new Promise(r => setTimeout(r, CYCLE_DELAY_MS))

    if (shouldStop) break

    // Requeue all servers for next cycle
    const requeued = await requeueAllServersForScan()
    if (requeued === 0) {
      console.log(`[BG-Scan] No servers to scan, waiting 30s...`)
      await new Promise(r => setTimeout(r, 30000))
    }
  }

  isRunning = false
  console.log(`[BG-Scan] Scanner stopped after ${cycleNumber} cycles`)
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
