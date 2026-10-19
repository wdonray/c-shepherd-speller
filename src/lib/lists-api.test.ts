import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getLists,
  getList,
  getListWithClassroom,
  createList,
  updateList,
  deleteList,
  notifyListsChanged,
  invalidateListClassroomCache,
  LISTS_CHANGED_EVENT,
} from './lists-api'
import { clearDataCache } from './data-cache'

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

  it('getListWithClassroom returns the list and the joined classroom (issue #388)', async () => {
    const list = { id: 'l1', name: 'Week 5', classId: 'c1' }
    const classroom = { name: 'Period 2', rules: { a_e: 'ai never ends a word.' } }
    mockFetch().mockResolvedValueOnce({ ok: true, json: async () => ({ list, classroom }) } as Response)

    expect(await getListWithClassroom('l1')).toEqual({ list, classroom })
    expect(fetch).toHaveBeenCalledWith('/api/lists/l1')
  })

  it('getListWithClassroom returns classroom: null for lists without one', async () => {
    const list = { id: 'l1', name: 'Week 5' }
    mockFetch().mockResolvedValueOnce({ ok: true, json: async () => ({ list, classroom: null }) } as Response)

    expect(await getListWithClassroom('l1')).toEqual({ list, classroom: null })
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

  it('serves getLists from the cache on repeat calls (issue #479)', async () => {
    const lists = [{ id: 'l1', name: 'Week 5' }]
    mockFetch().mockResolvedValue({ ok: true, json: async () => ({ lists }) } as Response)

    expect(await getLists()).toEqual(lists)
    expect(await getLists()).toEqual(lists)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('caches single-list reads per id and the classroom join separately', async () => {
    const list = { id: 'l1', name: 'Week 5' }
    const classroom = { name: 'Period 2', rules: {} }
    mockFetch().mockResolvedValue({ ok: true, json: async () => ({ list, classroom }) } as Response)

    expect(await getList('l1')).toEqual(list)
    expect(await getList('l1')).toEqual(list)
    expect(await getListWithClassroom('l1')).toEqual({ list, classroom })
    expect(await getListWithClassroom('l1')).toEqual({ list, classroom })
    // One fetch for the plain read, one for the classroom join.
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('createList invalidates the cached collection', async () => {
    mockFetch()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lists: [{ id: 'l1' }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ list: { id: 'l2' } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lists: [{ id: 'l1' }, { id: 'l2' }] }) } as Response)

    expect(await getLists()).toHaveLength(1)
    await createList({ name: 'Week 6', patterns: [] })
    expect(await getLists()).toHaveLength(2)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('updateList invalidates the cached collection and the single list', async () => {
    const list = { id: 'l1', name: 'Week 5' }
    mockFetch()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lists: [list] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ list }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ list: { ...list, name: 'Renamed' } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lists: [{ ...list, name: 'Renamed' }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ list: { ...list, name: 'Renamed' } }) } as Response)

    await getLists()
    await getList('l1')
    await updateList('l1', { name: 'Renamed' })
    expect(await getLists()).toEqual([{ ...list, name: 'Renamed' }])
    expect(await getList('l1')).toEqual({ ...list, name: 'Renamed' })
    expect(fetch).toHaveBeenCalledTimes(5)
  })

  it('deleteList invalidates the cached reads', async () => {
    mockFetch()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lists: [{ id: 'l1' }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ lists: [] }) } as Response)

    expect(await getLists()).toHaveLength(1)
    await deleteList('l1')
    expect(await getLists()).toHaveLength(0)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('invalidateListClassroomCache drops only that list classroom entry (issue #479)', async () => {
    const classroom = { name: 'Period 2', rules: {} }
    mockFetch().mockResolvedValue({ ok: true, json: async () => ({ list: { id: 'l1' }, classroom }) } as Response)

    await getListWithClassroom('l1')
    await getListWithClassroom('l2')
    expect(fetch).toHaveBeenCalledTimes(2)
    invalidateListClassroomCache('l1')
    await getListWithClassroom('l1')
    await getListWithClassroom('l2')
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})

describe('notifyListsChanged', () => {
  beforeEach(() => {
    clearDataCache()
  })

  it('dispatches the lists-changed event on window', () => {
    const handler = vi.fn()
    window.addEventListener(LISTS_CHANGED_EVENT, handler)
    notifyListsChanged()
    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener(LISTS_CHANGED_EVENT, handler)
  })

  it('invalidates the cached list reads (issue #479)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ lists: [{ id: 'l1' }] }) } as Response)
    vi.stubGlobal('fetch', fetchMock)

    expect(await getLists()).toHaveLength(1)
    notifyListsChanged()
    expect(await getLists()).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })
})
