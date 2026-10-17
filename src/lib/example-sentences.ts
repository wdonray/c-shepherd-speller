/**
 * Example sentences for spelling words.
 *
 * Primary source: our own dictionary (src/data/fallback-sentences.json),
 * a curated bank of short, age-appropriate sentences for common spelling
 * words. It answers instantly with no network involved.
 *
 * When our dictionary has no entry, we try the Free Dictionary API
 * (dictionaryapi.dev), a free, keyless Wiktionary-derived API (CC-BY-SA).
 * The browser calls it directly; CORS is open, so no server proxy is
 * needed. The API gets one short attempt: it has proven flaky, and the
 * dialog must never sit on a spinner for tens of seconds waiting it out.
 *
 * Non-empty results are cached in memory and localStorage along with where
 * they came from, so the UI can attribute API sentences and stay silent for
 * our own dictionary. Empty results are never cached, so a transient miss
 * retries on the next request instead of becoming permanent.
 */

import { FALLBACK_SENTENCES } from '@/data/example-sentences'
import { reportError } from './report-error'

const STORAGE_KEY = 'patternspell-sentences-v2'
const MAX_CACHE_ENTRIES = 200
const FETCH_TIMEOUT_MS = 3000
const MAX_SENTENCE_LENGTH = 140
const MAX_RESULTS = 3

/** Where the suggested sentences came from. */
export type SentenceSource = 'api' | 'local'

export interface SentenceResult {
  sentences: string[]
  source: SentenceSource
}

interface StoredEntry {
  sentences: string[]
  source: SentenceSource
}

const memoryCache = new Map<string, StoredEntry>()

function isValidStoredEntry(value: unknown): value is StoredEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entry = value as { sentences?: unknown; source?: unknown }
  if (!Array.isArray(entry.sentences) || entry.sentences.length === 0) return false
  if (!entry.sentences.every((s) => typeof s === 'string')) return false
  return entry.source === 'api' || entry.source === 'local'
}

function readStorageCache(): Record<string, StoredEntry> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const valid: Record<string, StoredEntry> = {}
      for (const [key, value] of Object.entries(parsed)) {
        if (isValidStoredEntry(value)) valid[key] = value
      }
      return valid
    }
    return {}
  } catch (error) {
    reportError(error, { location: 'example-sentences.readStorageCache' })
    return {}
  }
}

function writeStorageCache(cache: Record<string, StoredEntry>): void {
  try {
    const entries = Object.entries(cache).slice(-MAX_CACHE_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch (error) {
    // Storage unavailable; the memory cache still works.
    reportError(error, { location: 'example-sentences.writeStorageCache' })
  }
}

function getCached(word: string): StoredEntry | undefined {
  const key = word.toLowerCase()
  if (memoryCache.has(key)) return memoryCache.get(key)
  const stored = readStorageCache()[key]
  if (stored) {
    memoryCache.set(key, stored)
    return stored
  }
  return undefined
}

function setCached(word: string, entry: StoredEntry): void {
  const key = word.toLowerCase()
  memoryCache.set(key, entry)
  const cache = readStorageCache()
  cache[key] = entry
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
 * [] when the request failed at the network level (unreachable, timed out,
 * aborted) or the response had no usable sentences. There is no retry: the
 * API is a best-effort long-tail fallback, and a slow network must never
 * hold the dialog open.
 */
async function fetchFromApi(word: string): Promise<string[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: controller.signal,
    })
    return await processApiResponse(word, res)
  } catch {
    // The third-party dictionary API is unreachable (network failure,
    // timeout, abort). This is not an application error: our own dictionary
    // is the primary source, so there is nothing to report to Sentry.
    return []
  } finally {
    clearTimeout(timeout)
  }
}

function fallbackSentences(word: string): string[] {
  const bank = FALLBACK_SENTENCES[word.toLowerCase()] ?? []
  return bank.filter((s) => isUsableSentence(word, s)).slice(0, MAX_RESULTS)
}

/**
 * Fetch up to 3 example sentences for a word, along with where they came
 * from. Checks our own dictionary first (instant, no network), then the
 * Free Dictionary API with a single short attempt for words the bank does
 * not cover. Non-empty results are cached. Misses are never cached, so a
 * transient failure retries on the next request. Never throws; resolves to
 * an empty list when nothing usable is found.
 */
export async function fetchExampleSentences(word: string): Promise<SentenceResult> {
  const trimmed = word.trim().toLowerCase()
  if (!trimmed) return { sentences: [], source: 'local' }
  const cached = getCached(trimmed)
  if (cached) return { sentences: cached.sentences, source: cached.source }

  const fromBank = fallbackSentences(trimmed)
  if (fromBank.length > 0) {
    const entry: StoredEntry = { sentences: fromBank, source: 'local' }
    setCached(trimmed, entry)
    return entry
  }

  const fromApi = await fetchFromApi(trimmed)
  if (fromApi.length > 0) {
    const entry: StoredEntry = { sentences: fromApi, source: 'api' }
    setCached(trimmed, entry)
    return entry
  }

  // Never cache a miss: caching [] would turn a transient API failure into
  // a permanent "no sentences" for that word.
  return { sentences: [], source: 'local' }
}
