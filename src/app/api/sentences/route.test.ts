import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, dynamic } from './route'
import { generatedSentencesFor } from '@/lib/sentence-bank'

vi.mock('@/lib/sentence-bank', () => ({
  generatedSentencesFor: vi.fn(),
}))

const sentencesMock = vi.mocked(generatedSentencesFor)

function request(word: string | null) {
  const url = word === null ? 'https://app.test/api/sentences' : `https://app.test/api/sentences?word=${word}`
  return new Request(url)
}

beforeEach(() => {
  sentencesMock.mockReset()
})

describe('GET /api/sentences', () => {
  it('is force-dynamic so the bank file is read fresh per deploy', () => {
    expect(dynamic).toBe('force-dynamic')
  })

  it('returns sentences for a bank word', async () => {
    sentencesMock.mockResolvedValue(['The lemur sat in the tree.', 'We saw a lemur.'])
    const res = await GET(request('lemur'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sentences: ['The lemur sat in the tree.', 'We saw a lemur.'] })
    expect(sentencesMock).toHaveBeenCalledWith('lemur')
  })

  it('lowercases and trims the word', async () => {
    sentencesMock.mockResolvedValue(['The lemur sat in the tree.'])
    await GET(request('  LEMUR '))
    expect(sentencesMock).toHaveBeenCalledWith('lemur')
  })

  it('caps the response at 3 sentences', async () => {
    sentencesMock.mockResolvedValue(['a.', 'b.', 'c.', 'd.', 'e.'])
    const res = await GET(request('x'))
    expect(await res.json()).toEqual({ sentences: ['a.', 'b.', 'c.'] })
  })

  it('returns 404 when the bank has no entry', async () => {
    sentencesMock.mockResolvedValue([])
    const res = await GET(request('xyzzy'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when the word is missing', async () => {
    const res = await GET(request(null))
    expect(res.status).toBe(400)
  })

  it('returns 400 when the word is blank', async () => {
    const res = await GET(request('   '))
    expect(res.status).toBe(400)
    expect(sentencesMock).not.toHaveBeenCalled()
  })
})
