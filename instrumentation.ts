// This file runs automatically when the server starts
// No need to call any endpoint - everything starts automatically!

export async function register() {
  // Only run on server (not during build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[STARTUP] Initializing FiveM Metrics...')

    // Dynamic imports to avoid build issues
    const { loadResourcesFromRedis } = await import('./lib/cache')
    const { startBackgroundScanner } = await import('./lib/background-scanner')
    const { startIpCollector } = await import('./lib/ip-collector')
    const { isRedisEnabled } = await import('./lib/redis')

    // Load resources from Redis
    await loadResourcesFromRedis()
    console.log('[STARTUP] Resources loaded from Redis')

    // Start background services
    startBackgroundScanner()
    console.log('[STARTUP] Background scanner started')

    if (isRedisEnabled()) {
      startIpCollector()
      console.log('[STARTUP] IP collector started')
    }

    console.log('[STARTUP] All services running!')
  }
}
