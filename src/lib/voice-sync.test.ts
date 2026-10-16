import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('next-auth/react', () => ({ getSession }))

const { getUserByEmail } = vi.hoisted(() => ({ getUserByEmail: vi.fn() }))
vi.mock('./spelling-api', () => ({ getUserByEmail }))

const {
  getRecording,
  getAllRecordings,
  putRecording,
  deleteRecording,
  markRecordingSynced,
  enqueueSyncOp,
  getDueSyncOps,
  deleteSyncOp,
  updateSyncOpRetry,
  reportError,
} = vi.hoisted(() => ({
  getRecording: vi.fn(),
  getAllRecordings: vi.fn(),
  putRecording: vi.fn(),
  deleteRecording: vi.fn(),
  markRecordingSynced: vi.fn(),
  enqueueSyncOp: vi.fn(),
  getDueSyncOps: vi.fn(),
  deleteSyncOp: vi.fn(),
  updateSyncOpRetry: vi.fn(),
  reportError: vi.fn(),
}))
vi.mock('./voice-recordings', () => ({
  getRecording,
  getAllRecordings,
  putRecording,
  deleteRecording,
  markRecordingSynced,
  enqueueSyncOp,
  getDueSyncOps,
  deleteSyncOp,
  updateSyncOpRetry,
}))
vi.mock('./report-error', () => ({ reportError }))

import {
  syncNow,
  notifyRecordingSaved,
  notifyRecordingDeleted,
  QuotaExceededError,
  __resetSyncGuardForTests,
} from './voice-sync'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

interface RemoteItem {
  text: string
  mimeType: string
  byteSize: number
  recordedAt: number
  updatedAt: number
}

const localRec = (overrides = {}) => ({
  text: 'cake',
  audio: new ArrayBuffer(8),
  mimeType: 'audio/webm',
  recordedAt: 100,
  userId: null as string | null,
  syncedAt: null as number | null,
  ...overrides,
})

const remoteItem = (overrides = {}): RemoteItem => ({
  text: 'cake',
  mimeType: 'audio/webm',
  byteSize: 8,
  recordedAt: 100,
  updatedAt: 200,
  ...overrides,
})

type JsonBody = Record<string, unknown>

/** Default happy-path fetch; override pieces per test via `overrides`. */
function happyFetch(
  remote: RemoteItem[] = [],
  overrides: Record<string, (url: string, init?: RequestInit) => Promise<unknown>> = {}
) {
  return async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const key = `${method} ${url}`
    if (overrides[key]) return overrides[key](url, init)
    if (url === '/api/voice-recordings' && method === 'GET')
      return { ok: true, json: async () => ({ recordings: remote }) }
    if (url === '/api/voice-recordings' && method === 'POST')
      return {
        ok: true,
        json: async () => ({ uploadUrl: 'https://s3.example/put', s3Key: 'k', expiresIn: 900 }),
      }
    if (url === '/api/voice-recordings' && method === 'PATCH')
      return { ok: true, json: async () => ({ ok: true, updatedAt: 999 }) }
    if (url === '/api/voice-recordings' && method === 'DELETE') return { ok: true, json: async () => ({ ok: true }) }
    if (url === '/api/voice-recordings/download-urls')
      return {
        ok: true,
        json: async () => {
          const requested = JSON.parse((init?.body as string) ?? '{}').texts as string[] | undefined
          const urls = Object.fromEntries(
            remote
              .filter((r) => !requested || requested.includes(r.text))
              .map((r) => [r.text, `https://s3.example/get/${r.text}`])
          )
          return { urls }
        },
      }
    if (url.startsWith('https://s3.example/put')) return { ok: true }
    if (url.startsWith('https://s3.example/get/'))
      return { ok: true, blob: async () => new Blob(['audio-bytes'], { type: 'audio/webm' }) }
    throw new Error(`unexpected fetch: ${key}`)
  }
}

function setOnline(online: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true })
}

describe('voice-sync', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    __resetSyncGuardForTests()
    setOnline(true)
    getSession.mockResolvedValue({ user: { email: 't@example.com' } })
    getUserByEmail.mockResolvedValue({ id: 'u1' })
    getAllRecordings.mockResolvedValue([])
    getDueSyncOps.mockResolvedValue([])
    getRecording.mockImplementation(async (text: string) => localRec({ text }))
    fetchMock.mockImplementation(happyFetch())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', fetchMock)
  })

  describe('syncNow', () => {
    it('skips overlapping sync passes', async () => {
      getSession.mockImplementation(() => new Promise(() => {}))
      const first = syncNow()
      await syncNow()
      expect(getSession).toHaveBeenCalledTimes(1)
      expect(first).toBeInstanceOf(Promise)
      __resetSyncGuardForTests()
    })

    it('skips when offline', async () => {
      setOnline(false)
      await syncNow()
      expect(getSession).not.toHaveBeenCalled()
    })

    it('works when navigator is undefined (SSR)', async () => {
      vi.stubGlobal('navigator', undefined)
      getAllRecordings.mockResolvedValue([])
      await syncNow()
      expect(getSession).toHaveBeenCalled()
    })

    it('skips when not signed in', async () => {
      getSession.mockResolvedValue(null)
      await syncNow()
      expect(getUserByEmail).not.toHaveBeenCalled()
      getSession.mockResolvedValue({ user: {} })
      await syncNow()
      expect(getUserByEmail).not.toHaveBeenCalled()
    })

    it('skips when the user lookup fails', async () => {
      getSession.mockRejectedValue(new Error('nope'))
      await syncNow()
      expect(getAllRecordings).not.toHaveBeenCalled()
      getSession.mockResolvedValue({ user: { email: 't@example.com' } })
      getUserByEmail.mockRejectedValue(new Error('nope'))
      await syncNow()
      expect(getAllRecordings).not.toHaveBeenCalled()
    })

    it('accepts an explicit user id', async () => {
      await syncNow({ userId: 'u9' })
      expect(getUserByEmail).not.toHaveBeenCalled()
      expect(getAllRecordings).toHaveBeenCalled()
    })

    it('uploads unsynced locals and stamps the server time', async () => {
      getAllRecordings.mockResolvedValue([localRec()])
      await syncNow()
      expect(markRecordingSynced).toHaveBeenCalledWith('cake', 'u1', 999)
      // The S3 PUT used the recording bytes with its content type.
      const putCall = ((fetchMock as Mock).mock.calls as [string, RequestInit | undefined][]).find(
        ([url]) => url === 'https://s3.example/put'
      )
      expect(putCall![1]!.method).toBe('PUT')
      expect(putCall![1]!.headers).toEqual({ 'Content-Type': 'audio/webm' })
    })

    it('skips synced locals and other teachers’ locals', async () => {
      getAllRecordings.mockResolvedValue([
        localRec({ text: 'synced', syncedAt: 500, userId: 'u1' }),
        localRec({ text: 'theirs', userId: 'u2' }),
      ])
      await syncNow()
      expect(markRecordingSynced).not.toHaveBeenCalled()
      expect(enqueueSyncOp).not.toHaveBeenCalled()
    })

    it('attributes pre-sync locals to the signed-in teacher', async () => {
      getAllRecordings.mockResolvedValue([localRec({ userId: null })])
      await syncNow()
      expect(markRecordingSynced).toHaveBeenCalledWith('cake', 'u1', 999)
    })

    it('reports and skips the pass when the index request fails', async () => {
      fetchMock.mockImplementation(
        happyFetch([], {
          'GET /api/voice-recordings': async () => ({ ok: false, status: 500 }),
        })
      )
      await expect(syncNow()).resolves.toBeUndefined()
      expect(reportError).toHaveBeenCalled()
      expect(getAllRecordings).not.toHaveBeenCalled()
    })

    it('treats a missing recordings list as empty', async () => {
      fetchMock.mockImplementation(
        happyFetch([], {
          'GET /api/voice-recordings': async () => ({ ok: true, json: async () => ({}) }),
        })
      )
      await syncNow()
      expect(getAllRecordings).toHaveBeenCalled()
    })

    it('downloads recordings missing locally', async () => {
      const remote = [remoteItem()]
      fetchMock.mockImplementation(happyFetch(remote))
      await syncNow()
      expect(putRecording).toHaveBeenCalledWith(expect.objectContaining({ text: 'cake', userId: 'u1', syncedAt: 200 }))
      const stored = (putRecording as Mock).mock.calls[0][0]
      expect(stored.audio).toBeInstanceOf(ArrayBuffer)
      expect(stored.recordedAt).toBe(100)
    })

    it('downloads when the cloud version is newer, skips when older', async () => {
      const newer = remoteItem({ updatedAt: 600 })
      const older = remoteItem({ text: 'old', updatedAt: 100 })
      fetchMock.mockImplementation(happyFetch([newer, older]))
      getAllRecordings
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          localRec({ text: 'cake', userId: 'u1', syncedAt: 500 }),
          localRec({ text: 'old', userId: 'u1', syncedAt: 500 }),
        ])
      await syncNow()
      expect(putRecording).toHaveBeenCalledTimes(1)
      expect((putRecording as Mock).mock.calls[0][0].text).toBe('cake')
    })

    it('does not overwrite another teacher’s local copy', async () => {
      fetchMock.mockImplementation(happyFetch([remoteItem()]))
      getAllRecordings.mockResolvedValueOnce([]).mockResolvedValueOnce([localRec({ userId: 'u2', syncedAt: 100 })])
      await syncNow()
      expect(putRecording).not.toHaveBeenCalled()
    })

    it('propagates deletes: synced local gone from cloud is deleted locally', async () => {
      fetchMock.mockImplementation(happyFetch([]))
      getAllRecordings
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          localRec({ text: 'gone', userId: 'u1', syncedAt: 500 }),
          localRec({ text: 'unsynced', userId: null, syncedAt: null }),
          localRec({ text: 'theirs', userId: 'u2', syncedAt: 500 }),
        ])
      await syncNow()
      expect(deleteRecording).toHaveBeenCalledTimes(1)
      expect(deleteRecording).toHaveBeenCalledWith('gone')
    })

    it('stops uploading when the quota is full', async () => {
      fetchMock.mockImplementation(
        happyFetch([], {
          'POST /api/voice-recordings': async () => ({ ok: false, status: 413 }),
        })
      )
      getAllRecordings.mockResolvedValue([localRec({ text: 'a' }), localRec({ text: 'b' })])
      await syncNow()
      // Only the first upload was attempted; the second was skipped.
      const posts = ((fetchMock as Mock).mock.calls as [string, RequestInit | undefined][]).filter(
        ([url, init]) => url === '/api/voice-recordings' && init?.method === 'POST'
      )
      expect(posts).toHaveLength(1)
      expect(enqueueSyncOp).not.toHaveBeenCalled()
      expect(reportError).toHaveBeenCalled()
    })

    it('enqueues failed uploads and keeps going', async () => {
      fetchMock.mockImplementation(
        happyFetch([], {
          'POST /api/voice-recordings': async () => {
            throw new Error('network down')
          },
        })
      )
      getAllRecordings.mockResolvedValue([localRec()])
      await syncNow()
      expect(enqueueSyncOp).toHaveBeenCalledWith('upload', 'cake')
      expect(reportError).toHaveBeenCalled()
    })

    it('batches downloads past 100 texts', async () => {
      const remote = Array.from({ length: 101 }, (_, i) => remoteItem({ text: `w${i}` }))
      fetchMock.mockImplementation(happyFetch(remote))
      await syncNow()
      const batchCalls = ((fetchMock as Mock).mock.calls as [string, RequestInit | undefined][]).filter(
        ([url]) => url === '/api/voice-recordings/download-urls'
      )
      expect(batchCalls).toHaveLength(2)
    })

    it('never throws: a dead network resolves quietly', async () => {
      fetchMock.mockRejectedValue(new Error('offline'))
      await expect(syncNow()).resolves.toBeUndefined()
      expect(reportError).toHaveBeenCalled()
      // The guard resets: a later pass still runs.
      fetchMock.mockImplementation(happyFetch())
      await syncNow()
      expect(getAllRecordings).toHaveBeenCalled()
    })

    it('drains the queue: upload success, gone local, delete success', async () => {
      getRecording.mockImplementation(async (text: string) => {
        if (text === 'up') return localRec({ text: 'up' })
        return null
      })
      getDueSyncOps.mockResolvedValue([
        { id: 1, op: 'upload', text: 'up', attempts: 0, nextRetryAt: 0 },
        { id: 2, op: 'upload', text: 'gone', attempts: 0, nextRetryAt: 0 },
        { id: 3, op: 'delete', text: 'del', attempts: 0, nextRetryAt: 0 },
        { id: undefined, op: 'upload', text: 'noid', attempts: 0, nextRetryAt: 0 },
      ])
      await syncNow()
      expect(markRecordingSynced).toHaveBeenCalledWith('up', 'u1', 999)
      expect(deleteSyncOp).toHaveBeenCalledWith(1)
      expect(deleteSyncOp).toHaveBeenCalledWith(2)
      expect(deleteSyncOp).toHaveBeenCalledWith(3)
      const deletes = ((fetchMock as Mock).mock.calls as [string, RequestInit | undefined][]).filter(
        ([url, init]) => url === '/api/voice-recordings' && init?.method === 'DELETE'
      )
      expect(deletes).toHaveLength(1)
    })

    it('reschedules failed queue ops with backoff and drops quota ops', async () => {
      getDueSyncOps.mockResolvedValue([
        { id: 1, op: 'upload', text: 'fail', attempts: 0, nextRetryAt: 0 },
        { id: 2, op: 'upload', text: 'capped', attempts: 99, nextRetryAt: 0 },
        { id: 3, op: 'upload', text: 'quota', attempts: 0, nextRetryAt: 0 },
      ])
      fetchMock.mockImplementation(
        happyFetch([], {
          'POST /api/voice-recordings': async (url: string, init?: RequestInit) => {
            const text = JSON.parse(init?.body as string).text
            if (text === 'quota') return { ok: false, status: 413 }
            throw new Error('network down')
          },
        })
      )
      await syncNow()
      expect(updateSyncOpRetry).toHaveBeenCalledWith(1, 1, expect.any(Number))
      const cappedCall = (updateSyncOpRetry as Mock).mock.calls.find((call) => call[0] === 2)
      const cappedDelay = (cappedCall![2] as number) - Date.now()
      expect(cappedDelay).toBeGreaterThan(59 * 60_000)
      // Quota failures are dropped, not retried.
      expect(deleteSyncOp).toHaveBeenCalledWith(3)
      expect(updateSyncOpRetry).not.toHaveBeenCalledWith(3, expect.anything(), expect.anything())
    })

    it('skips queue uploads already synced by the main pass', async () => {
      getRecording.mockResolvedValue(localRec({ syncedAt: 999, userId: 'u1' }))
      getDueSyncOps.mockResolvedValue([{ id: 1, op: 'upload', text: 'up', attempts: 0, nextRetryAt: 0 }])
      await syncNow()
      expect(deleteSyncOp).toHaveBeenCalledWith(1)
      expect(markRecordingSynced).not.toHaveBeenCalled()
    })
  })

  describe('notifyRecordingSaved', () => {
    const saved = (overrides = {}) => localRec(overrides)

    it('queues when offline', async () => {
      setOnline(false)
      expect(await notifyRecordingSaved(saved())).toBe('queued')
      expect(enqueueSyncOp).toHaveBeenCalledWith('upload', 'cake')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('skips when not signed in', async () => {
      getSession.mockResolvedValue(null)
      expect(await notifyRecordingSaved(saved())).toBe('skipped')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('skips when the user lookup fails', async () => {
      getUserByEmail.mockRejectedValue(new Error('nope'))
      expect(await notifyRecordingSaved(saved())).toBe('skipped')
    })

    it('skips when the session read fails', async () => {
      getSession.mockRejectedValue(new Error('nope'))
      expect(await notifyRecordingSaved(saved())).toBe('skipped')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('skips another teacher’s recording', async () => {
      expect(await notifyRecordingSaved(saved({ userId: 'u2' }))).toBe('skipped')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('uploads immediately and returns synced', async () => {
      expect(await notifyRecordingSaved(saved())).toBe('synced')
      expect(markRecordingSynced).toHaveBeenCalledWith('cake', 'u1', 999)
    })

    it('returns quota-full on 413 without queueing', async () => {
      fetchMock.mockImplementation(
        happyFetch([], {
          'POST /api/voice-recordings': async () => ({ ok: false, status: 413 }),
        })
      )
      expect(await notifyRecordingSaved(saved())).toBe('quota-full')
      expect(enqueueSyncOp).not.toHaveBeenCalled()
    })

    it('queues on upload failure', async () => {
      fetchMock.mockImplementation(
        happyFetch([], {
          'POST /api/voice-recordings': async () => ({ ok: false, status: 500 }),
        })
      )
      expect(await notifyRecordingSaved(saved())).toBe('queued')
      expect(enqueueSyncOp).toHaveBeenCalledWith('upload', 'cake')
    })

    it('queues when the S3 PUT fails', async () => {
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === 'https://s3.example/put') return { ok: false, status: 500 }
        return happyFetch()(url, init)
      })
      expect(await notifyRecordingSaved(saved())).toBe('queued')
    })

    it('queues when the confirm fails', async () => {
      fetchMock.mockImplementation(
        happyFetch([], {
          'PATCH /api/voice-recordings': async () => ({ ok: false, status: 500 }),
        })
      )
      expect(await notifyRecordingSaved(saved())).toBe('queued')
    })

    it('still queues when the queue write itself fails', async () => {
      fetchMock.mockImplementation(
        happyFetch([], {
          'POST /api/voice-recordings': async () => ({ ok: false, status: 500 }),
        })
      )
      enqueueSyncOp.mockRejectedValueOnce(new Error('idb down'))
      expect(await notifyRecordingSaved(saved())).toBe('queued')
    })
  })

  describe('notifyRecordingDeleted', () => {
    it('queues when offline', async () => {
      setOnline(false)
      await notifyRecordingDeleted('cake')
      expect(enqueueSyncOp).toHaveBeenCalledWith('delete', 'cake')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('does nothing when not signed in', async () => {
      getSession.mockResolvedValue(null)
      await notifyRecordingDeleted('cake')
      expect(fetchMock).not.toHaveBeenCalled()
      expect(enqueueSyncOp).not.toHaveBeenCalled()
    })

    it('resolves quietly when the session read fails', async () => {
      getSession.mockRejectedValue(new Error('nope'))
      await expect(notifyRecordingDeleted('cake')).resolves.toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('deletes the cloud copy', async () => {
      await notifyRecordingDeleted('cake')
      const deletes = ((fetchMock as Mock).mock.calls as [string, RequestInit | undefined][]).filter(
        ([url, init]) => url === '/api/voice-recordings' && init?.method === 'DELETE'
      )
      expect(deletes).toHaveLength(1)
      expect(JSON.parse(deletes[0][1]?.body as string)).toEqual({ text: 'cake' })
    })

    it('queues when the delete fails', async () => {
      fetchMock.mockImplementation(
        happyFetch([], {
          'DELETE /api/voice-recordings': async () => ({ ok: false, status: 500 }),
        })
      )
      await notifyRecordingDeleted('cake')
      expect(enqueueSyncOp).toHaveBeenCalledWith('delete', 'cake')
    })

    it('resolves quietly when the queue write fails', async () => {
      fetchMock.mockImplementation(
        happyFetch([], {
          'DELETE /api/voice-recordings': async () => ({ ok: false, status: 500 }),
        })
      )
      enqueueSyncOp.mockRejectedValueOnce(new Error('idb down'))
      await expect(notifyRecordingDeleted('cake')).resolves.toBeUndefined()
    })
  })

  describe('download edge cases', () => {
    it('ignores download urls for unknown texts', async () => {
      const remote = [remoteItem()]
      fetchMock.mockImplementation(
        happyFetch(remote, {
          'POST /api/voice-recordings/download-urls': async () => ({
            ok: true,
            json: async () => ({
              urls: { cake: 'https://s3.example/get/cake', ghost: 'https://s3.example/get/ghost' },
            }),
          }),
        })
      )
      await syncNow()
      expect(putRecording).toHaveBeenCalledTimes(1)
    })

    it('reports and continues when a download fails', async () => {
      const remote = [remoteItem()]
      fetchMock.mockImplementation(
        happyFetch(remote, {
          'POST /api/voice-recordings/download-urls': async () => ({ ok: false, status: 500 }),
        })
      )
      await expect(syncNow()).resolves.toBeUndefined()
      expect(reportError).toHaveBeenCalled()
      expect(putRecording).not.toHaveBeenCalled()
    })

    it('reports when the audio fetch fails', async () => {
      const remote = [remoteItem()]
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.startsWith('https://s3.example/get/')) return { ok: false, status: 403 }
        return happyFetch(remote)(url, init)
      })
      await expect(syncNow()).resolves.toBeUndefined()
      expect(reportError).toHaveBeenCalled()
    })
  })

  it('exports the quota error type', () => {
    expect(new QuotaExceededError().name).toBe('QuotaExceededError')
  })
})
