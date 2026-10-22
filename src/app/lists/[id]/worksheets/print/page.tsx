import type { Metadata } from 'next'
import WorksheetsPrintPage from '@/components/worksheets/WorksheetsPrintPage'
import { WORKSHEET_TYPES, type WorksheetType } from '@/lib/worksheets'

export const metadata: Metadata = {
  title: 'Print worksheets | PatternSpell',
  description: 'Print the selected worksheets and their answer keys for a spelling list.',
}

/**
 * Print route for worksheets. The ?types= query param carries the selected
 * worksheet types (comma-separated); unknown or missing values fall back to
 * every type, so a shared or bookmarked URL still prints something sensible.
 * The optional ?testDate=YYYY-MM-DD param carries the teacher-typed spelling
 * test date for the family note (issue #518); anything that is not a
 * YYYY-MM-DD shape is ignored here, and the note itself only renders real
 * calendar dates.
 */
export default async function PrintWorksheetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ types?: string; testDate?: string }>
}) {
  const { id } = await params
  const { types, testDate } = await searchParams
  const requested = (types ?? '').split(',').map((t) => t.trim()) as WorksheetType[]
  const selected = requested.filter((t): t is WorksheetType => (WORKSHEET_TYPES as readonly string[]).includes(t))
  const testDateParam = testDate && /^\d{4}-\d{2}-\d{2}$/.test(testDate) ? testDate : undefined
  return (
    <WorksheetsPrintPage
      listId={id}
      selectedTypes={selected.length > 0 ? selected : [...WORKSHEET_TYPES]}
      testDate={testDateParam}
    />
  )
}
