import { NextResponse } from 'next/server'

// TEMPORARY diagnostic endpoint for the Amplify preview deployment.
// Reports env var NAMES present in the runtime (never values).
// Added 2026-10-05 to diagnose the /api/auth 500; will be reverted immediately after.
export async function GET() {
  const names = Object.keys(process.env).sort()
  const watched = [
    'NODE_ENV',
    'NEXTAUTH_SECRET',
    'AUTH_SECRET',
    'NEXTAUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'AUTH_DYNAMODB_REGION',
    'AUTH_DYNAMODB_ID',
    'AUTH_DYNAMODB_SECRET',
    'USER_TABLE_NAME',
    'AUTH_TABLE_NAME',
  ]
  const present: Record<string, boolean> = {}
  for (const name of watched) {
    const v = process.env[name]
    present[name] = typeof v === 'string' && v.length > 0
  }
  return NextResponse.json({ present, allNames: names })
}
