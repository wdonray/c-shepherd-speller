import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { FALLBACK_SENTENCES } from '@/data/example-sentences'

vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn((cb: (scope: unknown) => void) => cb({ setTag: vi.fn(), setExtras: vi.fn() })),
  captureException: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(Sentry.captureException).mockClear()
})

describe('FALLBACK_SENTENCES bank', () => {
  it('covers at least 400 common words', () => {
    expect(Object.keys(FALLBACK_SENTENCES).length).toBeGreaterThanOrEqual(400)
  })

  it('uses lowercase word keys', () => {
    for (const word of Object.keys(FALLBACK_SENTENCES)) {
      expect(word).toBe(word.toLowerCase())
    }
  })

  it('has usable sentences: mention the word, short, terminal punctuation', async () => {
    vi.resetModules()
    const { isUsableSentence } = await import('./example-sentences')
    for (const [word, sentences] of Object.entries(FALLBACK_SENTENCES)) {
      expect(sentences.length).toBeGreaterThan(0)
      for (const s of sentences) {
        expect(isUsableSentence(word, s), `"${s}" for "${word}"`).toBe(true)
      }
    }
  })
})

describe('isUsableSentence', () => {
  async function load() {
    vi.resetModules()
    return await import('./example-sentences')
  }

  it('accepts a good sentence', async () => {
    const { isUsableSentence } = await load()
    expect(isUsableSentence('cake', 'We baked a cake.')).toBe(true)
  })

  it('rejects sentences not mentioning the word', async () => {
    const { isUsableSentence } = await load()
    expect(isUsableSentence('cake', 'We baked a pie.')).toBe(false)
  })

  it('rejects sentences over 140 chars', async () => {
    const { isUsableSentence } = await load()
    expect(isUsableSentence('cake', 'We baked a cake. ' + 'x'.repeat(140))).toBe(false)
  })

  it('rejects sentences without terminal punctuation', async () => {
    const { isUsableSentence } = await load()
    expect(isUsableSentence('cake', 'We baked a cake')).toBe(false)
  })

  it('matches the word case-insensitively', async () => {
    const { isUsableSentence } = await load()
    expect(isUsableSentence('cake', 'We baked a CAKE.')).toBe(true)
  })
})

describe('fetchExampleSentences', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function load() {
    vi.resetModules()
    return await import('./example-sentences')
  }

  function apiResponse(examples: (string | undefined)[]) {
    return [
      {
        meanings: [
          {
            definitions: examples.map((example) => ({ example })),
          },
        ],
      },
    ]
  }

  it('returns API sentences that pass the filters, marked as API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(apiResponse(['We baked a cake for the party.', 'A cake without frosting', undefined])),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('cake')
    // 'A cake without frosting' has no terminal punctuation, so it is filtered.
    expect(result).toEqual({ sentences: ['We baked a cake for the party.'], source: 'api' })
  })

  it('caps results at 3 and dedupes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(
          apiResponse(['I see a cake.', 'You see a cake.', 'We see a cake.', 'They see a cake.', 'I see a cake.'])
        ),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('cake')
    expect(result.sentences).toHaveLength(3)
    expect(result.source).toBe('api')
  })

  it('falls back to our own dictionary when the API has no usable sentences', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse([undefined])),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('cake')
    expect(result.sentences.length).toBeGreaterThan(0)
    expect(result.sentences[0]).toContain('cake')
    expect(result.source).toBe('local')
  })

  it('falls back to our own dictionary on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('rain')
    expect(result.sentences.length).toBeGreaterThan(0)
    expect(result.source).toBe('local')
  })

  it('caches the fallback source so a repeat lookup does not fetch', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const first = await fetchExampleSentences('rain')
    const second = await fetchExampleSentences('rain')
    expect(first).toEqual(second)
    expect(second.source).toBe('local')
    // First call made its two attempts; the second call was served from cache.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not report network failures to Sentry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Load failed')))
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('rain')
    expect(result.sentences.length).toBeGreaterThan(0)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('reports response processing errors to Sentry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('rain')
    expect(result.sentences.length).toBeGreaterThan(0)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('returns an empty local result for unknown words with no fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('xyzzy')).toEqual({ sentences: [], source: 'local' })
  })

  it('returns an empty local result for empty input without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('   ')).toEqual({ sentences: [], source: 'local' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caches results so the API is hit once per word', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse(['We baked a cake.'])),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    await fetchExampleSentences('cake')
    await fetchExampleSentences('cake')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('serves valid stored sentences with their source without fetching', async () => {
    window.localStorage.setItem(
      'patternspell-sentences-v2',
      JSON.stringify({
        cake: { sentences: ['We baked a cake.'], source: 'api' },
        rain: { sentences: ['The rain fell all day.'], source: 'local' },
      })
    )
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('cake')).toEqual({ sentences: ['We baked a cake.'], source: 'api' })
    expect(await fetchExampleSentences('rain')).toEqual({ sentences: ['The rain fell all day.'], source: 'local' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores malformed stored entries and refetches', async () => {
    window.localStorage.setItem(
      'patternspell-sentences-v2',
      JSON.stringify({
        nul: null,
        oldarray: ['We baked a cake.'],
        badsource: { sentences: ['We baked a cake.'], source: 'bogus' },
        nosource: { sentences: ['We baked a cake.'] },
        empty: { sentences: [], source: 'api' },
        notstrings: { sentences: [42], source: 'api' },
        astring: 'hello',
      })
    )
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse(['We baked a cake.'])),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    // 'cake' has no stored entry; readStorageCache still validates every
    // malformed entry in the stored object on the way through.
    const result = await fetchExampleSentences('cake')
    expect(result).toEqual({ sentences: ['We baked a cake.'], source: 'api' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['null', 'null JSON'],
    ['42', 'non-object JSON'],
    ['[1,2,3]', 'array JSON'],
  ])('ignores localStorage containing %s (%s)', async (stored) => {
    window.localStorage.setItem('patternspell-sentences-v2', stored)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse(['We baked a cake.'])),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('cake')).toEqual({ sentences: ['We baked a cake.'], source: 'api' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aborts the API fetch when it times out, then retries once', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn(
        (_url: string, opts: { signal: AbortSignal }) =>
          new Promise<never>((_resolve, reject) => {
            opts.signal.addEventListener('abort', () => reject(new DOMException('Fetch aborted', 'AbortError')))
          })
      )
      vi.stubGlobal('fetch', fetchMock)
      const { fetchExampleSentences } = await load()
      const promise = fetchExampleSentences('cake')
      // Attempt 1 times out at 10s, 1s backoff, attempt 2 times out at 10s.
      await vi.advanceTimersByTimeAsync(21000)
      const result = await promise
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.sentences.length).toBeGreaterThan(0)
      expect(result.sentences[0]).toContain('cake')
      expect(result.source).toBe('local')
    } finally {
      vi.useRealTimers()
    }
  })

  it('retries once on network failure before falling back', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(apiResponse(['We baked a cake.'])) })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('cake')
    expect(result).toEqual({ sentences: ['We baked a cake.'], source: 'api' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache empty results, so a transient miss can retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('xyzzy')).toEqual({ sentences: [], source: 'local' })
    expect(await fetchExampleSentences('xyzzy')).toEqual({ sentences: [], source: 'local' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns an empty local result when the API returns non-array JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: 'No Definitions Found' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('xyzzy')).toEqual({ sentences: [], source: 'local' })
  })

  it('handles API entries missing meanings or definitions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([{}, { meanings: [{ definitions: [{ example: 'We baked a cake.' }] }] }, { meanings: [{}] }]),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('cake')).toEqual({ sentences: ['We baked a cake.'], source: 'api' })
  })

  it('handles corrupt localStorage gracefully', async () => {
    window.localStorage.setItem('patternspell-sentences-v2', 'not-json{')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse(['We baked a cake.'])),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('cake')
    expect(result).toEqual({ sentences: ['We baked a cake.'], source: 'api' })
  })

  it('handles localStorage write errors gracefully', async () => {
    const setItem = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse(['We baked a cake.'])),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('cake')
    expect(result).toEqual({ sentences: ['We baked a cake.'], source: 'api' })
    setItem.mockRestore()
  })
})
