export interface Server {
  id: string
  endpoint: string
  name: string
  players: number
  maxPlayers: number
  gametype: string
  mapname: string
  resources: string[]
  vars: Record<string, string>
  icon: string | null
  upvotePower: number
  ownerName: string | null
  ownerAvatar: string | null
}

export interface Resource {
  name: string
  serverCount: number
  totalPlayers: number
}

export interface Stats {
  totalServers: number
  totalPlayers: number
  totalResources: number
  serversOnline: number
  avgPlayersPerServer: number
}
