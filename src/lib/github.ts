/**
 * GitHub releases endpoints and payload normalization for the /version page.
 *
 * Kept in a plain (non-client) module on purpose: src/app/version/page.tsx
 * is a server component, and importing these from the 'use client'
 * version-info module resolves functions to client-reference proxies on
 * the server (fetch fails with "Failed to parse URL from function() {",
 * and calling toRelease() throws "Attempted to call ... from the server").
 */

export const RELEASES_API = 'https://api.github.com/repos/wdonray/c-shepherd-speller/releases?per_page=5'
export const RELEASES_URL = 'https://github.com/wdonray/c-shepherd-speller/releases'

export interface Release {
  version: string
  url: string
  publishedAt: string | null
  summary: string | null
}

export interface GitHubReleasePayload {
  tag_name?: unknown
  html_url?: unknown
  published_at?: unknown
  body?: unknown
}

/**
 * Pull a one-line summary from a release body: the first PR title.
 *
 * Handles two formats, conventional first:
 * - conventional-changelog: "  - Fix project card locators (80946f4)" -> "Fix project card locators"
 * - GitHub auto-generated notes: "* fix: photo save permission error by @wdonray in <url>"
 *   -> "fix: photo save permission error"
 */
export function summarizeRelease(body: string | null): string | null {
  if (!body) return null
  const conventional = body.match(/^\s*-\s+(.+?)\s*\([0-9a-f]{7,40}\)\s*$/m)
  const summary = conventional?.[1]?.trim()
  if (summary) return summary
  const generated = body.match(/^\s*\*\s+(.+?)\s+by\s+@\S+/m)
  const fallback = generated?.[1]?.trim()
  return fallback ? fallback : null
}

/** Normalize one GitHub release payload into a Release. */
export function toRelease(data: GitHubReleasePayload): Release {
  return {
    version: String(data.tag_name ?? '').replace(/^v/i, ''),
    url: typeof data.html_url === 'string' && data.html_url ? data.html_url : RELEASES_URL,
    publishedAt: typeof data.published_at === 'string' ? data.published_at : null,
    summary: summarizeRelease(typeof data.body === 'string' ? data.body : null),
  }
}
