import { NextResponse } from 'next/server'
import { version } from '../../../../package.json'

export const dynamic = 'force-dynamic'

/**
 * GET /api/version -> { version: "0.6.0" }
 *
 * Reports the version of the currently deployed build. Never statically
 * cached: force-dynamic plus a no-store header so the reload-prompt hook
 * always compares against what is deployed right now, not what the CDN
 * or the browser remembered. No auth, no logging.
 */
export async function GET() {
  return NextResponse.json({ version }, { headers: { 'Cache-Control': 'no-store' } })
}
