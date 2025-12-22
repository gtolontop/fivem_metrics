import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

const FIVEM_API = 'https://servers-frontend.fivem.net/api/servers'

// Cache pour éviter de spam l'API FiveM
const cache = {
  servers: { data: null, timestamp: 0 },
  resources: { data: null, timestamp: 0 }
}
const CACHE_DURATION = 60000 // 1 minute

// Fetch avec retry
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'FiveM-Metrics/1.0'
        }
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response
    } catch (err) {
      if (i === retries - 1) throw err
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

// Get all servers (stream endpoint)
app.get('/api/servers', async (req, res) => {
  try {
    const now = Date.now()
    if (cache.servers.data && now - cache.servers.timestamp < CACHE_DURATION) {
      return res.json(cache.servers.data)
    }

    // Use the stream endpoint to get all servers
    const response = await fetchWithRetry(`${FIVEM_API}/streamRedir/`)
    const text = await response.text()

    // Parse the streamed JSON (each line is a server)
    const servers = []
    const lines = text.split('\n').filter(line => line.trim())

    for (const line of lines) {
      try {
        const server = JSON.parse(line)
        if (server.Data) {
          servers.push({
            id: server.EndPoint || server.Data.sv_projectName || '',
            endpoint: server.EndPoint,
            name: server.Data.hostname || 'Unknown',
            players: server.Data.clients || 0,
            maxPlayers: server.Data.sv_maxclients || 32,
            gametype: server.Data.gametype || '',
            mapname: server.Data.mapname || '',
            resources: server.Data.resources || [],
            vars: server.Data.vars || {},
            enhancedHostSupport: server.Data.enhancedHostSupport || false,
            icon: server.Data.icon || null,
            private: server.Data.private || false,
            fallback: server.Data.fallback || false,
            connectEndPoints: server.Data.connectEndPoints || [],
            upvotePower: server.Data.upvotePower || 0,
            burstPower: server.Data.burstPower || 0,
            support_status: server.Data.support_status || '',
            ownerID: server.Data.ownerID || null,
            ownerName: server.Data.ownerName || null,
            ownerAvatar: server.Data.ownerAvatar || null,
            lastSeen: server.Data.lastSeen || null,
            iconVersion: server.Data.iconVersion || 0
          })
        }
      } catch (e) {
        // Skip malformed lines
      }
    }

    // Sort by players
    servers.sort((a, b) => b.players - a.players)

    cache.servers.data = servers
    cache.servers.timestamp = now

    res.json(servers)
  } catch (error) {
    console.error('Error fetching servers:', error)
    res.status(500).json({ error: 'Failed to fetch servers' })
  }
})

// Get top servers
app.get('/api/servers/top', async (req, res) => {
  try {
    const response = await fetchWithRetry(`${FIVEM_API}/top/all/`)
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Error fetching top servers:', error)
    res.status(500).json({ error: 'Failed to fetch top servers' })
  }
})

// Get single server
app.get('/api/servers/:id', async (req, res) => {
  try {
    const { id } = req.params
    const response = await fetchWithRetry(`${FIVEM_API}/single/${id}`)
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Error fetching server:', error)
    res.status(500).json({ error: 'Failed to fetch server' })
  }
})

// Get resources aggregated from all servers
app.get('/api/resources', async (req, res) => {
  try {
    const now = Date.now()

    // Use cached servers or fetch new ones
    if (!cache.servers.data || now - cache.servers.timestamp >= CACHE_DURATION) {
      // Trigger servers fetch first
      const response = await fetchWithRetry(`${FIVEM_API}/streamRedir/`)
      const text = await response.text()
      const servers = []
      const lines = text.split('\n').filter(line => line.trim())

      for (const line of lines) {
        try {
          const server = JSON.parse(line)
          if (server.Data) {
            servers.push({
              id: server.EndPoint,
              players: server.Data.clients || 0,
              resources: server.Data.resources || []
            })
          }
        } catch (e) {}
      }

      cache.servers.data = servers
      cache.servers.timestamp = now
    }

    // Aggregate resources
    const resourceMap = new Map()

    for (const server of cache.servers.data) {
      const resources = server.resources || []
      for (const resource of resources) {
        if (!resource || resource.length < 2) continue

        const existing = resourceMap.get(resource) || {
          name: resource,
          serverCount: 0,
          totalPlayers: 0
        }

        existing.serverCount++
        existing.totalPlayers += server.players || 0
        resourceMap.set(resource, existing)
      }
    }

    // Convert to array and sort
    const resources = Array.from(resourceMap.values())
      .sort((a, b) => b.serverCount - a.serverCount)

    res.json(resources)
  } catch (error) {
    console.error('Error fetching resources:', error)
    res.status(500).json({ error: 'Failed to fetch resources' })
  }
})

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const now = Date.now()

    if (!cache.servers.data || now - cache.servers.timestamp >= CACHE_DURATION) {
      // Fetch fresh data
      const response = await fetchWithRetry(`${FIVEM_API}/streamRedir/`)
      const text = await response.text()
      const servers = []
      const lines = text.split('\n').filter(line => line.trim())

      for (const line of lines) {
        try {
          const server = JSON.parse(line)
          if (server.Data) {
            servers.push({
              players: server.Data.clients || 0,
              resources: server.Data.resources || []
            })
          }
        } catch (e) {}
      }

      cache.servers.data = servers
      cache.servers.timestamp = now
    }

    const servers = cache.servers.data
    const totalServers = servers.length
    const totalPlayers = servers.reduce((sum, s) => sum + (s.players || 0), 0)

    // Count unique resources
    const uniqueResources = new Set()
    for (const server of servers) {
      for (const resource of (server.resources || [])) {
        if (resource) uniqueResources.add(resource)
      }
    }

    res.json({
      totalServers,
      totalPlayers,
      totalResources: uniqueResources.size,
      serversOnline: totalServers,
      avgPlayersPerServer: totalServers > 0 ? (totalPlayers / totalServers).toFixed(1) : 0
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`)
})
