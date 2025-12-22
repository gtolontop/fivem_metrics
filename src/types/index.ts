export interface Server {
  id: string
  name: string
  players: number
  maxPlayers: number
  ping: number
  ip: string
  port: number
  resources: string[]
  tags: string[]
  country: string
  uptime: number
  lastSeen: Date
}

export interface Resource {
  name: string
  displayName: string
  description?: string
  version?: string
  serverCount: number
  totalPlayers: number
  category: string
  trending: boolean
  author?: string
}

export interface Stats {
  totalServers: number
  totalPlayers: number
  totalResources: number
  avgPlayersPerServer: number
  serversOnline: number
  peakPlayers24h: number
}
