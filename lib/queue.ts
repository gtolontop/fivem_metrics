import Redis from 'ioredis'

// Redis connection
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : null

// ============================================================================
// REDIS KEYS - Architecture propre
// ============================================================================

// Queues (Lists - LPUSH/RPOP pour FIFO)
const QUEUE_IP_FETCH = 'queue:ip_fetch'           // Serveurs dont on doit récupérer l'IP
const QUEUE_SCAN = 'queue:scan'                   // Serveurs à scanner (ont déjà une IP)

// Données permanentes (Hashes)
const DATA_IPS = 'data:ips'                       // cfxId -> IP (permanent, toutes les IPs connues)
const DATA_STATUS = 'data:server_status'          // cfxId -> 'online' | 'offline' | 'unavailable'
const DATA_RESOURCES = 'data:resources'           // JSON des ressources agrégées (full list)
const DATA_RESOURCES_TOP = 'data:resources_top'   // JSON des top 100 resources (lightweight for SSE)
const DATA_SERVER_RESOURCES = 'data:server_resources' // cfxId -> JSON des resources du serveur
const DATA_SERVER_PLAYERS = 'data:server_players' // cfxId -> real player count from protobuf

// Timestamps (Hashes)
const TS_IP_FETCH = 'ts:ip_fetch'                 // cfxId -> timestamp dernière récup IP
const TS_SCAN = 'ts:scan'                         // cfxId -> timestamp dernier scan
const TS_LAST_SEEN = 'ts:last_seen'               // cfxId -> timestamp dernière fois online

// Sets pour tracking rapide
const SET_ALL_SERVERS = 'set:all_servers'         // Tous les serveurs connus
const SET_PROCESSING = 'set:processing'           // Serveurs en cours de traitement (évite doublons)

// Stats
const STATS_KEY = 'stats:global'
const STATS_TOTAL_SERVERS = 'stats:total_servers'  // Fixed total from last init

// Performance counters (incremented atomically, avoid hgetall)
const COUNTER_ONLINE = 'counter:online'
const COUNTER_OFFLINE = 'counter:offline'
const COUNTER_UNAVAILABLE = 'counter:unavailable'

// Resource index (Set per resource for O(1) lookup)
// Key format: resource:index:{resourceName} -> Set of serverIds
const RESOURCE_INDEX_PREFIX = 'resource:index:'

// ============================================================================
// CONFIG
// ============================================================================

const IP_REFRESH_HOURS = 24        // Re-fetch IP après 24h
const SCAN_REFRESH_HOURS = 1       // Re-scan après 1h
const UNAVAILABLE_RETRY_HOURS = 6  // Re-essayer les unavailable après 6h
const PROCESSING_TIMEOUT_MS = 60000 // Timeout si un worker ne répond pas en 60s
const BATCH_SIZE = 20              // Nombre de serveurs par batch (20 pour CF Workers limit)

// ============================================================================
// TYPES
// ============================================================================

export type ServerStatus = 'online' | 'offline' | 'unavailable' | 'unknown'

export interface QueueStats {
  pendingIpFetch: number
  pendingScan: number
  totalServers: number
  totalWithIp: number
  totalOnline: number
  totalOffline: number
  totalUnavailable: number
  processing: number
}

export interface WorkerTask {
  type: 'ip_fetch' | 'scan'
  serverId: string
  ip?: string // Seulement pour scan
}

export interface IpResult {
  serverId: string
  ip: string | null
  error?: string
}

export interface ScanResult {
  serverId: string
  ip: string
  online: boolean
  resources?: string[]
  players?: number
  error?: string
}

// ============================================================================
// QUEUE OPERATIONS
// ============================================================================

/**
 * Initialise les queues avec la liste des serveurs
 * Appelé au démarrage avec la liste FiveM
 */
export async function initializeQueues(serverIds: string[]): Promise<{ added: number, skipped: number }> {
  if (!redis) return { added: 0, skipped: 0 }

  const now = Date.now()
  const ipRefreshThreshold = now - (IP_REFRESH_HOURS * 60 * 60 * 1000)

  let added = 0
  let skipped = 0

  // Ajouter tous les serveurs au set global
  if (serverIds.length > 0) {
    await redis.sadd(SET_ALL_SERVERS, ...serverIds)
  }

  // Récupérer les IPs et timestamps existants
  const [existingIps, ipTimestamps] = await Promise.all([
    redis.hgetall(DATA_IPS),
    redis.hgetall(TS_IP_FETCH)
  ])

  // Filtrer les serveurs qui ont besoin d'une IP
  const needsIpFetch: string[] = []

  for (const serverId of serverIds) {
    const hasIp = existingIps[serverId]
    const lastFetch = ipTimestamps[serverId] ? parseInt(ipTimestamps[serverId]) : 0

    // Besoin de fetch si: pas d'IP, ou IP trop vieille
    if (!hasIp || lastFetch < ipRefreshThreshold) {
      needsIpFetch.push(serverId)
      added++
    } else {
      skipped++
    }
  }

  // Ajouter à la queue (éviter les doublons avec un pipeline)
  if (needsIpFetch.length > 0) {
    // Vider l'ancienne queue et remettre les nouveaux
    const pipeline = redis.pipeline()
    pipeline.del(QUEUE_IP_FETCH)

    // RPUSH en batches pour éviter les arguments trop longs
    for (let i = 0; i < needsIpFetch.length; i += 1000) {
      const batch = needsIpFetch.slice(i, i + 1000)
      pipeline.rpush(QUEUE_IP_FETCH, ...batch)
    }

    await pipeline.exec()
  }

  console.log(`[Queue] Initialized: ${added} to fetch, ${skipped} already have IP`)
  return { added, skipped }
}

/**
 * FAST: Initialize queues with direct IPs from protobuf
 * Stores ~89% of IPs instantly without API calls!
 * Only servers with URLs need resolution via API
 * Also stores real player counts from protobuf for accurate aggregation
 */
export async function initializeQueuesWithDirectIps(
  serverIds: string[],
  directIps: Map<string, string>,
  playerCounts: Map<string, number>,
  needsResolution: string[]
): Promise<{ directIpsStored: number, needsApiFetch: number, queuedForScan: number }> {
  if (!redis) return { directIpsStored: 0, needsApiFetch: 0, queuedForScan: 0 }

  const now = Date.now().toString()
  console.log(`[FastInit] Starting with ${directIps.size} direct IPs, ${playerCounts.size} player counts, ${needsResolution.length} need resolution`)

  // Get previous server list to detect new/removed servers
  const currentServerSet = new Set(serverIds)
  const [oldServerIds, oldStatuses, oldResources, oldPlayers, oldIps] = await Promise.all([
    redis.smembers(SET_ALL_SERVERS),
    redis.hkeys(DATA_STATUS),
    redis.hkeys(DATA_SERVER_RESOURCES),
    redis.hkeys(DATA_SERVER_PLAYERS),
    redis.hkeys(DATA_IPS)
  ])

  const previousServerSet = new Set(oldServerIds)

  // Find NEW servers (in current but not in previous)
  const newServers: string[] = []
  for (const id of serverIds) {
    if (!previousServerSet.has(id)) newServers.push(id)
  }

  // Find REMOVED servers (in previous but not in current) - mark as offline
  const removedServers: string[] = []
  for (const id of oldServerIds) {
    if (!currentServerSet.has(id)) removedServers.push(id)
  }

  // Clean stale data (servers no longer in protobuf)
  const staleServers = new Set<string>()
  for (const id of [...oldStatuses, ...oldResources, ...oldPlayers, ...oldIps]) {
    if (!currentServerSet.has(id)) staleServers.add(id)
  }

  if (staleServers.size > 0) {
    const pipeline = redis.pipeline()
    for (const id of staleServers) {
      pipeline.hdel(DATA_STATUS, id)
      pipeline.hdel(DATA_SERVER_RESOURCES, id)
      pipeline.hdel(DATA_SERVER_PLAYERS, id)
      pipeline.hdel(DATA_IPS, id)
    }
    await pipeline.exec()
  }

  // Log server changes
  if (newServers.length > 0 || removedServers.length > 0 || staleServers.size > 0) {
    console.log(`[FastInit] Server changes: +${newServers.length} new, -${removedServers.length} removed, ${staleServers.size} cleaned`)
  }

  // Update global server set (replace with current list)
  if (serverIds.length > 0) {
    await redis.del(SET_ALL_SERVERS)
    await redis.sadd(SET_ALL_SERVERS, ...serverIds)
    // Store fixed total for accurate progress display
    await redis.set(STATS_TOTAL_SERVERS, serverIds.length.toString())
    console.log(`[FastInit] Total servers: ${serverIds.length}`)
  }

  // Store all direct IPs immediately
  if (directIps.size > 0) {
    const pipeline = redis.pipeline()

    // Store IPs in batches
    const entries = Array.from(directIps.entries())
    for (let i = 0; i < entries.length; i += 500) {
      const batch = entries.slice(i, i + 500)
      for (const [serverId, ip] of batch) {
        pipeline.hset(DATA_IPS, serverId, ip)
        pipeline.hset(TS_IP_FETCH, serverId, now)
      }
    }

    await pipeline.exec()
    console.log(`[FastInit] Stored ${directIps.size} direct IPs`)
  }

  // Store player counts from protobuf (for accurate resource aggregation)
  if (playerCounts.size > 0) {
    const pipeline = redis.pipeline()

    const entries = Array.from(playerCounts.entries())
    for (let i = 0; i < entries.length; i += 500) {
      const batch = entries.slice(i, i + 500)
      for (const [serverId, players] of batch) {
        pipeline.hset(DATA_SERVER_PLAYERS, serverId, players.toString())
      }
    }

    await pipeline.exec()
    console.log(`[FastInit] Stored ${playerCounts.size} player counts`)
  }

  // Queue servers with direct IPs for scanning
  // BUT: Don't reset queue if scanning is already in progress!
  const currentQueueSize = await redis.llen(QUEUE_SCAN)
  const serversWithIps = Array.from(directIps.keys())

  if (currentQueueSize > 0) {
    // Scanning in progress - only add NEW servers (not already in queue)
    console.log(`[FastInit] Scan queue has ${currentQueueSize} pending - only adding new servers`)

    // Get servers already queued to avoid duplicates
    // Note: We check status - if never scanned, add to queue
    const statuses = await redis.hgetall(DATA_STATUS)
    const newServers = serversWithIps.filter(id => !statuses[id])

    if (newServers.length > 0) {
      for (let i = 0; i < newServers.length; i += 1000) {
        const batch = newServers.slice(i, i + 1000)
        await redis.rpush(QUEUE_SCAN, ...batch)
      }
      console.log(`[FastInit] Added ${newServers.length} NEW servers to scan queue`)
    } else {
      console.log(`[FastInit] No new servers to add`)
    }
  } else if (serversWithIps.length > 0) {
    // Queue empty - populate it
    const pipeline = redis.pipeline()
    for (let i = 0; i < serversWithIps.length; i += 1000) {
      const batch = serversWithIps.slice(i, i + 1000)
      pipeline.rpush(QUEUE_SCAN, ...batch)
    }
    await pipeline.exec()
    console.log(`[FastInit] Queued ${serversWithIps.length} servers for scan`)
  }

  // Queue only servers that need URL resolution for IP fetch
  // Don't reset if already processing
  const currentIpQueueSize = await redis.llen(QUEUE_IP_FETCH)
  let queuedForIpFetch = 0

  if (needsResolution.length > 0) {
    if (currentIpQueueSize > 0) {
      // Already processing - only add servers we don't have IPs for yet
      const existingIps = await redis.hgetall(DATA_IPS)
      const newNeedsResolution = needsResolution.filter(id => !existingIps[id])

      if (newNeedsResolution.length > 0) {
        for (let i = 0; i < newNeedsResolution.length; i += 1000) {
          const batch = newNeedsResolution.slice(i, i + 1000)
          await redis.rpush(QUEUE_IP_FETCH, ...batch)
        }
        queuedForIpFetch = newNeedsResolution.length
        console.log(`[FastInit] Added ${newNeedsResolution.length} NEW servers for IP resolution`)
      }
    } else {
      // Queue empty - populate it
      const pipeline = redis.pipeline()
      for (let i = 0; i < needsResolution.length; i += 1000) {
        const batch = needsResolution.slice(i, i + 1000)
        pipeline.rpush(QUEUE_IP_FETCH, ...batch)
      }
      await pipeline.exec()
      queuedForIpFetch = needsResolution.length
      console.log(`[FastInit] Queued ${needsResolution.length} servers for IP resolution`)
    }
  }

  return {
    directIpsStored: directIps.size,
    needsApiFetch: queuedForIpFetch,
    queuedForScan: currentQueueSize > 0 ? 0 : serversWithIps.length  // 0 if already scanning
  }
}

/**
 * Ajoute les serveurs avec IP à la queue de scan (respecte les thresholds)
 */
export async function queueServersForScan(): Promise<number> {
  if (!redis) return 0

  const now = Date.now()
  const scanRefreshThreshold = now - (SCAN_REFRESH_HOURS * 60 * 60 * 1000)
  const unavailableRetryThreshold = now - (UNAVAILABLE_RETRY_HOURS * 60 * 60 * 1000)

  // Récupérer les données nécessaires
  const [allIps, scanTimestamps, statuses] = await Promise.all([
    redis.hgetall(DATA_IPS),
    redis.hgetall(TS_SCAN),
    redis.hgetall(DATA_STATUS)
  ])

  const needsScan: string[] = []

  for (const [serverId, ip] of Object.entries(allIps)) {
    if (!ip) continue

    const lastScan = scanTimestamps[serverId] ? parseInt(scanTimestamps[serverId]) : 0
    const status = statuses[serverId] as ServerStatus || 'unknown'

    // Besoin de scan si:
    // - Jamais scanné
    // - Scan trop vieux
    // - Était unavailable et retry threshold atteint
    if (
      lastScan === 0 ||
      lastScan < scanRefreshThreshold ||
      (status === 'unavailable' && lastScan < unavailableRetryThreshold)
    ) {
      needsScan.push(serverId)
    }
  }

  if (needsScan.length > 0) {
    const pipeline = redis.pipeline()
    pipeline.del(QUEUE_SCAN)

    for (let i = 0; i < needsScan.length; i += 1000) {
      const batch = needsScan.slice(i, i + 1000)
      pipeline.rpush(QUEUE_SCAN, ...batch)
    }

    await pipeline.exec()
  }

  console.log(`[Queue] ${needsScan.length} servers queued for scan`)
  return needsScan.length
}

/**
 * Re-queue TOUS les serveurs avec IP pour un nouveau cycle de scan
 * Appelé quand le scanner a terminé un cycle complet
 */
export async function requeueAllServersForScan(): Promise<number> {
  if (!redis) return 0

  // Get all servers with IPs
  const allIps = await redis.hgetall(DATA_IPS)
  const serverIds = Object.keys(allIps).filter(id => allIps[id])

  if (serverIds.length === 0) {
    console.log('[Queue] No servers with IPs to requeue')
    return 0
  }

  // Clear and repopulate scan queue
  const pipeline = redis.pipeline()
  pipeline.del(QUEUE_SCAN)

  for (let i = 0; i < serverIds.length; i += 1000) {
    const batch = serverIds.slice(i, i + 1000)
    pipeline.rpush(QUEUE_SCAN, ...batch)
  }

  await pipeline.exec()

  console.log(`[Queue] Requeued ALL ${serverIds.length} servers for new scan cycle`)
  return serverIds.length
}

/**
 * Récupère un batch de travail pour un worker
 * @param workerId - Identifiant du worker
 * @param preferType - Type de tâche préféré
 * @param batchSize - Taille du batch (default: BATCH_SIZE pour CF, peut être plus grand pour Railway)
 */
export async function getWorkerBatch(workerId: string, preferType?: 'ip_fetch' | 'scan', batchSize?: number): Promise<WorkerTask[]> {
  if (!redis) return []

  const maxBatch = batchSize || BATCH_SIZE
  const tasks: WorkerTask[] = []
  const now = Date.now()

  // Choisir la queue prioritaire
  const queues = preferType === 'scan'
    ? [QUEUE_SCAN, QUEUE_IP_FETCH]
    : [QUEUE_IP_FETCH, QUEUE_SCAN]

  for (const queue of queues) {
    if (tasks.length >= maxBatch) break

    const remaining = maxBatch - tasks.length
    const type = queue === QUEUE_IP_FETCH ? 'ip_fetch' : 'scan'

    // LPOP multiple éléments
    const items = await redis.lpop(queue, remaining)
    if (!items || items.length === 0) continue

    // Marquer comme en cours de traitement
    const pipeline = redis.pipeline()
    for (const serverId of items) {
      pipeline.hset(SET_PROCESSING, serverId, `${workerId}:${now}`)
    }
    await pipeline.exec()

    // Si c'est du scan, récupérer les IPs
    if (type === 'scan') {
      const ips = await redis.hmget(DATA_IPS, ...items)
      for (let i = 0; i < items.length; i++) {
        const ip = ips[i]
        if (ip) {
          tasks.push({ type: 'scan', serverId: items[i], ip })
        }
      }
    } else {
      for (const serverId of items) {
        tasks.push({ type: 'ip_fetch', serverId })
      }
    }
  }

  if (tasks.length > 0) {
    console.log(`[Queue] Gave ${tasks.length} tasks to ${workerId}`)
  }

  return tasks
}

/**
 * Soumet les résultats de récupération d'IP
 */
export async function submitIpResults(results: IpResult[]): Promise<{ success: number, failed: number }> {
  if (!redis || results.length === 0) return { success: 0, failed: 0 }

  const now = Date.now().toString()
  const pipeline = redis.pipeline()

  let success = 0
  let failed = 0

  for (const result of results) {
    // Retirer du processing
    pipeline.hdel(SET_PROCESSING, result.serverId)

    if (result.ip) {
      // Succès: stocker l'IP
      pipeline.hset(DATA_IPS, result.serverId, result.ip)
      pipeline.hset(TS_IP_FETCH, result.serverId, now)
      // Ajouter à la queue de scan
      pipeline.rpush(QUEUE_SCAN, result.serverId)
      success++
    } else {
      // Échec: marquer comme unavailable pour retry plus tard
      pipeline.hset(DATA_STATUS, result.serverId, 'unavailable')
      pipeline.hset(TS_IP_FETCH, result.serverId, now)
      failed++
    }
  }

  await pipeline.exec()

  console.log(`[Queue] IP results: ${success} success, ${failed} failed`)
  return { success, failed }
}

/**
 * Soumet les résultats de scan
 * Uses incremental counter updates for O(1) stats instead of O(n) hgetall
 */
export async function submitScanResults(results: ScanResult[]): Promise<{ online: number, offline: number, error: number }> {
  if (!redis || results.length === 0) return { online: 0, offline: 0, error: 0 }

  const now = Date.now().toString()

  // First, get previous statuses for these servers to update counters correctly
  const serverIds = results.map(r => r.serverId)
  const previousStatuses = await redis.hmget(DATA_STATUS, ...serverIds)

  const pipeline = redis.pipeline()

  let online = 0
  let offline = 0
  let error = 0

  // Track counter changes
  let onlineDelta = 0
  let offlineDelta = 0
  let unavailableDelta = 0

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const previousStatus = previousStatuses[i] as ServerStatus | null

    // Retirer du processing
    pipeline.hdel(SET_PROCESSING, result.serverId)
    pipeline.hset(TS_SCAN, result.serverId, now)

    // Calculate counter deltas based on status change
    if (previousStatus === 'online') onlineDelta--
    else if (previousStatus === 'offline') offlineDelta--
    else if (previousStatus === 'unavailable') unavailableDelta--

    if (result.online) {
      // Server responded with info.json = ONLINE
      pipeline.hset(DATA_STATUS, result.serverId, 'online')
      pipeline.hset(TS_LAST_SEEN, result.serverId, now)
      onlineDelta++
      online++

      // Stocker les resources du serveur
      if (result.resources && result.resources.length > 0) {
        pipeline.hset(DATA_SERVER_RESOURCES, result.serverId, JSON.stringify({
          resources: result.resources,
          players: result.players || 0
        }))
      }
    } else {
      // Server didn't respond (timeout, connection refused, etc) = OFFLINE
      pipeline.hset(DATA_STATUS, result.serverId, 'offline')
      offlineDelta++
      offline++
    }
  }

  // Update counters atomically
  if (onlineDelta !== 0) pipeline.incrby(COUNTER_ONLINE, onlineDelta)
  if (offlineDelta !== 0) pipeline.incrby(COUNTER_OFFLINE, offlineDelta)
  if (unavailableDelta !== 0) pipeline.incrby(COUNTER_UNAVAILABLE, unavailableDelta)

  await pipeline.exec()

  // Update resource aggregation incrementally
  await updateResourceAggregationIncremental(results.filter(r => r.online && r.resources))

  console.log(`[Queue] Scan results: ${online} online, ${offline} offline, ${error} errors`)
  return { online, offline, error }
}

/**
 * INCREMENTAL resource aggregation - only updates changed servers
 * Much faster than full rebuild for each batch
 */
async function updateResourceAggregationIncremental(onlineResults: ScanResult[]): Promise<void> {
  if (!redis || onlineResults.length === 0) return

  try {
    const pipeline = redis.pipeline()

    // Get real player counts for these servers
    const serverIds = onlineResults.map(r => r.serverId)
    const playerCounts = await redis.hmget(DATA_SERVER_PLAYERS, ...serverIds)

    // Update resource index for each server
    for (let i = 0; i < onlineResults.length; i++) {
      const result = onlineResults[i]
      if (!result.resources) continue

      const realPlayers = playerCounts[i] ? parseInt(playerCounts[i]!) : 0

      for (const resourceName of result.resources) {
        if (!resourceName || resourceName.length < 2) continue
        // Add server to resource index (Set ensures no duplicates)
        pipeline.sadd(`${RESOURCE_INDEX_PREFIX}${resourceName}`, result.serverId)
      }
    }

    await pipeline.exec()

    // Debounce full aggregation rebuild (only every 5 seconds max)
    await debouncedFullAggregation()
  } catch (e) {
    console.error('[Queue] Failed incremental resource update:', e)
  }
}

// Debounce mechanism for full aggregation
let aggregationTimeout: ReturnType<typeof setTimeout> | null = null
let lastAggregation = 0
const AGGREGATION_DEBOUNCE_MS = 5000 // 5 seconds

async function debouncedFullAggregation(): Promise<void> {
  const now = Date.now()

  // If recently aggregated, skip
  if (now - lastAggregation < AGGREGATION_DEBOUNCE_MS) {
    // Schedule one for later if not already scheduled
    if (!aggregationTimeout) {
      aggregationTimeout = setTimeout(async () => {
        aggregationTimeout = null
        await updateResourceAggregationFull()
      }, AGGREGATION_DEBOUNCE_MS)
    }
    return
  }

  await updateResourceAggregationFull()
}

/**
 * FULL resource aggregation rebuild
 * Called on init and periodically (debounced) during scanning
 */
async function updateResourceAggregationFull(): Promise<void> {
  if (!redis) return
  lastAggregation = Date.now()

  try {
    // Récupérer les resources, statuts ET vrais player counts du protobuf
    const [allServerResources, statuses, realPlayerCounts] = await Promise.all([
      redis.hgetall(DATA_SERVER_RESOURCES),
      redis.hgetall(DATA_STATUS),
      redis.hgetall(DATA_SERVER_PLAYERS)
    ])

    const resourceMap = new Map<string, { servers: Set<string>, onlineServers: Set<string>, players: number }>()

    for (const [serverId, dataJson] of Object.entries(allServerResources)) {
      // Compter TOUS les serveurs scannés (online + offline) pour stats stables
      // Mais players = seulement des serveurs online
      const isOnline = statuses[serverId] === 'online'

      try {
        const data = JSON.parse(dataJson) as { resources: string[], players: number }
        // Use REAL player count from protobuf, only if online
        const realPlayers = isOnline && realPlayerCounts[serverId] ? parseInt(realPlayerCounts[serverId]) : 0

        for (const resourceName of data.resources) {
          if (!resourceName || resourceName.length < 2) continue

          const existing = resourceMap.get(resourceName) || { servers: new Set(), onlineServers: new Set(), players: 0 }
          existing.servers.add(serverId)
          if (isOnline) {
            existing.onlineServers.add(serverId)
            existing.players += realPlayers
          }
          resourceMap.set(resourceName, existing)
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Convertir en array trié par nombre de serveurs (total, pas que online)
    const resources = Array.from(resourceMap.entries())
      .map(([name, data]) => ({
        name,
        servers: data.servers.size,          // Total servers (online + offline)
        onlineServers: data.onlineServers.size,  // Only online servers
        players: data.players                // Players only from online servers
      }))
      .sort((a, b) => b.servers - a.servers)

    // Save full list and top 100 separately (top 100 is lightweight for SSE)
    const pipeline = redis.pipeline()
    pipeline.set(DATA_RESOURCES, JSON.stringify(resources))
    pipeline.set(DATA_RESOURCES_TOP, JSON.stringify({
      resources: resources.slice(0, 100),
      total: resources.length
    }))
    await pipeline.exec()
    console.log(`[Queue] Full aggregation: ${resources.length} resources`)
  } catch (e) {
    console.error('[Queue] Failed to update resource aggregation:', e)
  }
}

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Récupère les stats des queues
 * OPTIMIZED: Uses O(1) counter reads instead of O(n) hgetall
 */
export async function getQueueStats(): Promise<QueueStats> {
  if (!redis) {
    return {
      pendingIpFetch: 0,
      pendingScan: 0,
      totalServers: 0,
      totalWithIp: 0,
      totalOnline: 0,
      totalOffline: 0,
      totalUnavailable: 0,
      processing: 0
    }
  }

  const [
    pendingIpFetch,
    pendingScan,
    storedTotal,
    totalWithIp,
    onlineCount,
    offlineCount,
    unavailableCount,
    processing
  ] = await Promise.all([
    redis.llen(QUEUE_IP_FETCH),
    redis.llen(QUEUE_SCAN),
    redis.get(STATS_TOTAL_SERVERS),
    redis.hlen(DATA_IPS),
    redis.get(COUNTER_ONLINE),
    redis.get(COUNTER_OFFLINE),
    redis.get(COUNTER_UNAVAILABLE),
    redis.hlen(SET_PROCESSING)
  ])

  // Use stored total, fallback to counting IPs if not set
  const totalServers = storedTotal ? parseInt(storedTotal) : totalWithIp

  return {
    pendingIpFetch,
    pendingScan,
    totalServers,
    totalWithIp,
    totalOnline: onlineCount ? parseInt(onlineCount) : 0,
    totalOffline: offlineCount ? parseInt(offlineCount) : 0,
    totalUnavailable: unavailableCount ? parseInt(unavailableCount) : 0,
    processing
  }
}

/**
 * Récupère une IP par serverId
 */
export async function getServerIp(serverId: string): Promise<string | null> {
  if (!redis) return null
  return redis.hget(DATA_IPS, serverId)
}

/**
 * Récupère toutes les IPs
 */
export async function getAllIps(): Promise<Map<string, string>> {
  if (!redis) return new Map()
  const data = await redis.hgetall(DATA_IPS)
  return new Map(Object.entries(data))
}

// In-memory cache for top 100 resources (lightweight, for SSE)
let resourcesTopCache: { resources: Array<{ name: string, servers: number, onlineServers: number, players: number }>, total: number, expires: number } | null = null
const RESOURCES_TOP_CACHE_TTL = 2 * 1000 // 2 seconds

/**
 * FAST: Get only top 100 resources (lightweight for SSE)
 * Uses separate Redis key with pre-sliced data
 */
export async function getResourcesTop(): Promise<{ resources: Array<{ name: string, servers: number, onlineServers: number, players: number }>, total: number }> {
  if (!redis) return { resources: [], total: 0 }

  // Check cache
  if (resourcesTopCache && resourcesTopCache.expires > Date.now()) {
    return { resources: resourcesTopCache.resources, total: resourcesTopCache.total }
  }

  try {
    const data = await redis.get(DATA_RESOURCES_TOP)
    if (!data) return { resources: [], total: 0 }

    const parsed = JSON.parse(data) as { resources: Array<{ name: string, servers: number, onlineServers: number, players: number }>, total: number }

    // Update cache
    resourcesTopCache = { ...parsed, expires: Date.now() + RESOURCES_TOP_CACHE_TTL }

    return parsed
  } catch {
    return { resources: [], total: 0 }
  }
}

// In-memory cache for full resources (5s TTL - for search/pagination only)
let resourcesCache: { data: Array<{ name: string, servers: number, onlineServers: number, players: number }>, expires: number } | null = null
const RESOURCES_CACHE_TTL = 5 * 1000 // 5 seconds

/**
 * Récupère les resources agrégées (cached) - FULL LIST for search
 * WARNING: This parses 800k+ resources JSON. Use getResourcesTop() for SSE.
 */
export async function getResources(): Promise<Array<{ name: string, servers: number, onlineServers: number, players: number }>> {
  if (!redis) return []

  // Check cache
  if (resourcesCache && resourcesCache.expires > Date.now()) {
    return resourcesCache.data
  }

  try {
    const data = await redis.get(DATA_RESOURCES)
    const resources = data ? JSON.parse(data) : []

    // Update cache
    resourcesCache = { data: resources, expires: Date.now() + RESOURCES_CACHE_TTL }

    return resources
  } catch {
    return []
  }
}

/**
 * Recherche dans les resources (server-side search for 800k+ resources)
 * OPTIMIZED: Uses pre-sliced top 100 when no query and offset < 100
 * @param query - Search query (case insensitive)
 * @param limit - Max results to return
 * @param offset - Skip first N results (for pagination)
 */
export async function searchResources(
  query: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ resources: Array<{ name: string, servers: number, onlineServers: number, players: number }>, total: number }> {
  if (!redis) return { resources: [], total: 0 }

  const q = query.toLowerCase().trim()

  // FAST PATH: No search query and requesting first 100 items
  // Use pre-sliced top 100 (tiny JSON, instant)
  if (!q && offset < 100) {
    try {
      const topData = await redis.get(DATA_RESOURCES_TOP)
      if (topData) {
        const { resources: top100, total } = JSON.parse(topData) as { resources: Array<{ name: string, servers: number, onlineServers: number, players: number }>, total: number }
        const sliced = top100.slice(offset, offset + limit)
        return {
          resources: sliced,
          total
        }
      }
    } catch {
      // Fall through to full load
    }
  }

  // SLOW PATH: Search query or pagination beyond top 100
  // Load full resources list
  try {
    // Check in-memory cache first
    if (resourcesCache && resourcesCache.expires > Date.now()) {
      const allResources = resourcesCache.data
      if (!q) {
        return {
          resources: allResources.slice(offset, offset + limit),
          total: allResources.length
        }
      }
      const filtered = allResources.filter(r => r.name.toLowerCase().includes(q))
      return {
        resources: filtered.slice(offset, offset + limit),
        total: filtered.length
      }
    }

    const data = await redis.get(DATA_RESOURCES)
    if (!data) return { resources: [], total: 0 }

    const allResources = JSON.parse(data) as Array<{ name: string, servers: number, onlineServers: number, players: number }>

    // Update cache
    resourcesCache = { data: allResources, expires: Date.now() + RESOURCES_CACHE_TTL }

    if (!q) {
      return {
        resources: allResources.slice(offset, offset + limit),
        total: allResources.length
      }
    }

    const filtered = allResources.filter(r => r.name.toLowerCase().includes(q))
    return {
      resources: filtered.slice(offset, offset + limit),
      total: filtered.length
    }
  } catch {
    return { resources: [], total: 0 }
  }
}

/**
 * Récupère le status d'un serveur
 */
export async function getServerStatus(serverId: string): Promise<ServerStatus> {
  if (!redis) return 'unknown'
  const status = await redis.hget(DATA_STATUS, serverId)
  return (status as ServerStatus) || 'unknown'
}

/**
 * Récupère les serveurs ONLINE qui ont une resource spécifique
 * OPTIMIZED: Uses Redis Set index for O(1) lookup instead of O(n) scan
 */
export async function getServersWithResource(resourceName: string): Promise<string[]> {
  if (!redis) return []

  try {
    // Get server IDs from index (O(1) lookup)
    const indexedServers = await redis.smembers(`${RESOURCE_INDEX_PREFIX}${resourceName}`)

    if (indexedServers.length === 0) {
      return []
    }

    // Filter to only online servers using batch lookup
    const statuses = await redis.hmget(DATA_STATUS, ...indexedServers)
    const onlineServers: string[] = []

    for (let i = 0; i < indexedServers.length; i++) {
      if (statuses[i] === 'online') {
        onlineServers.push(indexedServers[i])
      }
    }

    return onlineServers
  } catch {
    return []
  }
}

/**
 * Nettoie les tâches en processing qui ont timeout
 */
export async function cleanupStaleProcessing(): Promise<number> {
  if (!redis) return 0

  const now = Date.now()
  const processing = await redis.hgetall(SET_PROCESSING)

  let cleaned = 0
  const pipeline = redis.pipeline()

  for (const [serverId, value] of Object.entries(processing)) {
    const [, timestamp] = value.split(':')
    const ts = parseInt(timestamp)

    if (now - ts > PROCESSING_TIMEOUT_MS) {
      // Remettre dans la queue appropriée
      pipeline.hdel(SET_PROCESSING, serverId)

      // Vérifier s'il a une IP pour savoir dans quelle queue le remettre
      const hasIp = await redis.hexists(DATA_IPS, serverId)
      if (hasIp) {
        pipeline.rpush(QUEUE_SCAN, serverId)
      } else {
        pipeline.rpush(QUEUE_IP_FETCH, serverId)
      }
      cleaned++
    }
  }

  if (cleaned > 0) {
    await pipeline.exec()
    console.log(`[Queue] Cleaned ${cleaned} stale processing tasks`)
  }

  return cleaned
}

/**
 * Reset complet des queues (pour debug)
 */
export async function resetQueues(): Promise<void> {
  if (!redis) return

  await redis.del(
    QUEUE_IP_FETCH,
    QUEUE_SCAN,
    SET_PROCESSING
  )

  console.log('[Queue] Queues reset')
}

/**
 * Reset complet de toutes les données (DANGER)
 */
export async function resetAll(): Promise<void> {
  if (!redis) return

  // Delete static keys
  await redis.del(
    QUEUE_IP_FETCH,
    QUEUE_SCAN,
    DATA_IPS,
    DATA_STATUS,
    DATA_RESOURCES,
    DATA_SERVER_RESOURCES,
    DATA_SERVER_PLAYERS,
    TS_IP_FETCH,
    TS_SCAN,
    TS_LAST_SEEN,
    SET_ALL_SERVERS,
    SET_PROCESSING,
    STATS_KEY,
    STATS_TOTAL_SERVERS,
    COUNTER_ONLINE,
    COUNTER_OFFLINE,
    COUNTER_UNAVAILABLE
  )

  // Delete all resource index keys
  const indexKeys = await redis.keys(`${RESOURCE_INDEX_PREFIX}*`)
  if (indexKeys.length > 0) {
    await redis.del(...indexKeys)
  }

  console.log('[Queue] ALL DATA RESET')
}

/**
 * Sync counters from existing data (for migration)
 * Call this once when deploying the counter update
 */
export async function syncCountersFromData(): Promise<{ online: number, offline: number, unavailable: number }> {
  if (!redis) return { online: 0, offline: 0, unavailable: 0 }

  console.log('[Queue] Syncing counters from existing data...')

  const statuses = await redis.hgetall(DATA_STATUS)

  let online = 0
  let offline = 0
  let unavailable = 0

  for (const status of Object.values(statuses)) {
    if (status === 'online') online++
    else if (status === 'offline') offline++
    else if (status === 'unavailable') unavailable++
  }

  // Set counters atomically
  const pipeline = redis.pipeline()
  pipeline.set(COUNTER_ONLINE, online.toString())
  pipeline.set(COUNTER_OFFLINE, offline.toString())
  pipeline.set(COUNTER_UNAVAILABLE, unavailable.toString())
  await pipeline.exec()

  console.log(`[Queue] Counters synced: ${online} online, ${offline} offline, ${unavailable} unavailable`)
  return { online, offline, unavailable }
}

/**
 * Rebuild resource index from existing data (for migration)
 */
export async function rebuildResourceIndex(): Promise<number> {
  if (!redis) return 0

  console.log('[Queue] Rebuilding resource index...')

  // First, delete all existing index keys
  const existingKeys = await redis.keys(`${RESOURCE_INDEX_PREFIX}*`)
  if (existingKeys.length > 0) {
    await redis.del(...existingKeys)
  }

  const allServerResources = await redis.hgetall(DATA_SERVER_RESOURCES)
  const resourceServers = new Map<string, string[]>()

  for (const [serverId, dataJson] of Object.entries(allServerResources)) {
    try {
      const data = JSON.parse(dataJson) as { resources: string[] }
      for (const resourceName of data.resources) {
        if (!resourceName || resourceName.length < 2) continue
        if (!resourceServers.has(resourceName)) {
          resourceServers.set(resourceName, [])
        }
        resourceServers.get(resourceName)!.push(serverId)
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Build index in batches
  let totalResources = 0
  const entries = Array.from(resourceServers.entries())

  for (let i = 0; i < entries.length; i += 100) {
    const batch = entries.slice(i, i + 100)
    const pipeline = redis.pipeline()

    for (const [resourceName, serverIds] of batch) {
      if (serverIds.length > 0) {
        pipeline.sadd(`${RESOURCE_INDEX_PREFIX}${resourceName}`, ...serverIds)
        totalResources++
      }
    }

    await pipeline.exec()
  }

  console.log(`[Queue] Resource index rebuilt: ${totalResources} resources indexed`)
  return totalResources
}

/**
 * Rebuild the top 100 resources cache (for migration)
 * This regenerates DATA_RESOURCES_TOP from DATA_RESOURCES
 */
export async function rebuildResourcesTop(): Promise<number> {
  if (!redis) return 0

  console.log('[Queue] Rebuilding top 100 resources...')

  try {
    const data = await redis.get(DATA_RESOURCES)
    if (!data) {
      console.log('[Queue] No resources data found, running full aggregation...')
      await updateResourceAggregationFull()
      return 100
    }

    const resources = JSON.parse(data) as Array<{ name: string, servers: number, onlineServers: number, players: number }>

    // Save top 100 separately
    await redis.set(DATA_RESOURCES_TOP, JSON.stringify({
      resources: resources.slice(0, 100),
      total: resources.length
    }))

    console.log(`[Queue] Top 100 rebuilt from ${resources.length} total resources`)
    return resources.length
  } catch (e) {
    console.error('[Queue] Failed to rebuild top 100:', e)
    return 0
  }
}

export function isQueueEnabled(): boolean {
  return redis !== null
}

export default redis
