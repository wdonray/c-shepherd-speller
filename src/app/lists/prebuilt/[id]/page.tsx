import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BackBreadcrumb from '@/components/BackBreadcrumb'
import PatternChartDisplay from '@/components/PatternChartDisplay'
import PrebuiltBadge from '@/components/PrebuiltBadge'
import PrebuiltWeekActions from '@/components/PrebuiltWeekActions'
import { getPrebuiltWeek, prebuiltGradeLabel, prebuiltWeekToWordList } from '@/lib/prebuilt-lists'

export const metadata: Metadata = {
  title: 'Ready-made spelling list preview | PatternSpell',
  description: 'Preview a ready-made spelling pattern list. Read-only.',
}

/**
 * Read-only preview of one prebuilt week (issue #463). The chart renders in
 * present mode with no edit callbacks, so there are no lock toggles, rule
 * editors, or video buttons. Copy and pull-patterns actions live in
 * PrebuiltWeekActions; present/practice land in a later phase.
 */
export default async function PrebuiltWeekPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const week = getPrebuiltWeek(id)
  if (!week) notFound()

  const list = prebuiltWeekToWordList(week)
  const totalWords = week.patterns.reduce((sum, p) => sum + p.words.length, 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <BackBreadcrumb href="/lists" label="My Spelling Lists" />
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">{week.title}</h1>
          <PrebuiltBadge />
        </div>
        <p className="text-[15px] text-muted-foreground">
          {prebuiltGradeLabel(week.grade)}: {week.patterns.length} patterns, {totalWords} words. This is a read-only
          preview.
        </p>
      </div>
      <div className="mt-4">
        <PrebuiltWeekActions week={week} />
      </div>
      <div className="mt-6">
        <PatternChartDisplay list={list} variant="present" />
      </div>
    </div>
  )
}
