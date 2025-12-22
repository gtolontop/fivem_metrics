/**
 * Migration Script - Transfère les données de l'ancien système vers le nouveau
 *
 * Ce script:
 * 1. Lit les IPs existantes dans Redis (ancien format)
 * 2. Les copie dans le nouveau format
 * 3. Initialise les queues
 *
 * Usage:
 *   npx tsx scripts/migrate-to-queue.ts
 */

import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL

if (!REDIS_URL) {
  console.error('REDIS_URL not set')
  process.exit(1)
}

const redis = new Redis(REDIS_URL)

// Anciennes clés
const OLD_IP_MAPPINGS = 'fivem:ip_mappings'
const OLD_IP_TIMESTAMPS = 'fivem:ip_timestamps'
const OLD_SCANNED_SERVERS = 'fivem:scanned_servers'
const OLD_SERVER_STATUS = 'fivem:server_status'
const OLD_RESOURCES = 'fivem:resources'

// Nouvelles clés
const NEW_DATA_IPS = 'data:ips'
const NEW_TS_IP_FETCH = 'ts:ip_fetch'
const NEW_DATA_STATUS = 'data:server_status'
const NEW_DATA_RESOURCES = 'data:resources'
const NEW_SET_ALL_SERVERS = 'set:all_servers'

async function migrate() {
  console.log('Starting migration...\n')

  // 1. Migrer les IPs
  console.log('1. Migrating IPs...')
  const oldIps = await redis.hgetall(OLD_IP_MAPPINGS)
  const ipCount = Object.keys(oldIps).length

  if (ipCount > 0) {
    await redis.hset(NEW_DATA_IPS, oldIps)
    console.log(`   Migrated ${ipCount} IPs`)

    // Ajouter au set des serveurs connus
    await redis.sadd(NEW_SET_ALL_SERVERS, ...Object.keys(oldIps))
    console.log(`   Added ${ipCount} servers to all_servers set`)
  } else {
    console.log('   No IPs to migrate')
  }

  // 2. Migrer les timestamps
  console.log('\n2. Migrating timestamps...')
  const oldTimestamps = await redis.hgetall(OLD_IP_TIMESTAMPS)
  const tsCount = Object.keys(oldTimestamps).length

  if (tsCount > 0) {
    await redis.hset(NEW_TS_IP_FETCH, oldTimestamps)
    console.log(`   Migrated ${tsCount} timestamps`)
  } else {
    console.log('   No timestamps to migrate')
  }

  // 3. Migrer les status
  console.log('\n3. Migrating server status...')
  const oldStatus = await redis.hgetall(OLD_SERVER_STATUS)
  const statusCount = Object.keys(oldStatus).length

  if (statusCount > 0) {
    // Convertir le format (1/0 -> online/offline)
    const newStatus: Record<string, string> = {}
    for (const [id, status] of Object.entries(oldStatus)) {
      newStatus[id] = status === '1' ? 'online' : 'offline'
    }
    await redis.hset(NEW_DATA_STATUS, newStatus)
    console.log(`   Migrated ${statusCount} status entries`)
  } else {
    console.log('   No status to migrate')
  }

  // 4. Copier les resources
  console.log('\n4. Migrating resources...')
  const oldResources = await redis.get(OLD_RESOURCES)
  if (oldResources) {
    await redis.set(NEW_DATA_RESOURCES, oldResources)
    const parsed = JSON.parse(oldResources)
    console.log(`   Migrated ${parsed.length} resources`)
  } else {
    console.log('   No resources to migrate')
  }

  // Stats finales
  console.log('\n--- Migration Complete ---')
  console.log(`IPs: ${ipCount}`)
  console.log(`Timestamps: ${tsCount}`)
  console.log(`Status: ${statusCount}`)
  console.log(`Resources: ${oldResources ? JSON.parse(oldResources).length : 0}`)

  // Vérification
  console.log('\n--- Verification ---')
  const newIpCount = await redis.hlen(NEW_DATA_IPS)
  const newServerCount = await redis.scard(NEW_SET_ALL_SERVERS)
  console.log(`New IPs in data:ips: ${newIpCount}`)
  console.log(`Servers in set:all_servers: ${newServerCount}`)

  await redis.quit()
  console.log('\nDone!')
}

migrate().catch(e => {
  console.error('Migration failed:', e)
  process.exit(1)
})
