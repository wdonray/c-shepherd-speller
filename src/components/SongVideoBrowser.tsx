'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PATTERN_VIDEOS,
  getPatternGroups,
  searchSongVideos,
  getCollectionVideos,
  type PatternVideoEntry,
} from '@/data/pattern-videos'
import { useBlockedVideos } from '@/hooks/useBlockedVideos'
import { getVideoLibrary } from '@/lib/video-library-api'
import { reportError } from '@/lib/report-error'
import type { PatternVideo } from '@/models/WordList'
import SongVideoCard from './SongVideoCard'
import PatternVideoModal from './PatternVideoModal'

/** Native select styling matched to the Input component. */
const SELECT_CLASSNAME =
  'flex h-12 w-full rounded-xl border-2 border-line bg-card px-4 py-2 text-base text-ink outline-none transition focus-visible:border-sky-deep focus-visible:ring-[3px] focus-visible:ring-ring/40'

/** One row of the browse grid: a bank entry or one of her own pasted videos. */
interface BrowserVideo {
  videoId: string
  title: string
  channel: string
  /** Pattern tags; empty for her own pasted videos, which carry none. */
  patterns: string[]
  source: 'curated' | 'custom'
}

/**
 * The full song-video catalog (issue #439): search plus one plain-language
 * pattern-group dropdown over the teacher's whole collection. The collection
 * is the curated bank plus every video she added by pasting a link
 * (issue #458): the browse count reflects her real library (19 -> 20 after
 * adding one). Her videos carry no pattern tags, so a pattern-group filter
 * shows bank videos only; search matches her videos by title or channel.
 * Play opens the player modal in browse-only mode; signed-in teachers can
 * hide videos from the cards. The grid waits for the hidden-video list and
 * her library when signed in so the card count never changes after first
 * paint (issue #443).
 */
export default function SongVideoBrowser() {
  const searchParams = useSearchParams()
  const { status } = useSession()
  const { blockedVideoIds, blockVideo, userId, isLoaded: blockedLoaded } = useBlockedVideos()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [group, setGroup] = useState<string | null>(null)
  const [playing, setPlaying] = useState<{ videos: PatternVideo[]; startId: string } | null>(null)
  const [library, setLibrary] = useState<PatternVideo[]>([])
  const [libraryLoaded, setLibraryLoaded] = useState(false)

  const groups = getPatternGroups()

  // Her personal collection (issue #458): signed-out visitors never fetch
  // it, and a failed fetch degrades to the bank rather than breaking browse.
  useEffect(() => {
    if (status === 'loading') return
    if (status !== 'authenticated') {
      setLibraryLoaded(true)
      return
    }
    let cancelled = false
    getVideoLibrary()
      .then((videos) => {
        if (!cancelled) {
          setLibrary(videos)
          setLibraryLoaded(true)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLibraryLoaded(true)
          reportError(error, { location: 'SongVideoBrowser.library' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [status])

  // Bank first, her videos appended in the order added (issue #458).
  const collection = useMemo<BrowserVideo[]>(() => {
    const bankEntries = new Map(PATTERN_VIDEOS.map((entry) => [entry.videoId, entry]))
    return getCollectionVideos(library).map((video) => {
      const bankEntry = bankEntries.get(video.videoId)
      return {
        videoId: video.videoId,
        title: video.title,
        channel: video.channel ?? bankEntry?.channel ?? '',
        patterns: bankEntry?.patterns ?? [],
        source: bankEntry ? ('curated' as const) : ('custom' as const),
      }
    })
  }, [library])

  const entries = useMemo(() => {
    const visible = collection.filter((entry) => !blockedVideoIds.has(entry.videoId))
    const q = query.trim()
    const lowered = q.toLowerCase()
    const bankMatches = new Set(searchSongVideos(q).map((match) => match.videoId))
    const searched = q
      ? visible.filter((entry) =>
          entry.source === 'curated'
            ? bankMatches.has(entry.videoId)
            : entry.title.toLowerCase().includes(lowered) || entry.channel.toLowerCase().includes(lowered)
        )
      : visible
    const groupPatterns = new Set(groups.filter((g) => g.label === group).flatMap((g) => g.patterns))
    if (groupPatterns.size === 0) return searched
    return searched.filter((entry) => entry.patterns.some((pattern) => groupPatterns.has(pattern)))
  }, [query, group, blockedVideoIds, groups, collection])

  // Hold the grid until the session AND the hidden-video list AND her
  // library resolve: all three change the card count, so painting the grid
  // first and filtering after would shift the page (issues #443, #458).
  // Signed-out visitors never wait on the teacher-scoped lists.
  const loading = status === 'loading' || (status === 'authenticated' && (!blockedLoaded || !libraryLoaded))
  const hasFilters = query.trim() !== '' || group !== null

  const playEntry = (entry: PatternVideoEntry) => {
    setPlaying({
      videos: entries.map((e) => ({
        videoId: e.videoId,
        title: e.title,
        ...(e.channel ? { channel: e.channel } : {}),
        source: e.source,
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
        Showing {entries.length} of {collection.length} videos
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
          canAddToList={status === 'authenticated'}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  )
}
