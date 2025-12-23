'use client'

import { useState, useEffect, useCallback } from 'react'
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

export function useRealtimeStats() {
  const [data, setData] = useState<RealtimeStats | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(() => {
    const eventSource = new EventSource('/api/stats/stream')

    eventSource.onopen = () => {
      setConnected(true)
      setError(null)
      console.log('[SSE] Connected')
    }

    eventSource.onmessage = (event) => {
      try {
        const stats = JSON.parse(event.data) as RealtimeStats
        setData(stats)
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
