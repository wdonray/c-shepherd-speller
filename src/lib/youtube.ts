/**
 * YouTube helpers (issue #401). Videos are stored as 11-character IDs;
 * these parse pasted URLs into IDs, build privacy-enhanced embed URLs, and
 * verify pasted links through oEmbed.
 */

/** YouTube video IDs are 11 chars from this alphabet. */
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

/**
 * True when the value is a syntactically valid 11-character YouTube video
 * ID (not a URL; use extractYouTubeId for those).
 */
export function isYouTubeVideoId(value: string): boolean {
  return YOUTUBE_ID_PATTERN.test(value)
}

/** oEmbed lookup timeout: short, with no retries (repo reliability rule). */
export const OEMBED_TIMEOUT_MS = 4000

/**
 * Extract the 11-character video ID from a YouTube URL (watch, youtu.be,
 * embed, shorts, live) or a bare ID. Returns null when nothing parses.
 */
export function extractYouTubeId(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (YOUTUBE_ID_PATTERN.test(value)) return value
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '')
  const segments = url.pathname.split('/').filter(Boolean)
  if (host === 'youtu.be') {
    const id = segments[0] ?? ''
    return YOUTUBE_ID_PATTERN.test(id) ? id : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (segments[0] === 'watch') {
      const id = url.searchParams.get('v') ?? ''
      return YOUTUBE_ID_PATTERN.test(id) ? id : null
    }
    if (segments.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(segments[0])) {
      const id = segments[1]
      return YOUTUBE_ID_PATTERN.test(id) ? id : null
    }
  }
  return null
}

/**
 * Privacy-enhanced embed URL (youtube-nocookie): no tracking cookies,
 * captions on by default for the classroom projector, no related videos.
 */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&cc_load_policy=1`
}

/** Thumbnail URL for a video ID (used for the click-to-play poster). */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

/**
 * Resolve a video ID to its YouTube title via oEmbed, verifying a pasted
 * link is a real video before it is attached. Resolves undefined on any
 * failure (non-OK status, unparseable body, network error, or timeout);
 * the caller shows the error and never retries.
 */
export async function fetchVideoTitle(videoId: string): Promise<{ title: string; channel?: string } | undefined> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { signal: controller.signal }
    )
    if (!res.ok) return undefined
    const data = (await res.json()) as { title?: unknown; author_name?: unknown }
    if (typeof data.title !== 'string' || !data.title) return undefined
    return {
      title: data.title,
      ...(typeof data.author_name === 'string' && data.author_name ? { channel: data.author_name } : {}),
    }
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}
