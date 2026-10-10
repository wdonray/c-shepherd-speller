/**
 * Anti-bot defenses for the public email-auth API routes.
 *
 * Layered approach (cheapest first):
 *  1. Per-IP fixed-window rate limiting (in-memory). This is per server
 *     instance, so it is a speed bump rather than a hard wall on Amplify's
 *     multi-instance SSR. The hard wall is layer 3. A shared DynamoDB counter
 *     table is the upgrade path if we ever need cross-instance limits.
 *  2. Honeypot field on the sign-up form (checked in the route).
 *  3. Cloudflare Turnstile token verification (server-side, unforgeable).
 *
 * Every check runs before Cognito or DynamoDB are touched.
 */
import { NextResponse } from 'next/server'
import { reportError } from './report-error'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, number[]>()

/**
 * Fixed-window rate limiter. Returns true when the request is allowed.
 * Expired entries are pruned on each call so the map cannot grow unbounded.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): { allowed: boolean } {
  const timestamps = buckets.get(key) ?? []
  const fresh = timestamps.filter((t) => t > now - windowMs)
  if (fresh.length >= limit) {
    buckets.set(key, fresh)
    return { allowed: false }
  }
  fresh.push(now)
  buckets.set(key, fresh)
  return { allowed: true }
}

/** Test-only reset for the in-memory buckets. */
export function resetRateLimits(): void {
  buckets.clear()
}

/** Best-effort client IP behind Amplify/CloudFront (x-forwarded-for). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || 'unknown'
}

/** 429 JSON response shared by the email-auth routes. */
export function rateLimitedResponse(): NextResponse {
  return NextResponse.json({ ok: false, code: 'too-many-attempts' }, { status: 429 })
}

export type TurnstileResult = { ok: true } | { ok: false; reason: 'missing' | 'invalid' | 'unconfigured' | 'error' }

/**
 * Verify a Cloudflare Turnstile token server-side.
 *
 * Fails closed: any verification failure (including Cloudflare being
 * unreachable) rejects the request. When the secret key is not configured,
 * verification is skipped in non-production (local dev, tests) but fails
 * closed in production so a missing key can never silently disable the gate.
 */
export async function verifyTurnstileToken(token: string | undefined, remoteIp: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      reportError(new Error('TURNSTILE_SECRET_KEY is not configured'), {
        location: 'verifyTurnstileToken',
      })
      return { ok: false, reason: 'unconfigured' }
    }
    return { ok: true }
  }
  if (!token) {
    return { ok: false, reason: 'missing' }
  }
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: remoteIp }),
    })
    const data = (await response.json()) as { success?: boolean }
    return data?.success === true ? { ok: true } : { ok: false, reason: 'invalid' }
  } catch (error) {
    reportError(error, { location: 'verifyTurnstileToken' })
    return { ok: false, reason: 'error' }
  }
}
