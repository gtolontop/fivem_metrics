import { useState, useEffect } from 'react'
import { api, ServerData } from '../services/api'

export function useServers() {
  const [servers, setServers] = useState<ServerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchServers() {
      try {
        setLoading(true)
        const data = await api.getServers()
        if (mounted) {
          setServers(data)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch servers')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchServers()

    // Refresh every 30 seconds
    const interval = setInterval(fetchServers, 30000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return { servers, loading, error }
}

export function useServer(id: string | undefined) {
  const [server, setServer] = useState<ServerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    let mounted = true

    async function fetchServer() {
      try {
        setLoading(true)
        const data = await api.getServer(id)
        if (mounted) {
          setServer(data)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch server')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchServer()

    return () => {
      mounted = false
    }
  }, [id])

  return { server, loading, error }
}
