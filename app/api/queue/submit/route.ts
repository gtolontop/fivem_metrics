import { NextResponse } from 'next/server'
import { submitIpResults, submitScanResults, isQueueEnabled, IpResult, ScanResult } from '@/lib/queue'

export const dynamic = 'force-dynamic'

interface SubmitBody {
  type: 'ip_results' | 'scan_results'
  results: IpResult[] | ScanResult[]
  workerId?: string
}

/**
 * POST /api/queue/submit
 *
 * Soumet les résultats d'un batch de travail.
 *
 * Body pour ip_results:
 * {
 *   type: 'ip_results',
 *   results: [{ serverId: string, ip: string | null, error?: string }]
 * }
 *
 * Body pour scan_results:
 * {
 *   type: 'scan_results',
 *   results: [{ serverId: string, ip: string, online: boolean, resources?: string[], players?: number, error?: string }]
 * }
 */
export async function POST(request: Request) {
  if (!isQueueEnabled()) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  try {
    const body: SubmitBody = await request.json()

    if (!body.type || !body.results || !Array.isArray(body.results)) {
      return NextResponse.json({ error: 'Invalid body: need type and results array' }, { status: 400 })
    }

    if (body.type === 'ip_results') {
      const result = await submitIpResults(body.results as IpResult[])
      return NextResponse.json({
        type: 'ip_results',
        ...result,
        workerId: body.workerId
      })
    }

    if (body.type === 'scan_results') {
      const result = await submitScanResults(body.results as ScanResult[])
      return NextResponse.json({
        type: 'scan_results',
        ...result,
        workerId: body.workerId
      })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })

  } catch (e) {
    console.error('Submit error:', e)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}
