import { NextResponse } from 'next/server'
import { generatedSentencesFor } from '@/lib/sentence-bank'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sentences?word=<word>
 * Serves example sentences from our generated bank (100k words, two
 * sentences each, kept in src/data/generated-sentences.json). 200 with
 * { sentences } on a hit; 400 for a blank word; 404 on a miss so the
 * client falls through to the next sentence source.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const word = new URL(request.url).searchParams.get('word')?.trim().toLowerCase()
  if (!word) {
    return NextResponse.json({ error: 'missing word' }, { status: 400 })
  }
  const sentences = await generatedSentencesFor(word)
  if (sentences.length === 0) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({ sentences: sentences.slice(0, 3) })
}
