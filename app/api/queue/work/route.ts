import { NextResponse } from 'next/server'
import { getWorkerBatch, isQueueEnabled, cleanupStaleProcessing } from '@/lib/queue'
import { autoInit } from '@/lib/auto-init'

export const dynamic = 'force-dynamic'

/**
 * GET /api/queue/work?worker=xxx&type=ip_fetch|scan
 *
 * Récupère un batch de travail pour un worker.
 * Le worker reçoit des tâches de type ip_fetch ou scan.
 */
export async function GET(request: Request) {
  if (!isQueueEnabled()) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  // Auto-init si pas encore fait
  await autoInit()

  const { searchParams } = new URL(request.url)
  const workerId = searchParams.get('worker') || `anon-${Date.now()}`
  const preferType = searchParams.get('type') as 'ip_fetch' | 'scan' | undefined

  // Nettoyer les tâches en timeout
  await cleanupStaleProcessing()

  // Récupérer le batch
  const tasks = await getWorkerBatch(workerId, preferType)

  if (tasks.length === 0) {
    return NextResponse.json({
      tasks: [],
      message: 'No work available',
      workerId
    })
  }

  return NextResponse.json({
    tasks,
    count: tasks.length,
    workerId
  })
}
