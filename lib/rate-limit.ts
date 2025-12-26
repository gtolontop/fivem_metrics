/**
 * Simple in-memory rate limiter for API endpoints
 * Generous limits for public API access
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (persists across hot reloads)
const globalStore = globalThis as unknown as { __rateLimitStore?: Map<string, RateLimitEntry> }

if (!globalStore.__rateLimitStore) {
  globalStore.__rateLimitStore = new Map()
}

const store = globalStore.__rateLimitStore

// Cleanup old entries periodically
let lastCleanup = 0
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  lastCleanup = now
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key)
    }
  }
}

export interface RateLimitConfig {
  limit: number        // Max requests per window
  windowMs: number     // Window size in milliseconds
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  limit: number
}

// Default configs for different endpoint types
export const RATE_LIMITS = {
  // Standard API endpoints - very generous
  api: { limit: 100, windowMs: 60 * 1000 } as RateLimitConfig,      // 100/min

  // Search endpoints - slightly more restricted
  search: { limit: 60, windowMs: 60 * 1000 } as RateLimitConfig,    // 60/min

  // SSE connections - limit concurrent connections
  sse: { limit: 5, windowMs: 60 * 1000 } as RateLimitConfig,        // 5 connections/min

  // Heavy endpoints (full resource list)
  heavy: { limit: 30, windowMs: 60 * 1000 } as RateLimitConfig,     // 30/min
}

/**
 * Check rate limit for an identifier (usually IP)
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.api
): RateLimitResult {
  cleanup()

  const now = Date.now()
  const key = `${identifier}:${config.limit}`

  let entry = store.get(key)

  // Create new entry if doesn't exist or window expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs
    }
    store.set(key, entry)
  }

  entry.count++

  return {
    allowed: entry.count <= config.limit,
    remaining: Math.max(0, config.limit - entry.count),
    resetTime: entry.resetTime,
    limit: config.limit
  }
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  // Check various headers for proxied requests
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  return 'unknown'
}

/**
 * Create rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  }
}

/**
 * Apply rate limiting to a request
 * Returns null if allowed, or Response if rate limited
 */
export function applyRateLimit(
  request: Request,
  config: RateLimitConfig = RATE_LIMITS.api
): { allowed: true; headers: Record<string, string> } | { allowed: false; response: Response } {
  const ip = getClientIp(request)
  const result = checkRateLimit(ip, config)

  if (!result.allowed) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
            ...rateLimitHeaders(result)
          }
        }
      )
    }
  }

  return {
    allowed: true,
    headers: rateLimitHeaders(result)
  }
}

/**
 * Get current rate limit stats for an IP
 */
export function getRateLimitStats(identifier: string): {
  apiUsed: number
  searchUsed: number
  sseUsed: number
} {
  const now = Date.now()

  const getCount = (config: RateLimitConfig) => {
    const key = `${identifier}:${config.limit}`
    const entry = store.get(key)
    if (!entry || entry.resetTime < now) return 0
    return entry.count
  }

  return {
    apiUsed: getCount(RATE_LIMITS.api),
    searchUsed: getCount(RATE_LIMITS.search),
    sseUsed: getCount(RATE_LIMITS.sse)
  }
}
