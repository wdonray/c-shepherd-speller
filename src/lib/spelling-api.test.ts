import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getUserByEmail,
  getSpelling,
  saveSpellingData,
  addWord,
  addSound,
  addSpelling,
  removeItem,
  updateItem,
  updateLastActive,
  type SpellingData,
} from './spelling-api'

const spellingData: SpellingData = { words: ['cat'], sounds: ['sh'], spelling: ['tion'] }

function mockFetchOnce(response: { ok: boolean; json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    json: response.json ?? (async () => ({})),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('spelling-api', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getUserByEmail fetches and returns the user', async () => {
    const user = { id: 'u1', email: 'a@b.c' }
    const fetchMock = mockFetchOnce({ ok: true, json: async () => ({ user }) })
    await expect(getUserByEmail('a@b.c')).resolves.toEqual(user)
    expect(fetchMock).toHaveBeenCalledWith('/api/users?email=a%40b.c')
  })

  it('getUserByEmail throws on failure', async () => {
    mockFetchOnce({ ok: false })
    await expect(getUserByEmail('a@b.c')).rejects.toThrow('Failed to fetch user by email')
  })

  it('getSpelling fetches and returns spellingData', async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: async () => ({ spellingData }) })
    await expect(getSpelling('u1')).resolves.toEqual(spellingData)
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u1/spelling')
  })

  it('getSpelling throws on failure', async () => {
    mockFetchOnce({ ok: false })
    await expect(getSpelling('u1')).rejects.toThrow('Failed to fetch spelling data')
  })

  it('saveSpellingData PUTs the data', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    await saveSpellingData('u1', spellingData)
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u1/spelling', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spellingData),
    })
  })

  it('saveSpellingData throws on failure', async () => {
    mockFetchOnce({ ok: false })
    await expect(saveSpellingData('u1', spellingData)).rejects.toThrow('Failed to save spelling data')
  })

  it('addWord appends the word', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    await addWord('u1', 'dog', ['cat'])
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u1/spelling', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: ['cat', 'dog'] }),
    })
  })

  it('addWord throws on failure', async () => {
    mockFetchOnce({ ok: false })
    await expect(addWord('u1', 'dog', [])).rejects.toThrow('Failed to add word')
  })

  it('addSound appends the sound', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    await addSound('u1', 'ch', ['sh'])
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u1/spelling', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sounds: ['sh', 'ch'] }),
    })
  })

  it('addSound throws on failure', async () => {
    mockFetchOnce({ ok: false })
    await expect(addSound('u1', 'ch', [])).rejects.toThrow('Failed to add sound')
  })

  it('addSpelling appends the spelling', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    await addSpelling('u1', 'ing', ['tion'])
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u1/spelling', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spelling: ['tion', 'ing'] }),
    })
  })

  it('addSpelling throws on failure', async () => {
    mockFetchOnce({ ok: false })
    await expect(addSpelling('u1', 'ing', [])).rejects.toThrow('Failed to add spelling')
  })

  it('removeItem filters out the index', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    await removeItem('u1', 'words', 0, ['cat', 'dog'])
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u1/spelling', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: ['dog'] }),
    })
  })

  it('removeItem throws on failure', async () => {
    mockFetchOnce({ ok: false })
    await expect(removeItem('u1', 'sounds', 0, ['sh'])).rejects.toThrow('Failed to remove sounds')
  })

  it('updateItem replaces the value at the index', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    await updateItem('u1', 'words', 0, 'bat', ['cat', 'dog'])
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u1/spelling', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: ['bat', 'dog'] }),
    })
  })

  it('updateItem throws on failure', async () => {
    mockFetchOnce({ ok: false })
    await expect(updateItem('u1', 'spelling', 1, 'tion', ['a', 'b'])).rejects.toThrow('Failed to update spelling')
  })

  it('updateLastActive PUTs without a body', async () => {
    const fetchMock = mockFetchOnce({ ok: true })
    await updateLastActive('u1')
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u1/last-active', { method: 'PUT' })
  })

  it('updateLastActive warns instead of throwing on failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetchOnce({ ok: false })
    await expect(updateLastActive('u1')).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith('Failed to update last active timestamp')
    warn.mockRestore()
  })
})
