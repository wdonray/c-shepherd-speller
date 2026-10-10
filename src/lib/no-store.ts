import { NextResponse } from 'next/server'

/**
 * Mark an API response as never-cacheable.
 *
 * Dynamic GET responses must not be cached by the CDN or the browser: a
 * cached GET /api/users?email=... once served the pre-upload user record,
 * making a freshly uploaded profile photo "disappear" on refresh. Apply to
 * every response produced by a GET handler, including auth and error
 * responses, so a stale cached response can never stand in for live data.
 */
export function noStore<T>(res: NextResponse<T>): NextResponse<T> {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

/** JSON response variant of {@link noStore}. */
export function noStoreJson<T>(data: T, init?: { status?: number }): NextResponse<T> {
  return noStore(NextResponse.json(data, init))
}
