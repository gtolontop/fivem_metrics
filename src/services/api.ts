const API_BASE = 'http://localhost:3001/api'

export interface ServerData {
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

export interface ResourceData {
  name: string
  serverCount: number
  totalPlayers: number
}

export interface StatsData {
  totalServers: number
  totalPlayers: number
  totalResources: number
  serversOnline: number
  avgPlayersPerServer: number
}

class ApiService {
  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`)
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }
    return response.json()
  }

  async getServers(): Promise<ServerData[]> {
    return this.fetch<ServerData[]>('/servers')
  }

  async getTopServers(): Promise<ServerData[]> {
    return this.fetch<ServerData[]>('/servers/top')
  }

  async getServer(id: string): Promise<ServerData> {
    return this.fetch<ServerData>(`/servers/${encodeURIComponent(id)}`)
  }

  async getResources(): Promise<ResourceData[]> {
    return this.fetch<ResourceData[]>('/resources')
  }

  async getStats(): Promise<StatsData> {
    return this.fetch<StatsData>('/stats')
  }
}

export const api = new ApiService()
