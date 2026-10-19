/**
 * Frontend API client for pattern-based word lists.
 * Calls the /api/lists endpoints; throws on non-OK responses.
 */

import type { WordList, CreateWordListInput, UpdateWordListInput } from '@/models/WordList'
import { HttpError } from '@/lib/error-toast'
import { cachedGet, invalidateDataCache, invalidateDataCachePrefix } from '@/lib/data-cache'

/**
 * Cache keys for list reads. All share the `lists:` prefix so any list write
 * can invalidate the whole family with one prefix call.
 */
const LISTS_CACHE_KEY = 'lists:all'
const listCacheKey = (id: string): string => `lists:${id}`
const listClassroomCacheKey = (id: string): string => `lists:${id}:classroom`

/**
 * Invalidate every cached list read (collection, single list, classroom
 * join). The list write functions call this themselves; direct write paths
 * to /api/lists (import, migration) call it explicitly.
 */
export function invalidateListsCache(): void {
  invalidateDataCachePrefix('lists:')
}

/**
 * Drop the cached classroom join for one list. Classroom rule edits write
 * through /api/classes/:classId/rules (not the list endpoints), so the rule
 * editors call this after a successful save.
 */
export function invalidateListClassroomCache(id: string): void {
  invalidateDataCache(listClassroomCacheKey(id))
}

/**
 * Browser event fired whenever the list collection changes outside the
 * dashboard (import, migration). Views that show lists listen for it and
 * reload. This module is only imported by client components.
 */
export const LISTS_CHANGED_EVENT = 'shepherd-speller:lists-changed'

export function notifyListsChanged(): void {
  // Import and migration write through the API without touching the write
  // functions below, so drop the cached reads here as well.
  invalidateListsCache()
  window.dispatchEvent(new Event(LISTS_CHANGED_EVENT))
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new HttpError(body.error || `Request failed with status ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

export async function getLists(): Promise<WordList[]> {
  return cachedGet(LISTS_CACHE_KEY, async () => {
    const res = await fetch('/api/lists')
    const data = await handleResponse<{ lists: WordList[] }>(res)
    return data.lists
  })
}

export async function getList(id: string): Promise<WordList> {
  return cachedGet(listCacheKey(id), async () => {
    const res = await fetch(`/api/lists/${encodeURIComponent(id)}`)
    const data = await handleResponse<{ list: WordList }>(res)
    return data.list
  })
}

/**
 * Classroom data joined onto a single-list fetch (issue #388): the class
 * name for the present page's pill and the class's spelling rules keyed by
 * pattern text. Null when the list has no classroom.
 */
export interface ListClassroom {
  name: string
  rules: Record<string, string>
}

export async function getListWithClassroom(id: string): Promise<{ list: WordList; classroom: ListClassroom | null }> {
  return cachedGet(listClassroomCacheKey(id), async () => {
    const res = await fetch(`/api/lists/${encodeURIComponent(id)}`)
    return handleResponse<{ list: WordList; classroom: ListClassroom | null }>(res)
  })
}

export async function createList(input: CreateWordListInput): Promise<WordList> {
  const res = await fetch('/api/lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await handleResponse<{ list: WordList }>(res)
  invalidateListsCache()
  return data.list
}

export async function updateList(id: string, input: UpdateWordListInput): Promise<WordList> {
  const res = await fetch(`/api/lists/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await handleResponse<{ list: WordList }>(res)
  invalidateListsCache()
  return data.list
}

export async function deleteList(id: string): Promise<void> {
  const res = await fetch(`/api/lists/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await handleResponse<{ ok: boolean }>(res)
  invalidateListsCache()
}
