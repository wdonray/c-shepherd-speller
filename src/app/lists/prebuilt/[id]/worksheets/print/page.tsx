import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import WorksheetsPrintPage from '@/components/worksheets/WorksheetsPrintPage'
import { WORKSHEET_TYPES, type WorksheetType } from '@/lib/worksheets'
import { getPrebuiltWeek } from '@/lib/prebuilt-lists'

export const metadata: Metadata = {
  title: 'Print worksheets | PatternSpell',
  description: 'Print the selected worksheets for a ready-made spelling list, with answer keys.',
}

/**
 * Print route for a prebuilt curriculum week's worksheets (issue #463).
 * The ?types= query param carries the selected worksheet types
 * (comma-separated); unknown or missing values fall back to every type.
 * Sentences typed in the gap flow apply to this print job only; the week
 * itself is never modified.
 */
export default async function PrebuiltWorksheetsPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ types?: string }>
}) {
  const { id } = await params
  const { types } = await searchParams
  const week = getPrebuiltWeek(id)
  if (!week) notFound()

  const requested = (types ?? '').split(',').map((t) => t.trim()) as WorksheetType[]
  const selected = requested.filter((t): t is WorksheetType => (WORKSHEET_TYPES as readonly string[]).includes(t))

  return (
    <WorksheetsPrintPage prebuiltWeek={week} selectedTypes={selected.length > 0 ? selected : [...WORKSHEET_TYPES]} />
  )
}
