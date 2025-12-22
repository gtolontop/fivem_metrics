/**
 * Worker Stateless - Fonctionne avec le nouveau système de queue
 *
 * Usage:
 *   npx ts-node scripts/worker.ts
 *
 * Env vars:
 *   API_BASE - URL de l'API (default: http://localhost:3005)
 *   WORKER_ID - ID unique du worker (auto-généré si absent)
 *   PREFER_TYPE - 'ip_fetch' ou 'scan' (default: ip_fetch)
 *
 * Le worker est 100% stateless:
 * 1. Demande du travail à /api/queue/work
 * 2. Exécute les tâches (fetch IP ou scan serveur)
 * 3. Soumet les résultats à /api/queue/submit
 * 4. Répète
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3005'
const WORKER_ID = process.env.WORKER_ID || `worker-${Math.random().toString(36).slice(2, 8)}`
const PREFER_TYPE = (process.env.PREFER_TYPE as 'ip_fetch' | 'scan') || 'ip_fetch'

// Types
interface WorkerTask {
  type: 'ip_fetch' | 'scan'
  serverId: string
  ip?: string
}

interface IpResult {
  serverId: string
  ip: string | null
  error?: string
}

interface ScanResult {
  serverId: string
  ip: string
  online: boolean
  resources?: string[]
  players?: number
  error?: string
}

// Stats
let totalTasks = 0
let successTasks = 0
let failedTasks = 0
const startTime = Date.now()

// ============================================================================
// TASK EXECUTORS
// ============================================================================

/**
 * Récupère l'IP d'un serveur via l'API FiveM
 */
async function fetchIpForServer(serverId: string): Promise<IpResult> {
  try {
    const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    })

    if (res.status === 429) {
      // Rate limited - return as error to retry later
      return { serverId, ip: null, error: 'rate_limited' }
    }

    if (!res.ok) {
      return { serverId, ip: null, error: `http_${res.status}` }
    }

    const data = await res.json()
    const endpoints = data.Data?.connectEndPoints
    const ip = endpoints?.[0] || null

    return { serverId, ip }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'unknown'
    return { serverId, ip: null, error }
  }
}

/**
 * Scan un serveur directement pour récupérer ses resources
 */
async function scanServer(serverId: string, ip: string): Promise<ScanResult> {
  try {
    const res = await fetch(`http://${ip}/info.json`, {
      signal: AbortSignal.timeout(5000) // 5s timeout
    })

    if (!res.ok) {
      return { serverId, ip, online: false, error: `http_${res.status}` }
    }

    const data = await res.json()
    const resources = data.resources || []
    const players = data.vars?.sv_maxClients
      ? parseInt(data.vars.sv_maxClients)
      : 0

    return {
      serverId,
      ip,
      online: true,
      resources,
      players
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'unknown'
    // Timeout ou connection refused = serveur offline/unavailable
    return { serverId, ip, online: false, error }
  }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function getWork(): Promise<WorkerTask[]> {
  try {
    const res = await fetch(`${API_BASE}/api/queue/work?worker=${WORKER_ID}&type=${PREFER_TYPE}`)
    const data = await res.json()
    return data.tasks || []
  } catch (e) {
    console.error(`[${WORKER_ID}] Failed to get work:`, e)
    return []
  }
}

async function submitResults(type: 'ip_results' | 'scan_results', results: IpResult[] | ScanResult[]): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/queue/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, results, workerId: WORKER_ID })
    })
    const data = await res.json()

    if (type === 'ip_results') {
      console.log(`[${WORKER_ID}] IPs: ${data.success} success, ${data.failed} failed`)
    } else {
      console.log(`[${WORKER_ID}] Scan: ${data.online} online, ${data.offline} offline, ${data.error} errors`)
    }
  } catch (e) {
    console.error(`[${WORKER_ID}] Failed to submit:`, e)
  }
}

async function processIpFetchTasks(tasks: WorkerTask[]): Promise<void> {
  console.log(`[${WORKER_ID}] Fetching IPs for ${tasks.length} servers...`)

  // Parallel fetch (tous en même temps)
  const results = await Promise.all(
    tasks.map(task => fetchIpForServer(task.serverId))
  )

  const successes = results.filter(r => r.ip !== null)
  successTasks += successes.length
  failedTasks += results.length - successes.length

  await submitResults('ip_results', results)
}

async function processScanTasks(tasks: WorkerTask[]): Promise<void> {
  console.log(`[${WORKER_ID}] Scanning ${tasks.length} servers...`)

  // Parallel scan (tous en même temps)
  const results = await Promise.all(
    tasks
      .filter(task => task.ip)
      .map(task => scanServer(task.serverId, task.ip!))
  )

  const onlineCount = results.filter(r => r.online).length
  successTasks += onlineCount
  failedTasks += results.length - onlineCount

  await submitResults('scan_results', results)
}

async function runWorkerLoop() {
  console.log(`[${WORKER_ID}] Starting worker...`)
  console.log(`[${WORKER_ID}] API: ${API_BASE}`)
  console.log(`[${WORKER_ID}] Prefer: ${PREFER_TYPE}`)
  console.log('')

  let consecutiveEmpty = 0
  const MAX_EMPTY = 10

  while (true) {
    try {
      const tasks = await getWork()
      totalTasks += tasks.length

      if (tasks.length === 0) {
        consecutiveEmpty++

        if (consecutiveEmpty >= MAX_EMPTY) {
          console.log(`[${WORKER_ID}] No work for ${MAX_EMPTY} cycles. Waiting 30s...`)
          await new Promise(r => setTimeout(r, 30000))
          consecutiveEmpty = 0
        } else {
          await new Promise(r => setTimeout(r, 2000))
        }
        continue
      }

      consecutiveEmpty = 0

      // Séparer les tâches par type
      const ipFetchTasks = tasks.filter(t => t.type === 'ip_fetch')
      const scanTasks = tasks.filter(t => t.type === 'scan')

      // Exécuter en parallèle les deux types
      const promises: Promise<void>[] = []

      if (ipFetchTasks.length > 0) {
        promises.push(processIpFetchTasks(ipFetchTasks))
      }

      if (scanTasks.length > 0) {
        promises.push(processScanTasks(scanTasks))
      }

      await Promise.all(promises)

      // Stats
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      const rate = totalTasks > 0 ? Math.round(totalTasks / (elapsed / 60)) : 0
      console.log(`[${WORKER_ID}] Stats: ${totalTasks} tasks, ${successTasks} success, ${failedTasks} failed, ${rate}/min`)

      // Petit délai entre les batches pour pas spammer
      await new Promise(r => setTimeout(r, 500))

    } catch (e) {
      console.error(`[${WORKER_ID}] Loop error:`, e)
      await new Promise(r => setTimeout(r, 5000))
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n[${WORKER_ID}] Shutting down...`)
  console.log(`[${WORKER_ID}] Final stats: ${totalTasks} tasks, ${successTasks} success, ${failedTasks} failed`)
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log(`\n[${WORKER_ID}] Terminated`)
  process.exit(0)
})

// Start
runWorkerLoop()
