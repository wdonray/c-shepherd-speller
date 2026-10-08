/**
 * Frontend API client for pattern-based word lists.
 * Calls the /api/lists endpoints; throws on non-OK responses.
 */

import type { WordList, CreateWordListInput, UpdateWordListInput } from '@/models/WordList'
import { LISTS_CACHE_KEY, listCacheKey, readCache, writeCache, deleteCacheKey } from './data-cache'

/**
 * Browser event fired whenever the list collection changes outside the
 * dashboard (import, migration). Views that show lists listen for it and
 * reload. This module is only imported by client components.
 */
export const LISTS_CHANGED_EVENT = 'shepherd-speller:lists-changed'

export function notifyListsChanged(): void {
  window.dispatchEvent(new Event(LISTS_CHANGED_EVENT))
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function getLists(): Promise<WordList[]> {
  const res = await fetch('/api/lists')
  const data = await handleResponse<{ lists: WordList[] }>(res)
  return data.lists
}

export async function getList(id: string): Promise<WordList> {
  const res = await fetch(`/api/lists/${encodeURIComponent(id)}`)
  const data = await handleResponse<{ list: WordList }>(res)
  return data.list
}

export async function createList(input: CreateWordListInput): Promise<WordList> {
  const res = await fetch('/api/lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await handleResponse<{ list: WordList }>(res)
  // Write-through: keep the cached collection fresh so views update without a refetch.
  const lists = readCache<WordList[]>(LISTS_CACHE_KEY)
  if (lists) writeCache(LISTS_CACHE_KEY, [data.list, ...lists])
  return data.list
}

export async function updateList(id: string, input: UpdateWordListInput): Promise<WordList> {
  const res = await fetch(`/api/lists/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await handleResponse<{ list: WordList }>(res)
  // Write-through: update both the single-list and collection cache entries.
  writeCache(listCacheKey(id), data.list)
  const lists = readCache<WordList[]>(LISTS_CACHE_KEY)
  if (lists) writeCache(LISTS_CACHE_KEY, lists.map((l) => (l.id === id ? data.list : l)))
  return data.list
}

export async function deleteList(id: string): Promise<void> {
  const res = await fetch(`/api/lists/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await handleResponse<{ ok: boolean }>(res)
  // Write-through: drop the deleted list from the cache.
  deleteCacheKey(listCacheKey(id))
  const lists = readCache<WordList[]>(LISTS_CACHE_KEY)
  if (lists) writeCache(LISTS_CACHE_KEY, lists.filter((l) => l.id !== id))
}
