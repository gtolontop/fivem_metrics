'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { FiveMResource } from '@/lib/fivem'

export interface RealtimeStats {
  resources: FiveMResource[]
  totalResources: number
  serversScanned: number
  serversWithIp: number
  totalServers: number
  serversOnline: number
  pendingIpFetch: number
  pendingScan: number
  ipProgress: number
  scanProgress: number
  timestamp: number
}

interface StatsMessage {
  type: 'stats'
  totalResources: number
  serversScanned: number
  serversWithIp: number
  totalServers: number
  serversOnline: number
  pendingIpFetch: number
  pendingScan: number
  ipProgress: number
  scanProgress: number
  timestamp: number
}

interface ResourcesMessage {
  type: 'resources'
  resources: FiveMResource[]
  totalResources: number
  timestamp: number
}

type SSEMessage = StatsMessage | ResourcesMessage

export function useRealtimeStats() {
  const [data, setData] = useState<RealtimeStats | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resourcesRef = useRef<FiveMResource[]>([])

  const connect = useCallback(() => {
    const eventSource = new EventSource('/api/stats/stream')

    eventSource.onopen = () => {
      setConnected(true)
      setError(null)
      console.log('[SSE] Connected')
    }

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SSEMessage

        if (message.type === 'resources') {
          // Full resources update (every 10s)
          resourcesRef.current = message.resources
          setData(prev => ({
            resources: message.resources,
            totalResources: message.totalResources,
            serversScanned: prev?.serversScanned ?? 0,
            serversWithIp: prev?.serversWithIp ?? 0,
            totalServers: prev?.totalServers ?? 0,
            serversOnline: prev?.serversOnline ?? 0,
            pendingIpFetch: prev?.pendingIpFetch ?? 0,
            pendingScan: prev?.pendingScan ?? 0,
            ipProgress: prev?.ipProgress ?? 0,
            scanProgress: prev?.scanProgress ?? 0,
            timestamp: message.timestamp
          }))
        } else if (message.type === 'stats') {
          // Lightweight stats update (every 2s)
          setData(prev => ({
            resources: resourcesRef.current,
            totalResources: message.totalResources,
            serversScanned: message.serversScanned,
            serversWithIp: message.serversWithIp,
            totalServers: message.totalServers,
            serversOnline: message.serversOnline,
            pendingIpFetch: message.pendingIpFetch,
            pendingScan: message.pendingScan,
            ipProgress: message.ipProgress,
            scanProgress: message.scanProgress,
            timestamp: message.timestamp
          }))
        }
      } catch (e) {
        console.error('[SSE] Parse error:', e)
      }
    }

    eventSource.onerror = () => {
      setConnected(false)
      setError('Connection lost, reconnecting...')
      eventSource.close()

      // Reconnect after 3 seconds
      setTimeout(connect, 3000)
    }

    return eventSource
  }, [])

  useEffect(() => {
    const eventSource = connect()

    return () => {
      eventSource.close()
      setConnected(false)
    }
  }, [connect])

  return { data, connected, error }
}
