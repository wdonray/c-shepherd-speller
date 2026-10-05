import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  exportSpellingData,
  importSpellingData,
  hasSpellingData,
  getSpellingDataCount,
  isDuplicateItem,
  type SpellingData,
} from './spelling-utils'

const sample: SpellingData = { words: ['cat', 'dog'], sounds: ['sh'], spelling: ['tion'] }

// Deterministic FileReader: the implementation under test only uses
// readAsText + onload/onerror, so drive it directly.
class MockFileReader {
  onload: ((event: { target: { result: string | null } }) => void) | null = null
  onerror: (() => void) | null = null
  private outcome: { ok: boolean; content: string }

  constructor(outcome: { ok: boolean; content: string } = { ok: true, content: '' }) {
    this.outcome = outcome
  }

  readAsText() {
    queueMicrotask(() => {
      if (this.outcome.ok) {
        this.onload?.({ target: { result: this.outcome.content } })
      } else {
        this.onerror?.()
      }
    })
  }
}

describe('exportSpellingData', () => {
  const createObjectURL = vi.fn(() => 'blob:mock-url')
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('triggers a download of the JSON data with the given filename', () => {
    const click = vi.fn()
    const appendChild = vi.spyOn(document.body, 'appendChild')
    const removeChild = vi.spyOn(document.body, 'removeChild')
    const anchor = document.createElement('a')
    const createElement = vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor)
    vi.spyOn(anchor, 'click').mockImplementation(click)

    exportSpellingData(sample, 'my-list.json')

    expect(createObjectURL).toHaveBeenCalledOnce()
    const calls = createObjectURL.mock.calls as unknown[][]
    expect(calls.length).toBe(1)
    const blob = calls[0][0] as Blob
    expect(blob.type).toBe('application/json')
    expect(anchor.href).toBe('blob:mock-url')
    expect(anchor.download).toBe('my-list.json')
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    appendChild.mockRestore()
    removeChild.mockRestore()
    createElement.mockRestore()
  })
})

describe('importSpellingData', () => {
  function mockReader(content: string, ok = true) {
    vi.stubGlobal(
      'FileReader',
      class extends MockFileReader {
        constructor() {
          super({ ok, content })
        }
      }
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves valid spelling data', async () => {
    mockReader(JSON.stringify(sample))
    const file = new File(['ignored'], 'list.json', { type: 'application/json' })
    await expect(importSpellingData(file)).resolves.toEqual(sample)
  })

  it('rejects when the JSON has the wrong shape', async () => {
    mockReader(JSON.stringify({ words: ['cat'], sounds: 'not-an-array', spelling: [] }))
    const file = new File(['ignored'], 'list.json')
    await expect(importSpellingData(file)).rejects.toThrow('Invalid spelling data format')
  })

  it('rejects when a list contains non-strings', async () => {
    mockReader(JSON.stringify({ words: [42], sounds: [], spelling: [] }))
    const file = new File(['ignored'], 'list.json')
    await expect(importSpellingData(file)).rejects.toThrow('Invalid spelling data format')
  })

  it('rejects when the file is not valid JSON', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockReader('this is not json{{{')
    const file = new File(['ignored'], 'list.json')
    await expect(importSpellingData(file)).rejects.toThrow('Failed to parse JSON file')
    consoleError.mockRestore()
  })

  it('rejects when the file cannot be read', async () => {
    mockReader('', false)
    const file = new File(['ignored'], 'list.json')
    await expect(importSpellingData(file)).rejects.toThrow('Failed to read file')
  })
})

describe('hasSpellingData', () => {
  it('is false for empty data', () => {
    expect(hasSpellingData({ words: [], sounds: [], spelling: [] })).toBe(false)
  })

  it('is true when any list has items', () => {
    expect(hasSpellingData({ words: ['a'], sounds: [], spelling: [] })).toBe(true)
    expect(hasSpellingData({ words: [], sounds: ['b'], spelling: [] })).toBe(true)
    expect(hasSpellingData({ words: [], sounds: [], spelling: ['c'] })).toBe(true)
  })
})

describe('getSpellingDataCount', () => {
  it('sums all lists', () => {
    expect(getSpellingDataCount(sample)).toBe(4)
    expect(getSpellingDataCount({ words: [], sounds: [], spelling: [] })).toBe(0)
  })
})

describe('isDuplicateItem', () => {
  it('finds exact duplicates', () => {
    expect(isDuplicateItem(['cat', 'dog'], 'cat')).toBe(true)
    expect(isDuplicateItem(['cat', 'dog'], 'bat')).toBe(false)
  })

  it('compares case-insensitively and trimmed', () => {
    expect(isDuplicateItem(['cat'], '  CAT ')).toBe(true)
    expect(isDuplicateItem(['Cat'], 'cAt')).toBe(true)
  })

  it('excludes the item being edited', () => {
    expect(isDuplicateItem(['cat', 'dog'], 'cat', 0)).toBe(false)
    expect(isDuplicateItem(['cat', 'dog'], 'dog', 0)).toBe(true)
  })

  it('returns false for blank values and empty lists', () => {
    expect(isDuplicateItem(['cat'], '   ')).toBe(false)
    expect(isDuplicateItem([], 'cat')).toBe(false)
  })
})
