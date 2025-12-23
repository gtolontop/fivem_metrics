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
const DATA_RESOURCES = 'data:resources'           // JSON des ressources agrégées
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

  // Queue servers with direct IPs for scanning immediately
  const serversWithIps = Array.from(directIps.keys())
  if (serversWithIps.length > 0) {
    const pipeline = redis.pipeline()
    pipeline.del(QUEUE_SCAN)

    for (let i = 0; i < serversWithIps.length; i += 1000) {
      const batch = serversWithIps.slice(i, i + 1000)
      pipeline.rpush(QUEUE_SCAN, ...batch)
    }

    await pipeline.exec()
    console.log(`[FastInit] Queued ${serversWithIps.length} servers for immediate scan`)
  }

  // Queue only servers that need URL resolution for IP fetch
  if (needsResolution.length > 0) {
    const pipeline = redis.pipeline()
    pipeline.del(QUEUE_IP_FETCH)

    for (let i = 0; i < needsResolution.length; i += 1000) {
      const batch = needsResolution.slice(i, i + 1000)
      pipeline.rpush(QUEUE_IP_FETCH, ...batch)
    }

    await pipeline.exec()
    console.log(`[FastInit] Queued ${needsResolution.length} servers for IP resolution (URLs only)`)
  }

  return {
    directIpsStored: directIps.size,
    needsApiFetch: needsResolution.length,
    queuedForScan: serversWithIps.length
  }
}

/**
 * Ajoute les serveurs avec IP à la queue de scan
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
 */
export async function submitScanResults(results: ScanResult[]): Promise<{ online: number, offline: number, error: number }> {
  if (!redis || results.length === 0) return { online: 0, offline: 0, error: 0 }

  const now = Date.now().toString()
  const pipeline = redis.pipeline()

  let online = 0
  let offline = 0
  let error = 0

  for (const result of results) {
    // Retirer du processing
    pipeline.hdel(SET_PROCESSING, result.serverId)
    pipeline.hset(TS_SCAN, result.serverId, now)

    if (result.online) {
      // Server responded with info.json = ONLINE
      pipeline.hset(DATA_STATUS, result.serverId, 'online')
      pipeline.hset(TS_LAST_SEEN, result.serverId, now)

      // Stocker les resources du serveur
      if (result.resources && result.resources.length > 0) {
        pipeline.hset(DATA_SERVER_RESOURCES, result.serverId, JSON.stringify({
          resources: result.resources,
          players: result.players || 0
        }))
      }
      online++
    } else {
      // Server didn't respond (timeout, connection refused, etc) = OFFLINE
      pipeline.hset(DATA_STATUS, result.serverId, 'offline')
      offline++
    }
  }

  await pipeline.exec()

  // Mettre à jour l'agrégation des resources
  await updateResourceAggregation()

  console.log(`[Queue] Scan results: ${online} online, ${offline} offline, ${error} errors`)
  return { online, offline, error }
}

/**
 * Met à jour l'agrégation des resources (appelé après chaque batch de scan)
 * Uses REAL player counts from protobuf (DATA_SERVER_PLAYERS), not sv_maxClients from scan
 */
async function updateResourceAggregation(): Promise<void> {
  if (!redis) return

  try {
    // Récupérer les resources, statuts ET vrais player counts du protobuf
    const [allServerResources, statuses, realPlayerCounts] = await Promise.all([
      redis.hgetall(DATA_SERVER_RESOURCES),
      redis.hgetall(DATA_STATUS),
      redis.hgetall(DATA_SERVER_PLAYERS)
    ])

    const resourceMap = new Map<string, { servers: Set<string>, players: number }>()

    for (const [serverId, dataJson] of Object.entries(allServerResources)) {
      // Ne compter que les serveurs ONLINE
      if (statuses[serverId] !== 'online') continue

      try {
        const data = JSON.parse(dataJson) as { resources: string[], players: number }
        // Use REAL player count from protobuf, not the wrong sv_maxClients from scan
        const realPlayers = realPlayerCounts[serverId] ? parseInt(realPlayerCounts[serverId]) : 0

        for (const resourceName of data.resources) {
          if (!resourceName || resourceName.length < 2) continue

          const existing = resourceMap.get(resourceName) || { servers: new Set(), players: 0 }
          existing.servers.add(serverId)
          existing.players += realPlayers
          resourceMap.set(resourceName, existing)
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Convertir en array trié
    const resources = Array.from(resourceMap.entries())
      .map(([name, data]) => ({
        name,
        servers: data.servers.size,
        players: data.players
      }))
      .sort((a, b) => b.servers - a.servers)

    await redis.set(DATA_RESOURCES, JSON.stringify(resources))
  } catch (e) {
    console.error('[Queue] Failed to update resource aggregation:', e)
  }
}

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Récupère les stats des queues
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
    statuses,
    processing
  ] = await Promise.all([
    redis.llen(QUEUE_IP_FETCH),
    redis.llen(QUEUE_SCAN),
    redis.get(STATS_TOTAL_SERVERS),  // Use fixed total from last init
    redis.hlen(DATA_IPS),
    redis.hgetall(DATA_STATUS),
    redis.hlen(SET_PROCESSING)
  ])

  // Use stored total, fallback to counting IPs if not set
  const totalServers = storedTotal ? parseInt(storedTotal) : totalWithIp

  let totalOnline = 0
  let totalOffline = 0
  let totalUnavailable = 0

  for (const status of Object.values(statuses)) {
    if (status === 'online') totalOnline++
    else if (status === 'offline') totalOffline++
    else if (status === 'unavailable') totalUnavailable++
  }

  return {
    pendingIpFetch,
    pendingScan,
    totalServers,
    totalWithIp,
    totalOnline,
    totalOffline,
    totalUnavailable,
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

/**
 * Récupère les resources agrégées
 */
export async function getResources(): Promise<Array<{ name: string, servers: number, players: number }>> {
  if (!redis) return []
  try {
    const data = await redis.get(DATA_RESOURCES)
    return data ? JSON.parse(data) : []
  } catch {
    return []
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
 */
export async function getServersWithResource(resourceName: string): Promise<string[]> {
  if (!redis) return []

  try {
    const [allServerResources, statuses] = await Promise.all([
      redis.hgetall(DATA_SERVER_RESOURCES),
      redis.hgetall(DATA_STATUS)
    ])
    const servers: string[] = []

    for (const [serverId, dataJson] of Object.entries(allServerResources)) {
      // Ne retourner que les serveurs ONLINE
      if (statuses[serverId] !== 'online') continue

      try {
        const data = JSON.parse(dataJson) as { resources: string[], players: number }
        if (data.resources.includes(resourceName)) {
          servers.push(serverId)
        }
      } catch {
        // Ignore parse errors
      }
    }

    return servers
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
    STATS_TOTAL_SERVERS
  )

  console.log('[Queue] ALL DATA RESET')
}

export function isQueueEnabled(): boolean {
  return redis !== null
}

export default redis
