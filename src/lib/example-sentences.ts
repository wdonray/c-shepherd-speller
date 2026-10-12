/**
 * Example sentences for spelling words.
 *
 * Primary source: the Free Dictionary API (dictionaryapi.dev), a free,
 * keyless Wiktionary-derived API (CC-BY-SA). The browser calls it directly;
 * CORS is open, so no server proxy is needed.
 *
 * A curated local fallback bank (src/data/example-sentences.ts) covers
 * common words when the API has no example, fails, or is unreachable.
 * Non-empty results are cached in memory and localStorage. Empty results
 * are never cached, so a transient miss retries on the next request instead
 * of becoming permanent.
 */

import { FALLBACK_SENTENCES } from '@/data/example-sentences'
import { reportError } from './report-error'

const STORAGE_KEY = 'patternspell-sentences'
const MAX_CACHE_ENTRIES = 200
const FETCH_TIMEOUT_MS = 10000
const MAX_FETCH_ATTEMPTS = 2
const RETRY_DELAY_MS = 1000
const MAX_SENTENCE_LENGTH = 140
const MAX_RESULTS = 3

const memoryCache = new Map<string, string[]>()

function readStorageCache(): Record<string, string[]> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string[]>
    }
    return {}
  } catch (error) {
    reportError(error, { location: 'example-sentences.readStorageCache' })
    return {}
  }
}

function writeStorageCache(cache: Record<string, string[]>): void {
  try {
    const entries = Object.entries(cache).slice(-MAX_CACHE_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch (error) {
    // Storage unavailable; the memory cache still works.
    reportError(error, { location: 'example-sentences.writeStorageCache' })
  }
}

function getCached(word: string): string[] | undefined {
  const key = word.toLowerCase()
  if (memoryCache.has(key)) return memoryCache.get(key)
  const stored = readStorageCache()[key]
  // Empty entries are never cached anymore, but treat legacy empty entries
  // as misses so a past failure does not block a future retry.
  if (stored && stored.length > 0) {
    memoryCache.set(key, stored)
    return stored
  }
  return undefined
}

function setCached(word: string, sentences: string[]): void {
  const key = word.toLowerCase()
  memoryCache.set(key, sentences)
  const cache = readStorageCache()
  cache[key] = sentences
  writeStorageCache(cache)
}

/** A sentence is usable when it mentions the word, is short, and ends cleanly. */
export function isUsableSentence(word: string, sentence: string): boolean {
  const trimmed = sentence.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_SENTENCE_LENGTH) return false
  if (!/[.!?]$/.test(trimmed)) return false
  return trimmed.toLowerCase().includes(word.toLowerCase())
}

interface DictionaryEntry {
  meanings?: Array<{
    definitions?: Array<{ example?: string }>
  }>
}

function parseApiResponse(word: string, data: unknown): string[] {
  if (!Array.isArray(data)) return []
  const sentences: string[] = []
  for (const entry of data as DictionaryEntry[]) {
    for (const meaning of entry.meanings ?? []) {
      for (const def of meaning.definitions ?? []) {
        if (def.example && isUsableSentence(word, def.example) && !sentences.includes(def.example.trim())) {
          sentences.push(def.example.trim())
          if (sentences.length >= MAX_RESULTS) return sentences
        }
      }
    }
  }
  return sentences
}

async function processApiResponse(word: string, res: Response): Promise<string[]> {
  try {
    if (!res.ok) return []
    const data: unknown = await res.json()
    return parseApiResponse(word, data)
  } catch (error) {
    reportError(error, { location: 'example-sentences.fetchFromApi', extra: { word } })
    return []
  }
}

/**
 * One attempt at the Free Dictionary API. Returns the usable sentences, or
 * null when the request failed at the network level (unreachable, timed
 * out, aborted), which is retryable. A successful response with no usable
 * sentences returns [] and is not retried.
 */
async function fetchOnce(word: string): Promise<string[] | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: controller.signal,
    })
  } catch {
    // The third-party dictionary API is unreachable (network failure,
    // timeout, abort). This is not an application error: the local fallback
    // bank covers it, so there is nothing to report to Sentry.
    return null
  } finally {
    clearTimeout(timeout)
  }
  return processApiResponse(word, res)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Fetch from the API, retrying network-level failures with backoff. */
async function fetchFromApi(word: string): Promise<string[]> {
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    const result = await fetchOnce(word)
    if (result !== null) return result
    if (attempt < MAX_FETCH_ATTEMPTS) {
      await delay(RETRY_DELAY_MS * 2 ** (attempt - 1))
    }
  }
  return []
}

function fallbackSentences(word: string): string[] {
  const bank = FALLBACK_SENTENCES[word.toLowerCase()] ?? []
  return bank.filter((s) => isUsableSentence(word, s)).slice(0, MAX_RESULTS)
}

/**
 * Fetch up to 3 example sentences for a word. Tries the Free Dictionary API
 * first (with one retry on network failure), then the local fallback bank.
 * Non-empty results are cached. Misses are never cached, so a transient
 * failure retries on the next request. Never throws; resolves to [] when
 * nothing usable is found.
 */
export async function fetchExampleSentences(word: string): Promise<string[]> {
  const trimmed = word.trim().toLowerCase()
  if (!trimmed) return []
  const cached = getCached(trimmed)
  if (cached) return cached

  const fromApi = await fetchFromApi(trimmed)
  const sentences = fromApi.length > 0 ? fromApi : fallbackSentences(trimmed)
  // Never cache a miss: caching [] would turn a transient API failure into
  // a permanent "no sentences" for that word.
  if (sentences.length > 0) setCached(trimmed, sentences)
  return sentences
}
