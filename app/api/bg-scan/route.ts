import { NextResponse } from 'next/server'
import { runScan, getScanStatus, startBackgroundScanner } from '@/lib/background-scanner'

// Start background scanner on first request
let initialized = false

function ensureStarted() {
  if (!initialized) {
    startBackgroundScanner()
    initialized = true
  }
}

// GET /api/bg-scan - Get scan status and ensure scanner is running
export async function GET() {
  ensureStarted()
  const status = getScanStatus()
  return NextResponse.json(status)
}

// POST /api/bg-scan - Trigger immediate scan
export async function POST() {
  ensureStarted()

  const result = await runScan()
  const status = getScanStatus()

  return NextResponse.json({
    ...result,
    status
  })
}
