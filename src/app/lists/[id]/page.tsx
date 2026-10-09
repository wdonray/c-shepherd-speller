import type { Metadata } from 'next'
import ListEditorPage from '@/components/ListEditorPage'

export const metadata: Metadata = {
  title: 'Edit word list | PatternSpell',
  description:
    'Edit a pattern-based spelling list: the target sound, spelling patterns, words, and example sentences. Changes save automatically.',
}

/** Full-page editor for one word list. The list overview lives at /lists. */
export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ListEditorPage listId={id} />
}
