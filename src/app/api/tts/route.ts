import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitedResponse } from '@/lib/antibot'
import { noStoreJson } from '@/lib/no-store'
import { reportError } from '@/lib/report-error'
import { MAX_TTS_TEXT_LENGTH, synthesizeEdgeTts } from '@/lib/edge-tts'

export const dynamic = 'force-dynamic'

/** Per-IP budget: a classroom tapping through long lists stays well under it. */
const RATE_LIMIT = 120
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

/**
 * GET /api/tts?text=... -> audio/mpeg
 *
 * Proxies one synthesis turn through the Edge read-aloud neural voice and
 * returns MP3 audio. Signed-in teachers only, rate-limited per IP, and the
 * text is length-capped so the endpoint cannot be used as an open relay.
 * Every upstream failure is a 502; the client falls back to the device's
 * built-in voices. Nothing is cached or logged.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession()
  if (auth.response) return auth.response

  const rateLimit = checkRateLimit(`tts:${getClientIp(request)}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)
  if (!rateLimit.allowed) return rateLimitedResponse()

  const text = request.nextUrl.searchParams.get('text')?.trim() ?? ''
  if (!text) {
    return noStoreJson({ error: 'Missing text to speak', code: 'missing-text' }, { status: 400 })
  }
  if (text.length > MAX_TTS_TEXT_LENGTH) {
    return noStoreJson({ error: 'Text is too long to speak', code: 'text-too-long' }, { status: 400 })
  }

  try {
    const audio = await synthesizeEdgeTts(text)
    return new NextResponse(new Uint8Array(audio), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    reportError(error, { location: 'GET /api/tts' })
    return noStoreJson({ error: 'Voice service unavailable', code: 'tts-unavailable' }, { status: 502 })
  }
}
