'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PATTERN_VIDEOS, getPatternGroups, searchSongVideos, type PatternVideoEntry } from '@/data/pattern-videos'
import { useBlockedVideos } from '@/hooks/useBlockedVideos'
import type { PatternVideo } from '@/models/WordList'
import SongVideoCard from './SongVideoCard'
import PatternVideoModal from './PatternVideoModal'

/** Native select styling matched to the Input component. */
const SELECT_CLASSNAME =
  'flex h-12 w-full rounded-xl border-2 border-line bg-card px-4 py-2 text-base text-ink outline-none transition focus-visible:border-sky-deep focus-visible:ring-[3px] focus-visible:ring-ring/40'

/**
 * The full song-video catalog (issue #439): search plus one plain-language
 * pattern-group dropdown over the whole bank. Play opens the player modal
 * in browse-only mode; signed-in teachers can hide videos from the cards.
 * The grid waits for the hidden-video list when signed in so the card
 * count never changes after first paint (issue #443).
 */
export default function SongVideoBrowser() {
  const searchParams = useSearchParams()
  const { status } = useSession()
  const { blockedVideoIds, blockVideo, userId, isLoaded: blockedLoaded } = useBlockedVideos()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [group, setGroup] = useState<string | null>(null)
  const [playing, setPlaying] = useState<{ videos: PatternVideo[]; startId: string } | null>(null)

  const groups = getPatternGroups()

  const entries = useMemo(() => {
    const visible = PATTERN_VIDEOS.filter((entry) => !blockedVideoIds.has(entry.videoId))
    const searched = query.trim()
      ? searchSongVideos(query).filter((entry) => !blockedVideoIds.has(entry.videoId))
      : visible
    const groupPatterns = new Set(groups.filter((g) => g.label === group).flatMap((g) => g.patterns))
    if (groupPatterns.size === 0) return searched
    return searched.filter((entry) => entry.patterns.some((pattern) => groupPatterns.has(pattern)))
  }, [query, group, blockedVideoIds, groups])

  // Hold the grid until the session AND the hidden-video list resolve: the
  // hidden list changes the card count, so painting the grid first and
  // filtering after would shift the page (issue #443). Signed-out visitors
  // never wait on the hidden list.
  const loading = status === 'loading' || (status === 'authenticated' && !blockedLoaded)
  const hasFilters = query.trim() !== '' || group !== null

  const playEntry = (entry: PatternVideoEntry) => {
    setPlaying({
      videos: entries.map((e) => ({
        videoId: e.videoId,
        title: e.title,
        channel: e.channel,
        source: 'curated' as const,
      })),
      startId: entry.videoId,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="song-video-search">Search videos</Label>
          <Input
            id="song-video-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Song title, channel, or pattern (ai, sh, ar)"
          />
        </div>
        <div className="space-y-1.5 sm:w-64">
          <Label htmlFor="song-video-group">Filter by pattern group</Label>
          <select
            id="song-video-group"
            value={group ?? ''}
            onChange={(event) => setGroup(event.target.value === '' ? null : event.target.value)}
            className={SELECT_CLASSNAME}
          >
            <option value="">All patterns</option>
            {groups.map((g) => (
              <option key={g.label} value={g.label}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" role="status">
        Showing {entries.length} of {PATTERN_VIDEOS.length} videos
      </p>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center" role="status" aria-label="Loading videos">
          <div
            className="size-10 animate-spin rounded-full border-4 border-line border-t-sky-deep"
            aria-hidden="true"
          />
        </div>
      ) : entries.length === 0 ? (
        <div className="space-y-4 rounded-[20px] border-2 border-line bg-card p-8 text-center">
          <p className="text-lg font-bold">No videos match your search</p>
          <p className="text-sm text-muted-foreground">Try a different song title, channel, or pattern.</p>
          {hasFilters && (
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('')
                setGroup(null)
              }}
            >
              Clear search and filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <SongVideoCard
              key={entry.videoId}
              entry={entry}
              onPlay={playEntry}
              onHide={userId ? (video) => void blockVideo(video) : undefined}
            />
          ))}
        </div>
      )}

      {playing && (
        <PatternVideoModal
          title="Song videos"
          videos={playing.videos}
          startPlayingId={playing.startId}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  )
}
