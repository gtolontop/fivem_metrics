// ULTRA SCAN - Direct server scanning (NO RATE LIMIT!)
// Once we have IPs, we hit servers directly - not FiveM API
// 200 parallel requests = 32K servers in ~5 min

const API_BASE = process.env.API_BASE || 'http://localhost:3005'
const PARALLEL_REQUESTS = 200 // 200 serveurs en parallèle
const TIMEOUT_MS = 3000 // 3 sec timeout per server
const BATCH_DELAY = 100 // 100ms entre batches

interface ServerWithIp {
  id: string
  ip: string
  players: number
}

async function getServersWithIps(): Promise<ServerWithIp[]> {
  // Get all servers with their IPs from cache
  const res = await fetch(`${API_BASE}/api/servers-with-ips`)
  if (!res.ok) return []
  return res.json()
}

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

async function submitResources(results: Array<{ serverId: string, resources: string[], players: number }>) {
  await fetch(`${API_BASE}/api/scan/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results })
  })
}

async function main() {
  console.log('⚡ ULTRA SCAN - Direct Server Scanner')
  console.log(`📡 API: ${API_BASE}`)
  console.log(`🚀 ${PARALLEL_REQUESTS} parallel requests\n`)

  // Get servers with IPs
  console.log('📥 Fetching servers with IPs...')
  const servers = await getServersWithIps()
  console.log(`   Found ${servers.length} servers with IPs\n`)

  if (servers.length === 0) {
    console.log('❌ No servers with IPs. Run IP collection first.')
    return
  }

  const startTime = Date.now()
  let scanned = 0
  let online = 0
  let totalResources = new Set<string>()

  // Process in batches
  for (let i = 0; i < servers.length; i += PARALLEL_REQUESTS) {
    const batch = servers.slice(i, i + PARALLEL_REQUESTS)
    const batchStart = Date.now()

    // Scan all in parallel
    const promises = batch.map(async (server) => {
      const resources = await scanServer(server.ip)
      return { serverId: server.id, resources, players: server.players, online: resources.length > 0 }
    })

    const results = await Promise.all(promises)

    // Count results
    const batchOnline = results.filter(r => r.online).length
    online += batchOnline
    scanned += batch.length
    results.forEach(r => r.resources.forEach(res => totalResources.add(res)))

    // Submit to API
    const toSubmit = results.filter(r => r.resources.length > 0)
    if (toSubmit.length > 0) {
      await submitResources(toSubmit)
    }

    // Progress
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const batchTime = Date.now() - batchStart
    const progress = Math.round((scanned / servers.length) * 100)
    const eta = ((servers.length - scanned) / PARALLEL_REQUESTS * (batchTime / 1000)).toFixed(0)

    console.log(`[${progress}%] Scanned ${scanned}/${servers.length} | Online: ${online} | Resources: ${totalResources.size} | ETA: ${eta}s`)

    await new Promise(r => setTimeout(r, BATCH_DELAY))
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n✅ Done in ${totalTime}s!`)
  console.log(`   Servers: ${servers.length}`)
  console.log(`   Online: ${online}`)
  console.log(`   Resources: ${totalResources.size}`)
}

main()
