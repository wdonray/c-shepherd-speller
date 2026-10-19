import type { Metadata } from 'next'
import BackBreadcrumb from '@/components/BackBreadcrumb'
import PrebuiltLibraryBrowser from '@/components/PrebuiltLibraryBrowser'

export const metadata: Metadata = {
  title: 'Prebuilt spelling lists | PatternSpell',
  description:
    'Browse 162 weeks of ready-made spelling pattern lists for grades K-5. Preview any week, then make it your own.',
}

/** Browse the prebuilt curriculum library (issue #463, Phase A). */
export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <BackBreadcrumb href="/home" label="Home" />
      <div className="mt-2 space-y-1">
        <h1 className="text-3xl font-bold">Prebuilt spelling lists</h1>
        <p className="text-[15px] text-muted-foreground">
          162 weeks of ready-made spelling pattern lists for grades K through 5. Preview any week to see its patterns
          and words.
        </p>
      </div>
      <div className="mt-6">
        <PrebuiltLibraryBrowser />
      </div>
    </div>
  )
}
