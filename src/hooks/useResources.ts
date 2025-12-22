import { useState, useEffect } from 'react'
import { api, ResourceData } from '../services/api'

export function useResources() {
  const [resources, setResources] = useState<ResourceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchResources() {
      try {
        setLoading(true)
        const data = await api.getResources()
        if (mounted) {
          setResources(data)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch resources')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchResources()

    // Refresh every 60 seconds
    const interval = setInterval(fetchResources, 60000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return { resources, loading, error }
}
