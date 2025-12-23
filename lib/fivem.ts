export interface FiveMServer {
  id: string
  name: string
  players: number
  maxPlayers: number
  gametype: string
  mapname: string
  resources: string[]
  vars: Record<string, string>
  icon: string | null
  connectEndpoint: string | null  // Direct IP:port or URL from protobuf field 18
}

export interface FiveMResource {
  name: string
  servers: number        // Total servers (online + offline) for stable stats
  onlineServers?: number // Only currently online servers
  players: number        // Players only from online servers
}

// Protobuf varint decoder - supports up to 64-bit (10 bytes for negative numbers)
function readVarint(buf: Uint8Array, offset: number): [number, number] {
  let result = 0
  let shift = 0
  let pos = offset
  while (pos < buf.length) {
    const byte = buf[pos++]
    // Only use lower 32 bits to avoid JS number precision issues
    if (shift < 32) {
      result |= (byte & 0x7f) << shift
    }
    if ((byte & 0x80) === 0) break
    shift += 7
    // Allow up to 10 bytes (64-bit varint) - important for negative numbers!
    if (shift > 63) break
  }
  return [result, pos]
}

// Read 32-bit little-endian integer
function readUint32LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)
}

// Parse the FiveM stream (4-byte length prefix + protobuf message, repeated)
function parseServers(buffer: ArrayBuffer): FiveMServer[] {
  const servers: FiveMServer[] = []
  const data = new Uint8Array(buffer)
  let pos = 0

  while (pos + 4 < data.length) {
    try {
      // Read 4-byte little-endian length
      const len = readUint32LE(data, pos)
      pos += 4

      if (len <= 0 || len > 100000 || pos + len > data.length) {
        break
      }

      const messageData = data.slice(pos, pos + len)
      const server = parseServerMessage(messageData)

      if (server && server.name && server.name.length > 2) {
        servers.push(server)
      }

      pos += len
    } catch {
      break
    }
  }

  return servers
}

function parseServerMessage(data: Uint8Array): FiveMServer | null {
  let pos = 0
  let endpoint = ''
  let hostname = ''
  let clients = 0
  let maxClients = 32
  let gametype = ''
  let mapname = ''
  const resources: string[] = []
  let icon: string | null = null
  const vars: Record<string, string> = {}
  let connectEndpoint: string | null = null

  while (pos < data.length - 1) {
    try {
      const [tag, newPos] = readVarint(data, pos)
      pos = newPos
      if (pos >= data.length) break

      const fieldNum = tag >> 3
      const wireType = tag & 0x7

      if (wireType === 2) { // Length-delimited
        const [len, lenPos] = readVarint(data, pos)
        pos = lenPos

        if (len <= 0 || pos + len > data.length) break

        const fieldData = data.slice(pos, pos + len)

        if (fieldNum === 1) {
          // EndPoint (CFX ID like "xjz9k5")
          endpoint = new TextDecoder().decode(fieldData)
        } else if (fieldNum === 2) {
          // Data message - parse nested
          const nested = parseDataMessage(fieldData)
          hostname = nested.hostname || hostname
          clients = nested.clients || clients
          maxClients = nested.maxClients || maxClients
          gametype = nested.gametype || gametype
          mapname = nested.mapname || mapname
          if (nested.resources.length > 0) {
            resources.push(...nested.resources)
          }
          icon = nested.icon || icon
          Object.assign(vars, nested.vars)
          // Field 18 from nested message - direct IP:port or URL
          connectEndpoint = nested.connectEndpoint
        }

        pos += len
      } else if (wireType === 0) { // Varint
        const [, valPos] = readVarint(data, pos)
        pos = valPos
      } else if (wireType === 5) { // 32-bit
        pos += 4
      } else if (wireType === 1) { // 64-bit
        pos += 8
      } else {
        break
      }
    } catch {
      break
    }
  }

  if (!endpoint && !hostname) return null

  // Use sv_projectName from vars if available, otherwise use hostname
  const displayName = vars['sv_projectName'] || hostname || endpoint

  return {
    id: endpoint,
    name: displayName,
    players: clients,
    maxPlayers: maxClients || 32,
    gametype,
    mapname,
    resources,
    vars,
    icon,
    connectEndpoint
  }
}

function parseDataMessage(data: Uint8Array): {
  hostname: string
  clients: number
  maxClients: number
  gametype: string
  mapname: string
  resources: string[]
  icon: string | null
  vars: Record<string, string>
  connectEndpoint: string | null  // Field 18 - direct IP or URL
} {
  let pos = 0
  let hostname = ''
  let clients = 0
  let maxClients = 32
  let gametype = ''
  let mapname = ''
  const resources: string[] = []
  let icon: string | null = null
  const vars: Record<string, string> = {}
  let connectEndpoint: string | null = null

  while (pos < data.length - 1) {
    try {
      const [tag, newPos] = readVarint(data, pos)
      pos = newPos
      if (pos >= data.length) break

      const fieldNum = tag >> 3
      const wireType = tag & 0x7

      if (wireType === 2) { // Length-delimited
        const [len, lenPos] = readVarint(data, pos)
        pos = lenPos

        if (len <= 0 || pos + len > data.length) break

        const fieldData = data.slice(pos, pos + len)

        try {
          if (fieldNum === 4) {
            // Hostname (raw description)
            hostname = new TextDecoder().decode(fieldData)
          } else if (fieldNum === 5) {
            // Gametype
            gametype = new TextDecoder().decode(fieldData)
          } else if (fieldNum === 6) {
            // Mapname
            mapname = new TextDecoder().decode(fieldData)
          } else if (fieldNum === 12) {
            // Vars - nested key-value
            const varEntry = parseVarEntry(fieldData)
            if (varEntry) {
              vars[varEntry.key] = varEntry.value
            }
          } else if (fieldNum === 14) {
            // Resources
            const resName = new TextDecoder().decode(fieldData)
            if (resName.length > 1 && resName.length < 100 && !resName.includes('\x00')) {
              resources.push(resName)
            }
          } else if (fieldNum === 17) {
            // Icon
            const iconStr = new TextDecoder().decode(fieldData)
            if (iconStr.startsWith('data:image')) {
              icon = iconStr
            }
          } else if (fieldNum === 18) {
            // Connect endpoint - direct IP:port or URL
            connectEndpoint = new TextDecoder().decode(fieldData)
          }
        } catch {
          // Skip invalid text
        }

        pos += len
      } else if (wireType === 0) { // Varint
        const [val, valPos] = readVarint(data, pos)
        pos = valPos

        // Field 1 = sv_maxclients, Field 2 = clients (current players)
        if (fieldNum === 1) maxClients = val
        if (fieldNum === 2) clients = val
      } else if (wireType === 5) { // 32-bit
        pos += 4
      } else if (wireType === 1) { // 64-bit
        pos += 8
      } else {
        break
      }
    } catch {
      break
    }
  }

  return { hostname, clients, maxClients, gametype, mapname, resources, icon, vars, connectEndpoint }
}

function parseVarEntry(data: Uint8Array): { key: string; value: string } | null {
  let pos = 0
  let key = ''
  let value = ''

  while (pos < data.length - 1) {
    try {
      const [tag, newPos] = readVarint(data, pos)
      pos = newPos
      if (pos >= data.length) break

      const fieldNum = tag >> 3
      const wireType = tag & 0x7

      if (wireType === 2) {
        const [len, lenPos] = readVarint(data, pos)
        pos = lenPos

        if (len <= 0 || pos + len > data.length) break

        const str = new TextDecoder().decode(data.slice(pos, pos + len))
        if (fieldNum === 1) key = str
        if (fieldNum === 2) value = str
        pos += len
      } else {
        break
      }
    } catch {
      break
    }
  }

  return key ? { key, value } : null
}

// Strip FiveM color codes (^0, ^1, etc.)
function stripColorCodes(str: string): string {
  return str.replace(/\^[0-9]/g, '').trim()
}

// Fetch single server details (includes resources)
export interface FiveMServerFull {
  id: string
  name: string
  players: number
  maxPlayers: number
  gametype: string
  mapname: string
  resources: string[]
  vars: Record<string, string>
  server: string
}

// Fetch directly from server's info.json endpoint (no FiveM rate limit!)
export async function getServerInfoDirect(endpoint: string): Promise<{ resources: string[] } | null> {
  try {
    // endpoint format: "ip:port" or just IP
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000) // 3 sec timeout

    const res = await fetch(`http://${endpoint}/info.json`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) return null

    const data = await res.json()
    return {
      resources: data.resources || []
    }
  } catch {
    // Server offline, timeout, or blocked - just skip
    return null
  }
}

// Batch fetch server info directly (parallel with concurrency limit)
export async function batchGetServerInfo(
  endpoints: string[],
  concurrency: number = 20
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>()

  for (let i = 0; i < endpoints.length; i += concurrency) {
    const batch = endpoints.slice(i, i + concurrency)
    const promises = batch.map(async (endpoint) => {
      const info = await getServerInfoDirect(endpoint)
      if (info && info.resources.length > 0) {
        results.set(endpoint, info.resources)
      }
    })
    await Promise.all(promises)
  }

  return results
}

// In-memory cache for server details (30s TTL)
const serverCache = new Map<string, { data: FiveMServerFull, expires: number }>()
const SERVER_CACHE_TTL = 30 * 1000 // 30 seconds

export async function getServerDetails(serverId: string): Promise<FiveMServerFull | null> {
  // Check cache first
  const cached = serverCache.get(serverId)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  try {
    const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = await res.json()

    const server: FiveMServerFull = {
      id: data.EndPoint || serverId,
      name: stripColorCodes(data.Data?.hostname || data.Data?.vars?.sv_projectName || serverId),
      players: data.Data?.clients || 0,
      maxPlayers: data.Data?.sv_maxclients || 32,
      gametype: data.Data?.gametype || '',
      mapname: data.Data?.mapname || '',
      resources: data.Data?.resources || [],
      vars: data.Data?.vars || {},
      server: data.Data?.server || ''
    }

    // Store in cache
    serverCache.set(serverId, { data: server, expires: Date.now() + SERVER_CACHE_TTL })

    // Cleanup old entries periodically (keep cache size reasonable)
    if (serverCache.size > 500) {
      const now = Date.now()
      for (const [key, value] of serverCache.entries()) {
        if (value.expires < now) serverCache.delete(key)
      }
    }

    return server
  } catch (e) {
    console.error('Failed to fetch server details:', e)
    return null
  }
}

// Slim server interface for client-side display
export interface FiveMServerSlim {
  id: string
  name: string
  players: number
  maxPlayers: number
  gametype: string
  mapname: string
  tags: string
}

export async function getServersDirect(): Promise<{
  servers: FiveMServerSlim[]
  resources: FiveMResource[]
  totalPlayers: number
  totalServers: number
}> {
  try {
    const res = await fetch('https://servers-frontend.fivem.net/api/servers/streamRedir/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error('FiveM API error:', res.status)
      return { servers: [], resources: [], totalPlayers: 0, totalServers: 0 }
    }

    const buffer = await res.arrayBuffer()
    console.log('Received', buffer.byteLength, 'bytes')

    const allServers = parseServers(buffer)
    console.log('Parsed', allServers.length, 'servers')

    // Sort by players
    allServers.sort((a, b) => b.players - a.players)

    // Calculate totals
    let totalPlayers = 0
    const resourceMap = new Map<string, FiveMResource>()

    for (const server of allServers) {
      totalPlayers += server.players
      for (const r of server.resources) {
        if (!r || r.length < 2) continue
        const existing = resourceMap.get(r) || { name: r, servers: 0, players: 0 }
        existing.servers++
        existing.players += server.players
        resourceMap.set(r, existing)
      }
    }

    const resources = Array.from(resourceMap.values())
      .sort((a, b) => b.servers - a.servers)

    // Create clean server objects for ALL servers
    const cleanServers: FiveMServerSlim[] = allServers.map(s => ({
      id: String(s.id || '').slice(0, 50),
      name: stripColorCodes(String(s.name || '')).slice(0, 100),
      players: Number(s.players) || 0,
      maxPlayers: Number(s.maxPlayers) || 32,
      gametype: String(s.gametype || '').slice(0, 50),
      mapname: String(s.mapname || '').slice(0, 50),
      tags: String(s.vars?.tags || '').slice(0, 200)
    }))

    console.log('Total players:', totalPlayers)
    console.log('Unique resources:', resources.length)
    console.log('Returning ALL', cleanServers.length, 'servers')

    return {
      servers: cleanServers,
      resources,
      totalPlayers,
      totalServers: cleanServers.length
    }
  } catch (e) {
    console.error('Failed to fetch FiveM data:', e)
    return { servers: [], resources: [], totalPlayers: 0, totalServers: 0 }
  }
}

// Helper to check if a string is a direct IP:port
function isDirectIp(endpoint: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(endpoint)
}

// Extract direct IPs from protobuf - INSTANT, no API calls needed!
export async function getServersWithIps(): Promise<{
  servers: FiveMServerSlim[]
  directIps: Map<string, string>  // cfxId -> IP:port (89% of servers)
  playerCounts: Map<string, number>  // cfxId -> real player count from protobuf
  needsResolution: string[]       // cfxIds with URLs that need DNS/API lookup (11%)
  totalPlayers: number
  totalServers: number
}> {
  try {
    const res = await fetch('https://servers-frontend.fivem.net/api/servers/streamRedir/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error('FiveM API error:', res.status)
      return { servers: [], directIps: new Map(), playerCounts: new Map(), needsResolution: [], totalPlayers: 0, totalServers: 0 }
    }

    const buffer = await res.arrayBuffer()
    console.log('[FastIP] Received', buffer.byteLength, 'bytes')

    const allServers = parseServers(buffer)
    console.log('[FastIP] Parsed', allServers.length, 'servers')

    // Extract IPs and player counts from protobuf
    const directIps = new Map<string, string>()
    const playerCounts = new Map<string, number>()
    const needsResolution: string[] = []
    let totalPlayers = 0

    for (const server of allServers) {
      totalPlayers += server.players
      // Store real player count from protobuf
      playerCounts.set(server.id, server.players)

      if (server.connectEndpoint) {
        if (isDirectIp(server.connectEndpoint)) {
          // Direct IP - can use immediately!
          directIps.set(server.id, server.connectEndpoint)
        } else {
          // URL - needs DNS resolution or API call
          needsResolution.push(server.id)
        }
      } else {
        // No endpoint at all - needs API call
        needsResolution.push(server.id)
      }
    }

    // Sort by players
    allServers.sort((a, b) => b.players - a.players)

    const cleanServers: FiveMServerSlim[] = allServers.map(s => ({
      id: String(s.id || '').slice(0, 50),
      name: stripColorCodes(String(s.name || '')).slice(0, 100),
      players: Number(s.players) || 0,
      maxPlayers: Number(s.maxPlayers) || 32,
      gametype: String(s.gametype || '').slice(0, 50),
      mapname: String(s.mapname || '').slice(0, 50),
      tags: String(s.vars?.tags || '').slice(0, 200)
    }))

    console.log('[FastIP] Direct IPs:', directIps.size, `(${(directIps.size / allServers.length * 100).toFixed(1)}%)`)
    console.log('[FastIP] Need resolution:', needsResolution.length, `(${(needsResolution.length / allServers.length * 100).toFixed(1)}%)`)

    return {
      servers: cleanServers,
      directIps,
      playerCounts,
      needsResolution,
      totalPlayers,
      totalServers: cleanServers.length
    }
  } catch (e) {
    console.error('Failed to fetch FiveM data:', e)
    return { servers: [], directIps: new Map(), playerCounts: new Map(), needsResolution: [], totalPlayers: 0, totalServers: 0 }
  }
}
