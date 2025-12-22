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
}

export interface FiveMResource {
  name: string
  servers: number
  players: number
}

// Protobuf varint decoder
function readVarint(buf: Uint8Array, offset: number): [number, number] {
  let result = 0
  let shift = 0
  let pos = offset
  while (pos < buf.length) {
    const byte = buf[pos++]
    result |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) break
    shift += 7
    if (shift > 35) break
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
          // EndPoint
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
    icon
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

  return { hostname, clients, maxClients, gametype, mapname, resources, icon, vars }
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

export async function getServerDetails(serverId: string): Promise<FiveMServerFull | null> {
  try {
    const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = await res.json()

    return {
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
