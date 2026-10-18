import type { Metadata } from 'next'
import WorksheetPicker from '@/components/worksheets/WorksheetPicker'

export const metadata: Metadata = {
  title: 'Printable worksheets | PatternSpell',
  description:
    'Pick worksheet types for a spelling list and print them with answer keys: spelling list, cut and sort, fill in the blank, word search, crossword, reading, and a parent note.',
}

/** Worksheet picker route: choose which worksheets to print for one list. */
export default async function WorksheetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WorksheetPicker listId={id} />
}
