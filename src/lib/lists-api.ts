/**
 * Frontend API client for pattern-based word lists.
 * Calls the /api/lists endpoints; throws on non-OK responses.
 */

import type { WordList, CreateWordListInput, UpdateWordListInput } from '@/models/WordList'

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
  return data.list
}

export async function updateList(id: string, input: UpdateWordListInput): Promise<WordList> {
  const res = await fetch(`/api/lists/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await handleResponse<{ list: WordList }>(res)
  return data.list
}

export async function deleteList(id: string): Promise<void> {
  const res = await fetch(`/api/lists/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await handleResponse<{ ok: boolean }>(res)
}
