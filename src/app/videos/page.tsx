import type { Metadata } from 'next'
import { Suspense } from 'react'
import BackBreadcrumb from '@/components/BackBreadcrumb'
import SongVideoBrowser from '@/components/SongVideoBrowser'

export const metadata: Metadata = {
  title: 'Song videos | PatternSpell',
  description: 'Browse the full collection of phonics song videos. Search by title, channel, or spelling pattern.',
}

/** Full-page browse of the curated phonics song collection (issue #439). */
export default function VideosPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <BackBreadcrumb href="/home" label="Home" />
      <div className="mt-2 space-y-1">
        <h1 className="text-3xl font-bold">Song videos</h1>
        <p className="text-[15px] text-muted-foreground">
          The full collection of phonics songs for spelling patterns. Pick one to play for the class, or add it to a
          pattern in one of your spelling lists.
        </p>
      </div>
      <div className="mt-6">
        <Suspense>
          <SongVideoBrowser />
        </Suspense>
      </div>
    </div>
  )
}
