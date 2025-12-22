import { NextResponse } from 'next/server'
import { getCache, getIpMappingCount } from '@/lib/cache'
import { isRedisEnabled, getIpMappingsFromRedis, getIpMappingCount as getRedisIpCount } from '@/lib/redis'

export const dynamic = 'force-dynamic'

// Returns a batch of server IDs that need IP resolution
const BATCH_SIZE = 100

// Track which servers are being processed (avoid duplicates)
const globalProcessing = globalThis as unknown as { __processing?: Set<string> }
if (!globalProcessing.__processing) {
  globalProcessing.__processing = new Set()
}
const processing = globalProcessing.__processing

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const workerId = searchParams.get('worker') || 'unknown'

  const cache = getCache()

  if (cache.servers.length === 0) {
    return NextResponse.json({
      serverIds: [],
      message: 'No servers in cache. Call /api/data first.',
      total: 0,
      processed: 0
    })
  }

  // Get existing IP mappings (from Redis or local cache)
  let existingIps: Set<string>
  let processedCount: number

  if (isRedisEnabled()) {
    const redisIps = await getIpMappingsFromRedis()
    existingIps = new Set(redisIps.keys())
    processedCount = await getRedisIpCount()
  } else {
    existingIps = new Set(cache.ipMappings.keys())
    processedCount = getIpMappingCount()
  }

  // Get servers without IP that aren't being processed
  const needIp = cache.servers
    .filter(s => !existingIps.has(s.id) && !processing.has(s.id))
    .slice(0, BATCH_SIZE)

  // Mark as processing
  needIp.forEach(s => processing.add(s.id))

  // Auto-cleanup after 60 seconds (in case worker dies)
  setTimeout(() => {
    needIp.forEach(s => processing.delete(s.id))
  }, 60000)

  return NextResponse.json({
    serverIds: needIp.map(s => s.id),
    workerId,
    batchSize: needIp.length,
    total: cache.servers.length,
    processed: processedCount,
    remaining: cache.servers.length - processedCount,
    progress: Math.round((processedCount / cache.servers.length) * 100),
    storage: isRedisEnabled() ? 'redis' : 'file'
  })
}
