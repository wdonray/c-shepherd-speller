import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadGeneratedBank, generatedSentencesFor, resetBankCacheForTesting } from './sentence-bank'

const BANK = { lemur: ['The lemur sat in the tree.', 'We saw a lemur at the zoo.'] }

function readOk() {
  return vi.fn().mockResolvedValue(JSON.stringify(BANK))
}

beforeEach(() => {
  resetBankCacheForTesting()
})

describe('loadGeneratedBank', () => {
  it('parses the bank file', async () => {
    const bank = await loadGeneratedBank(readOk())
    expect(bank).toEqual(BANK)
  })

  it('reads the file once and serves later loads from memory', async () => {
    const read = readOk()
    await loadGeneratedBank(read)
    await loadGeneratedBank(read)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('resolves to an empty bank when the file is missing', async () => {
    const read = vi.fn().mockRejectedValue(new Error('ENOENT'))
    expect(await loadGeneratedBank(read)).toEqual({})
  })

  it('resolves to an empty bank on invalid JSON', async () => {
    const read = vi.fn().mockResolvedValue('not-json{')
    expect(await loadGeneratedBank(read)).toEqual({})
  })

  it('resolves to an empty bank when the JSON is an array', async () => {
    const read = vi.fn().mockResolvedValue('["lemur"]')
    expect(await loadGeneratedBank(read)).toEqual({})
  })

  it('resolves to an empty bank when the JSON is null', async () => {
    const read = vi.fn().mockResolvedValue('null')
    expect(await loadGeneratedBank(read)).toEqual({})
  })
})

describe('generatedSentencesFor', () => {
  it('returns sentences for a known word', async () => {
    expect(await generatedSentencesFor('lemur', readOk())).toEqual(BANK.lemur)
  })

  it('matches words case-insensitively', async () => {
    expect(await generatedSentencesFor('LEMUR', readOk())).toEqual(BANK.lemur)
  })

  it('returns an empty list for an unknown word', async () => {
    expect(await generatedSentencesFor('xyzzy', readOk())).toEqual([])
  })

  it('returns an empty list when the bank cannot be read', async () => {
    const read = vi.fn().mockRejectedValue(new Error('ENOENT'))
    expect(await generatedSentencesFor('lemur', read)).toEqual([])
  })
})
