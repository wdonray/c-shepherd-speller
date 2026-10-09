import { NextResponse } from 'next/server'
import {
  clientIpFromHeaders,
  isRateLimited,
  normalizeCount,
  normalizeEvent,
  normalizePath,
  recordEngagedVisitor,
  recordEvent,
  recordPageView,
} from '@/lib/analytics'
import { reportError } from '@/lib/report-error'

/**
 * POST /api/track { path: "/some/page" }
 * POST /api/track { path: "/some/page", engaged: true }
 * POST /api/track { event: "list-created" | "practice-session" | "words-practiced", count?: number }
 *
 * Records one page view or one app-usage event. Bots are filtered for page
 * views, events are allowlisted, and the client dedupes page views to one
 * hit per page per browsing session: this endpoint is the last line of
 * defense, not the only one.
 *
 * The `engaged` flag marks a human engagement signal (scroll). Page views
 * are always counted; unique visitors are only recorded when engaged is
 * true, so the uniques set contains humans rather than bots.
 */
export async function POST(request: Request) {
  try {
    const userAgent = request.headers.get('user-agent') ?? ''
    const ip = clientIpFromHeaders(request.headers)

    // Basic abuse protection: cap writes per IP so the endpoint can't be
    // used to inflate stats or run up DynamoDB costs.
    if (isRateLimited(`track:${ip}`)) {
      return NextResponse.json({ ok: false }, { status: 429 })
    }

    const body = (await request.json().catch(() => null)) as {
      path?: unknown
      engaged?: unknown
      event?: unknown
      count?: unknown
    } | null

    const event = normalizeEvent(body?.event)
    if (event) {
      await recordEvent(event, normalizeCount(body?.count))
      return NextResponse.json({ ok: true })
    }

    const path = normalizePath(typeof body?.path === 'string' ? body.path : null)
    if (!path) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    await recordPageView(path, ip, userAgent)

    // Only human engagement signals enter the unique-visitor set.
    // recordPageView already filters bots; recordEngagedVisitor does too.
    if (body?.engaged === true) {
      await recordEngagedVisitor(path, ip, userAgent)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    // Analytics must never break the site, but the failure is still reported.
    reportError(error, { location: 'POST /api/track', extra: { status: 200 } })
    return NextResponse.json({ ok: true })
  }
}
