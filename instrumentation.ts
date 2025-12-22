export async function register() {
  // Only run on server, not edge
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { autoInit } = await import('./lib/auto-init')

    console.log('[Boot] Starting auto-init...')

    // Lancer après 5 secondes (laisser le serveur démarrer)
    setTimeout(async () => {
      try {
        const result = await autoInit()
        console.log('[Boot] Auto-init result:', result)
      } catch (e) {
        console.error('[Boot] Auto-init failed:', e)
      }
    }, 5000)
  }
}
