import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FALLBACK_SENTENCES } from '@/data/example-sentences'

describe('FALLBACK_SENTENCES bank', () => {
  it('covers at least 50 common words', () => {
    expect(Object.keys(FALLBACK_SENTENCES).length).toBeGreaterThanOrEqual(50)
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

  it('returns API sentences that pass the filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(apiResponse(['We baked a cake for the party.', 'A cake without frosting', undefined])),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const sentences = await fetchExampleSentences('cake')
    // 'A cake without frosting' has no terminal punctuation, so it is filtered.
    expect(sentences).toEqual(['We baked a cake for the party.'])
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
    const sentences = await fetchExampleSentences('cake')
    expect(sentences).toHaveLength(3)
  })

  it('falls back to the local bank when the API has no usable sentences', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse([undefined])),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    const sentences = await fetchExampleSentences('cake')
    expect(sentences.length).toBeGreaterThan(0)
    expect(sentences[0]).toContain('cake')
  })

  it('falls back to the local bank on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const { fetchExampleSentences } = await load()
    const sentences = await fetchExampleSentences('rain')
    expect(sentences.length).toBeGreaterThan(0)
  })

  it('returns [] for unknown words with no fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('xyzzy')).toEqual([])
  })

  it('returns [] for empty input without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { fetchExampleSentences } = await load()
    expect(await fetchExampleSentences('   ')).toEqual([])
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
})
