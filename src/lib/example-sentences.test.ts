import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { FALLBACK_SENTENCES } from '@/data/example-sentences'
import { fetchExampleSentences as fetchExampleSentencesStatic } from './example-sentences'

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

  /**
   * Stub fetch so /api/sentences misses by default (falling through to the
   * dictionary API, preserving the old single-fetch test behavior), while
   * the dictionary API uses `dictionaryImpl`. Pass `bankImpl` to control
   * the bank tier per test.
   */
  function dispatchFetch(
    dictionaryImpl: (url: string, opts?: unknown) => unknown,
    bankImpl: (url: string) => unknown = () => Promise.resolve({ ok: false })
  ) {
    return vi.fn((url: string, opts?: unknown) =>
      String(url).startsWith('/api/sentences') ? bankImpl(url) : dictionaryImpl(url)
    )
  }

  it('returns API sentences that pass the filters, marked as API', async () => {
    const fetchMock = dispatchFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(apiResponse(['We saw a quokka at the zoo.', 'A quokka without a tail', undefined])),
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('quokka')
    // 'A quokka without a tail' has no terminal punctuation, so it is filtered.
    expect(result).toEqual({ sentences: ['We saw a quokka at the zoo.'], source: 'api' })
  })

  it('caps results at 3 and dedupes', async () => {
    const fetchMock = dispatchFetch(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            apiResponse([
              'I see a quokka.',
              'You see a quokka.',
              'We see a quokka.',
              'They see a quokka.',
              'I see a quokka.',
            ])
          ),
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('quokka')
    expect(result.sentences).toHaveLength(3)
    expect(result.source).toBe('api')
  })

  it('prefers our own dictionary over the API and never fetches for bank words', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse(['We baked a cake for the party.'])),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('cake')
    expect(result.sentences.length).toBeGreaterThan(0)
    expect(result.sentences[0]).toContain('cake')
    expect(result.source).toBe('local')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns an empty local result on API failure for words outside the bank', async () => {
    vi.stubGlobal(
      'fetch',
      dispatchFetch(() => Promise.reject(new Error('network down')))
    )
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('quokka')
    expect(result).toEqual({ sentences: [], source: 'local' })
  })

  it('serves bank words from cache without fetching on repeat lookups', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const first = await fetchExampleSentences('rain')
    const second = await fetchExampleSentences('rain')
    expect(first).toEqual(second)
    expect(second.source).toBe('local')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not report network failures to Sentry', async () => {
    vi.stubGlobal(
      'fetch',
      dispatchFetch(() => Promise.reject(new TypeError('Load failed')))
    )
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('quokka')
    expect(result).toEqual({ sentences: [], source: 'local' })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('reports response processing errors to Sentry', async () => {
    const fetchMock = dispatchFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('quokka')
    expect(result).toEqual({ sentences: [], source: 'local' })
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('returns an empty local result for unknown words with no fallback', async () => {
    vi.stubGlobal(
      'fetch',
      dispatchFetch(() => Promise.resolve({ ok: false }))
    )
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
    const fetchMock = dispatchFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(apiResponse(['We saw a quokka.'])),
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    await fetchExampleSentences('quokka')
    await fetchExampleSentences('quokka')
    // One lookup hits the bank API (miss) and the dictionary API; the
    // repeat lookup is served from cache with no fetches at all.
    expect(fetchMock).toHaveBeenCalledTimes(2)
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
    const fetchMock = dispatchFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(apiResponse(['We saw a quokka.'])),
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    // 'quokka' has no stored entry and no bank entry; readStorageCache still
    // validates every malformed entry in the stored object on the way through.
    const result = await fetchExampleSentences('quokka')
    expect(result).toEqual({ sentences: ['We saw a quokka.'], source: 'api' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['null', 'null JSON'],
    ['42', 'non-object JSON'],
    ['[1,2,3]', 'array JSON'],
  ])('ignores localStorage containing %s (%s)', async (stored) => {
    window.localStorage.setItem('patternspell-sentences-v2', stored)
    const fetchMock = dispatchFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(apiResponse(['We saw a quokka.'])),
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('quokka')).toEqual({ sentences: ['We saw a quokka.'], source: 'api' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('aborts the API fetch when it times out, with no retry', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn((url: string, opts?: unknown) => {
        if (String(url).startsWith('/api/sentences')) return Promise.resolve({ ok: false })
        const { signal } = opts as { signal: AbortSignal }
        return new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Fetch aborted', 'AbortError')))
        })
      })
      vi.stubGlobal('fetch', fetchMock)
      // The dynamic load() pattern confuses v8 coverage attribution for the
      // abort callback, so this test uses the statically imported module
      // with a unique word to stay isolated from the per-test module cache.
      const promise = fetchExampleSentencesStatic('quokka-timeout-zzz')
      // The single dictionary attempt times out at 3s; there is no retry.
      // The bank API miss resolves immediately before it.
      await vi.advanceTimersByTimeAsync(3000)
      const result = await promise
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ sentences: [], source: 'local' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retry on network failure', async () => {
    const fetchMock = dispatchFetch(() => Promise.reject(new TypeError('Load failed')))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('quokka')
    expect(result).toEqual({ sentences: [], source: 'local' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache empty results, so a transient miss can retry', async () => {
    const fetchMock = dispatchFetch(() => Promise.resolve({ ok: false }))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('xyzzy')).toEqual({ sentences: [], source: 'local' })
    expect(await fetchExampleSentences('xyzzy')).toEqual({ sentences: [], source: 'local' })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('returns an empty local result when the API returns non-array JSON', async () => {
    const fetchMock = dispatchFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ title: 'No Definitions Found' }),
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('xyzzy')).toEqual({ sentences: [], source: 'local' })
  })

  it('handles API entries missing meanings or definitions', async () => {
    const fetchMock = dispatchFetch(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([{}, { meanings: [{ definitions: [{ example: 'We saw a quokka.' }] }] }, { meanings: [{}] }]),
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('quokka')).toEqual({ sentences: ['We saw a quokka.'], source: 'api' })
  })

  it('handles corrupt localStorage gracefully', async () => {
    window.localStorage.setItem('patternspell-sentences-v2', 'not-json{')
    const fetchMock = dispatchFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(apiResponse(['We saw a quokka.'])),
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('quokka')
    expect(result).toEqual({ sentences: ['We saw a quokka.'], source: 'api' })
  })

  it('handles localStorage write errors gracefully', async () => {
    const setItem = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const fetchMock = dispatchFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(apiResponse(['We saw a quokka.'])),
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('quokka')
    expect(result).toEqual({ sentences: ['We saw a quokka.'], source: 'api' })
    setItem.mockRestore()
  })

  it('serves bank API sentences as local without touching the dictionary API', async () => {
    const fetchMock = dispatchFetch(
      () => Promise.resolve({ ok: true, json: () => Promise.resolve(apiResponse(['We saw a quokka.'])) }),
      () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ sentences: ['The lemur sat in the tree.', 'We saw a lemur.'] }),
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('lemur')
    expect(result).toEqual({ sentences: ['The lemur sat in the tree.', 'We saw a lemur.'], source: 'local' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/sentences?word=lemur')
  })

  it('falls through to the dictionary API when the bank API fails at the network level', async () => {
    const fetchMock = dispatchFetch(
      () => Promise.resolve({ ok: true, json: () => Promise.resolve(apiResponse(['We saw a quokka.'])) }),
      () => Promise.reject(new Error('bank down'))
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('quokka')
    expect(result).toEqual({ sentences: ['We saw a quokka.'], source: 'api' })
  })

  it('falls through when the bank API response has no usable sentences', async () => {
    const fetchMock = dispatchFetch(
      () => Promise.resolve({ ok: true, json: () => Promise.resolve(apiResponse(['We saw a quokka.'])) }),
      () => Promise.resolve({ ok: true, json: () => Promise.resolve({ sentences: ['not about the word'] }) })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('quokka')
    expect(result).toEqual({ sentences: ['We saw a quokka.'], source: 'api' })
  })

  it('filters non-string and unusable bank API sentences', async () => {
    const fetchMock = dispatchFetch(
      () => Promise.resolve({ ok: false }),
      () =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              sentences: ['The lemur sat in the tree.', 42, 'no terminal punctuation', `${'x'.repeat(140)}.`, null],
            }),
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('lemur')
    expect(result).toEqual({ sentences: ['The lemur sat in the tree.'], source: 'local' })
  })

  it.each([[`{ "sentences": "nope" }`], [`{}`], [`[1,2,3]`], [`null`]])(
    'falls through on malformed bank API JSON: %s',
    async (body) => {
      const fetchMock = dispatchFetch(
        () => Promise.resolve({ ok: true, json: () => Promise.resolve(apiResponse(['We saw a quokka.'])) }),
        () => Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(body)) })
      )
      vi.stubGlobal('fetch', fetchMock)
      const { fetchExampleSentences } = await load()
      const result = await fetchExampleSentences('quokka')
      expect(result).toEqual({ sentences: ['We saw a quokka.'], source: 'api' })
    }
  )

  it('falls through when the bank API JSON cannot be parsed', async () => {
    const fetchMock = dispatchFetch(
      () => Promise.resolve({ ok: true, json: () => Promise.resolve(apiResponse(['We saw a quokka.'])) }),
      () => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('bad json')) })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const result = await fetchExampleSentences('quokka')
    expect(result).toEqual({ sentences: ['We saw a quokka.'], source: 'api' })
  })
})
