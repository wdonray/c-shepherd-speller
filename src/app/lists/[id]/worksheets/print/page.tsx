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
 */
export default async function PrintWorksheetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ types?: string }>
}) {
  const { id } = await params
  const { types } = await searchParams
  const requested = (types ?? '').split(',').map((t) => t.trim()) as WorksheetType[]
  const selected = requested.filter((t): t is WorksheetType => (WORKSHEET_TYPES as readonly string[]).includes(t))
  return <WorksheetsPrintPage listId={id} selectedTypes={selected.length > 0 ? selected : [...WORKSHEET_TYPES]} />
}
