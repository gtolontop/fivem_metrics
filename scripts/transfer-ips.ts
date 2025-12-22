// Transfer local IPs to Railway
const LOCAL = 'http://localhost:3005'
const RAILWAY = 'https://fivemmetrics-production.up.railway.app'

async function main() {
  console.log('Fetching local IPs...')
  const res = await fetch(`${LOCAL}/api/servers-with-ips`)
  const servers = await res.json() as Array<{id: string, ip: string}>

  // Filter out URLs, keep only real IPs
  const results: Record<string, string> = {}
  for (const s of servers) {
    if (s.ip && !s.ip.startsWith('http')) {
      results[s.id] = s.ip
    }
  }

  console.log(`Found ${Object.keys(results).length} valid IPs`)
  console.log('Transferring to Railway...')

  const submitRes = await fetch(`${RAILWAY}/api/worker/submit-ips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results, workerId: 'local-transfer' })
  })

  console.log(await submitRes.json())
}

main()
