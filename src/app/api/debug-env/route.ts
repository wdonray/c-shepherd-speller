import { NextResponse } from 'next/server'

// TEMPORARY diagnostic endpoint for the Amplify preview deployment.
// Reports only whether watched env vars are present (non-empty), NEVER values.
// Added 2026-10-05 to diagnose the /api/auth 500; will be reverted immediately after.
const WATCHED = [
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
] as const

export async function GET() {
  const present: Record<string, boolean> = {}
  for (const name of WATCHED) {
    const v = process.env[name]
    present[name] = typeof v === 'string' && v.length > 0
  }
  return NextResponse.json({ present, totalEnvKeys: Object.keys(process.env).length })
}
