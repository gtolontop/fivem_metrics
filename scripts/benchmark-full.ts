// Full benchmark: IP extraction + server scanning
const SCAN_CONCURRENCY = 200  // How many servers to scan in parallel
const SCAN_TIMEOUT = 3000     // 3s timeout per server

async function benchmark() {
  console.log('='.repeat(60))
  console.log('FULL BENCHMARK: IP Extraction + Server Scanning')
  console.log('='.repeat(60))

  const totalStart = Date.now()

  // Step 1: Get IPs from protobuf
  console.log('\n[1/3] Fetching IPs from protobuf...')
  const step1Start = Date.now()

  const { getServersWithIps } = await import('../lib/fivem')
  const { directIps, needsResolution, totalServers } = await getServersWithIps()

  const step1Time = Date.now() - step1Start
  console.log(`     Done in ${(step1Time / 1000).toFixed(1)}s`)
  console.log(`     Direct IPs: ${directIps.size} (${(directIps.size / totalServers * 100).toFixed(1)}%)`)
  console.log(`     Need API: ${needsResolution.length}`)

  // Step 2: Resolve URLs (simulate - in production this calls FiveM API)
  console.log('\n[2/3] Resolving URLs via API...')
  const step2Start = Date.now()

  // Simulate API calls for URL resolution (100 concurrent, 100ms each avg)
  const urlBatches = Math.ceil(needsResolution.length / 100)
  const estimatedApiTime = urlBatches * 1.5 // 1.5s per batch (rate limit friendly)
  console.log(`     Simulating ${needsResolution.length} API calls in ${urlBatches} batches...`)
  console.log(`     (In production: ~${estimatedApiTime.toFixed(0)}s)`)

  // Actually wait a bit to simulate
  await new Promise(r => setTimeout(r, Math.min(5000, estimatedApiTime * 100)))

  const step2Time = Date.now() - step2Start
  console.log(`     Simulation done in ${(step2Time / 1000).toFixed(1)}s`)

  // Step 3: Scan servers for resources
  console.log('\n[3/3] Scanning servers for resources...')
  console.log(`     Concurrency: ${SCAN_CONCURRENCY}`)
  console.log(`     Timeout: ${SCAN_TIMEOUT}ms`)

  const step3Start = Date.now()
  const allIps = Array.from(directIps.entries())

  let scanned = 0
  let online = 0
  let offline = 0
  let lastLog = Date.now()

  // Scan function
  async function scanServer(ip: string): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT)

      const res = await fetch(`http://${ip}/info.json`, {
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (res.ok) {
        await res.json() // Consume body
        return true
      }
      return false
    } catch {
      return false
    }
  }

  // Process in batches
  const totalToScan = Math.min(allIps.length, 5000) // Limit for benchmark
  console.log(`     Scanning ${totalToScan} servers (limited for benchmark)...`)

  for (let i = 0; i < totalToScan; i += SCAN_CONCURRENCY) {
    const batch = allIps.slice(i, i + SCAN_CONCURRENCY)
    const results = await Promise.all(
      batch.map(([, ip]) => scanServer(ip))
    )

    for (const isOnline of results) {
      scanned++
      if (isOnline) online++
      else offline++
    }

    // Progress log every 2 seconds
    if (Date.now() - lastLog > 2000) {
      const progress = (scanned / totalToScan * 100).toFixed(0)
      const elapsed = ((Date.now() - step3Start) / 1000).toFixed(1)
      const rate = (scanned / (Date.now() - step3Start) * 1000).toFixed(0)
      console.log(`     Progress: ${scanned}/${totalToScan} (${progress}%) - ${online} online - ${rate}/s - ${elapsed}s elapsed`)
      lastLog = Date.now()
    }
  }

  const step3Time = Date.now() - step3Start
  console.log(`     Done in ${(step3Time / 1000).toFixed(1)}s`)
  console.log(`     Online: ${online}, Offline: ${offline}`)
  console.log(`     Rate: ${(scanned / step3Time * 1000).toFixed(0)} servers/sec`)

  // Summary
  const totalTime = Date.now() - totalStart
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`Step 1 (Protobuf IPs):    ${(step1Time / 1000).toFixed(1)}s`)
  console.log(`Step 2 (URL Resolution):  ${(step2Time / 1000).toFixed(1)}s (simulated)`)
  console.log(`Step 3 (Server Scan):     ${(step3Time / 1000).toFixed(1)}s (${totalToScan} servers)`)
  console.log('-'.repeat(60))
  console.log(`TOTAL:                    ${(totalTime / 1000).toFixed(1)}s`)
  console.log('')

  // Extrapolate to full scan
  const fullScanEstimate = step1Time + (estimatedApiTime * 1000) + (step3Time * (directIps.size / totalToScan))
  console.log(`Estimated FULL scan (${directIps.size} servers): ${(fullScanEstimate / 1000 / 60).toFixed(1)} minutes`)
  console.log('')
  console.log('Compare to OLD method: ~4 hours')
}

benchmark().catch(console.error)
