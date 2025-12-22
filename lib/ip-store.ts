import fs from 'fs'
import path from 'path'

const IP_FILE = path.join(process.cwd(), 'data', 'ip-mappings.json')

interface IpStore {
  mappings: Record<string, string> // cfxId -> realIp
  lastUpdate: number
}

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(IP_FILE)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

// Load IP mappings from file
export function loadIpMappings(): Map<string, string> {
  try {
    if (fs.existsSync(IP_FILE)) {
      const data = JSON.parse(fs.readFileSync(IP_FILE, 'utf-8')) as IpStore
      console.log(`Loaded ${Object.keys(data.mappings).length} IP mappings from disk`)
      return new Map(Object.entries(data.mappings))
    }
  } catch (e) {
    console.error('Failed to load IP mappings:', e)
  }
  return new Map()
}

// Save IP mappings to file
export function saveIpMappings(mappings: Map<string, string>): void {
  try {
    ensureDataDir()
    const data: IpStore = {
      mappings: Object.fromEntries(mappings),
      lastUpdate: Date.now()
    }
    fs.writeFileSync(IP_FILE, JSON.stringify(data, null, 2))
    console.log(`Saved ${mappings.size} IP mappings to disk`)
  } catch (e) {
    console.error('Failed to save IP mappings:', e)
  }
}

// Add a single IP mapping and save
export function addIpMapping(cfxId: string, realIp: string, allMappings: Map<string, string>): void {
  allMappings.set(cfxId, realIp)
  // Debounce saves - only save every 10 new mappings
  if (allMappings.size % 10 === 0) {
    saveIpMappings(allMappings)
  }
}
