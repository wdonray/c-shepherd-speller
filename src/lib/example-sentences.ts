/**
 * Example sentences for spelling words.
 *
 * Primary source: the Free Dictionary API (dictionaryapi.dev), a free,
 * keyless Wiktionary-derived API (CC-BY-SA). The browser calls it directly;
 * CORS is open, so no server proxy is needed.
 *
 * A curated local fallback bank (src/data/example-sentences.ts) covers
 * common words when the API has no example, fails, or is unreachable.
 * Results are cached in memory and localStorage.
 */

import { FALLBACK_SENTENCES } from '@/data/example-sentences'

const STORAGE_KEY = 'patternspell-sentences'
const MAX_CACHE_ENTRIES = 200
const FETCH_TIMEOUT_MS = 5000
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
  } catch {
    return {}
  }
}

function writeStorageCache(cache: Record<string, string[]>): void {
  try {
    const entries = Object.entries(cache).slice(-MAX_CACHE_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Storage unavailable; the memory cache still works.
  }
}

function getCached(word: string): string[] | undefined {
  const key = word.toLowerCase()
  if (memoryCache.has(key)) return memoryCache.get(key)
  const stored = readStorageCache()[key]
  if (stored) {
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

async function fetchFromApi(word: string): Promise<string[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: controller.signal,
    })
    if (!res.ok) return []
    const data: unknown = await res.json()
    return parseApiResponse(word, data)
  } catch {
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
 * Fetch up to 3 example sentences for a word. Tries the Free Dictionary API
 * first, then the local fallback bank. Results are cached. Never throws;
 * resolves to [] when nothing usable is found.
 */
export async function fetchExampleSentences(word: string): Promise<string[]> {
  const trimmed = word.trim().toLowerCase()
  if (!trimmed) return []
  const cached = getCached(trimmed)
  if (cached) return cached

  const fromApi = await fetchFromApi(trimmed)
  const sentences = fromApi.length > 0 ? fromApi : fallbackSentences(trimmed)
  setCached(trimmed, sentences)
  return sentences
}
