import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import WorksheetPicker from '@/components/worksheets/WorksheetPicker'
import { getPrebuiltWeek } from '@/lib/prebuilt-lists'

export const metadata: Metadata = {
  title: 'Printable worksheets | PatternSpell',
  description:
    'Pick worksheet types for a ready-made spelling list and print them with answer keys: spelling list, cut and sort, fill in the blank, word search, crossword, reading, and a parent note.',
}

/**
 * Worksheet picker for a prebuilt curriculum week (issue #463). The week is
 * read-only: worksheets print from the bundled data and nothing is saved.
 */
export default async function PrebuiltWorksheetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const week = getPrebuiltWeek(id)
  if (!week) notFound()

  return <WorksheetPicker prebuiltWeek={week} />
}
