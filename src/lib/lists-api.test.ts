import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
import { clearDataCache } from '@/lib/data-cache'
  getLists,
  getList,
  createList,
  updateList,
  deleteList,
  notifyListsChanged,
  LISTS_CHANGED_EVENT,
} from './lists-api'

describe('lists-api', () => {
  beforeEach(() => {
    clearDataCache()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const mockFetch = () => vi.mocked(fetch)

  it('getLists returns the lists array', async () => {
    const lists = [{ id: 'l1', name: 'Week 5' }]
    mockFetch().mockResolvedValueOnce({ ok: true, json: async () => ({ lists }) } as Response)

    expect(await getLists()).toEqual(lists)
    expect(fetch).toHaveBeenCalledWith('/api/lists')
  })

  it('getList fetches by encoded id', async () => {
    const list = { id: 'l1', name: 'Week 5' }
    mockFetch().mockResolvedValueOnce({ ok: true, json: async () => ({ list }) } as Response)

    expect(await getList('l1')).toEqual(list)
    expect(fetch).toHaveBeenCalledWith('/api/lists/l1')
  })

  it('getList encodes special characters in the id', async () => {
    mockFetch().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ list: { id: 'a/b' } }),
    } as Response)

    await getList('a/b')
    expect(fetch).toHaveBeenCalledWith('/api/lists/a%2Fb')
  })

  it('createList POSTs the input', async () => {
    const list = { id: 'l1', name: 'Week 5' }
    mockFetch().mockResolvedValueOnce({ ok: true, json: async () => ({ list }) } as Response)

    const input = { name: 'Week 5', patterns: [] }
    expect(await createList(input)).toEqual(list)
    const [, init] = mockFetch().mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(input)
  })

  it('updateList PUTs the input', async () => {
    const list = { id: 'l1', name: 'Renamed' }
    mockFetch().mockResolvedValueOnce({ ok: true, json: async () => ({ list }) } as Response)

    expect(await updateList('l1', { name: 'Renamed' })).toEqual(list)
    const [, init] = mockFetch().mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('PUT')
  })

  it('deleteList sends DELETE', async () => {
    mockFetch().mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) } as Response)

    await deleteList('l1')
    const [, init] = mockFetch().mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('DELETE')
  })

  it('throws with the server error message on failure', async () => {
    mockFetch().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid list data' }),
    } as Response)

    await expect(getLists()).rejects.toThrow('Invalid list data')
  })

  it('throws a generic message when the error body is unreadable', async () => {
    mockFetch().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('no json')
      },
    } as unknown as Response)

    await expect(getLists()).rejects.toThrow('Request failed with status 500')
  })
})

describe('notifyListsChanged', () => {
  it('dispatches the lists-changed event on window', () => {
    const handler = vi.fn()
    window.addEventListener(LISTS_CHANGED_EVENT, handler)
    notifyListsChanged()
    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener(LISTS_CHANGED_EVENT, handler)
  })
})
