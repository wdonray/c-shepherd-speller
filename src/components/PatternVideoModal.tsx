'use client'

import { useState, type ReactNode } from 'react'
import { ArrowLeftIcon, LinkIcon, PlayIcon, PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getVideosForPattern, searchVideos } from '@/data/pattern-videos'
import { extractYouTubeId, fetchVideoTitle, youtubeEmbedUrl, youtubeThumbnailUrl } from '@/lib/youtube'
import type { PatternVideo } from '@/models/WordList'

interface PatternVideoModalProps {
  /** Dialog heading, e.g. "Song videos for pattern ai". */
  title: string
  /** The video list shown; owned by the parent. */
  videos: PatternVideo[]
  /**
   * Persist an edited video list. When omitted the modal is browse-only:
   * suggestions, search, the paste row, and remove buttons are hidden and
   * the teacher can only play videos.
   */
  onChange?: (videos: PatternVideo[]) => void
  /** Pattern text for the curated suggestions; lookup is exact, never fuzzy. */
  suggestionPattern?: string
  /** Open the modal directly on the player for this video ID. */
  startPlayingId?: string
  /**
   * A save failure to show inside the modal. The modal applies edits
   * immediately (no draft), so a rejected save reverts the list behind it;
   * this message tells the teacher why their change vanished. Cleared by
   * the parent on the next save attempt.
   */
  saveError?: string | null
  onClose: () => void
}

const INVALID_LINK_ERROR = 'That does not look like a YouTube link. Paste a full YouTube URL.'
const DUPLICATE_VIDEO_ERROR = 'This video is already in the list.'
const VERIFY_FAILED_ERROR = 'Could not load that video. Check the link and try again.'

/** Small thumbnail with a play affordance, used for every video row. */
function VideoThumbnail({ video }: { video: PatternVideo }) {
  return (
    <img
      src={youtubeThumbnailUrl(video.videoId)}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className="h-14 w-24 shrink-0 rounded-lg object-cover"
    />
  )
}

/**
 * Song videos for a spelling pattern (issue #401). The teacher plays a
 * video from the list, attaches curated suggestions, searches the
 * collection, or pastes a YouTube link (verified via oEmbed before it is
 * added). Removing a curated video returns it to the suggestions, so hiding
 * one is reversible. The player is click-to-play: the iframe mounts only
 * when the teacher presses play, and unmounts on close or back, which stops
 * playback.
 */
export default function PatternVideoModal({
  title,
  videos,
  onChange,
  suggestionPattern,
  startPlayingId,
  saveError,
  onClose,
}: PatternVideoModalProps) {
  const [playingId, setPlayingId] = useState<string | null>(startPlayingId ?? null)
  const [query, setQuery] = useState('')
  const [pasteValue, setPasteValue] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const playing = videos.find((video) => video.videoId === playingId)

  const attachedIds = new Set(videos.map((video) => video.videoId))
  const suggestions = getVideosForPattern(suggestionPattern ?? '').filter((video) => !attachedIds.has(video.videoId))

  const trimmedQuery = query.trim()
  const searchResults = trimmedQuery ? searchVideos(trimmedQuery, videos) : []

  // The edit controls only render when onChange is present, so these
  // factories take the defined save function as an argument: calling the
  // optional prop directly would need a branch the tests cannot reach.
  const addVideo = (save: (videos: PatternVideo[]) => void, video: PatternVideo) => () => {
    save([...videos, video])
  }
  const removeVideo = (save: (videos: PatternVideo[]) => void, videoId: string) => () => {
    save(videos.filter((video) => video.videoId !== videoId))
  }
  const pasteAndAdd = (save: (videos: PatternVideo[]) => void) => async () => {
    const videoId = extractYouTubeId(pasteValue)
    if (!videoId) {
      setPasteError(INVALID_LINK_ERROR)
      return
    }
    if (attachedIds.has(videoId)) {
      setPasteError(DUPLICATE_VIDEO_ERROR)
      return
    }
    setVerifying(true)
    setPasteError(null)
    const info = await fetchVideoTitle(videoId)
    setVerifying(false)
    if (!info) {
      setPasteError(VERIFY_FAILED_ERROR)
      return
    }
    save([
      ...videos,
      {
        videoId,
        title: info.title,
        ...(info.channel ? { channel: info.channel } : {}),
        source: 'custom' as const,
      },
    ])
    setPasteValue('')
  }

  const playButton = (video: PatternVideo) => (
    <button
      type="button"
      onClick={() => setPlayingId(video.videoId)}
      aria-label={`Play ${video.title}`}
      title={`Play ${video.title}`}
      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-sky-deep outline-none transition hover:bg-sky-soft focus-visible:bg-sky-soft focus-visible:ring-[3px] focus-visible:ring-ring/60"
    >
      <PlayIcon className="size-6" aria-hidden="true" />
    </button>
  )

  const videoRow = (video: PatternVideo, actions: (save: (videos: PatternVideo[]) => void) => ReactNode) => (
    <li key={video.videoId} className="flex items-center gap-3 rounded-2xl border-2 border-line bg-card p-3">
      <VideoThumbnail video={video} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-ink">{video.title}</p>
        {video.channel && <p className="truncate text-[13px] text-muted-foreground">{video.channel}</p>}
      </div>
      {playButton(video)}
      {onChange && actions(onChange)}
    </li>
  )

  return (
    <Dialog
      open
      onOpenChange={() => {
        // The modal is mounted when open, so Radix only reports the close
        // paths here (Escape, overlay click, close button).
        onClose()
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-ink">{title}</DialogTitle>
          <DialogDescription className="text-[14px] text-muted-foreground">
            {onChange
              ? 'Play a song for the class, or attach videos to this pattern.'
              : 'Phonics songs for these spelling patterns. Pick one to play.'}
          </DialogDescription>
        </DialogHeader>

        {saveError && (
          <p
            role="alert"
            className="rounded-2xl border-2 border-coral bg-coral-soft p-4 text-[14px] font-bold text-coral-ink"
          >
            {saveError}
          </p>
        )}

        {playing ? (
          <div className="space-y-4">
            <Button type="button" variant="secondary" size="sm" onClick={() => setPlayingId(null)} className="gap-2">
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              Back to videos
            </Button>
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
              <iframe
                src={youtubeEmbedUrl(playing.videoId)}
                title={playing.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div>
              <p className="text-[15px] font-bold text-ink">{playing.title}</p>
              {playing.channel && <p className="text-[13px] text-muted-foreground">{playing.channel}</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <section aria-label={onChange ? 'Attached videos' : 'Videos'} className="space-y-3">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                {onChange ? `Attached videos (${videos.length})` : 'Videos'}
              </h3>
              {videos.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed border-line p-4 text-[14px] text-muted-foreground">
                  {onChange
                    ? 'No videos attached yet. Add one from the suggestions below, or paste a YouTube link.'
                    : 'No videos in this collection yet.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {videos.map((video) =>
                    videoRow(video, (save) => (
                      <button
                        type="button"
                        onClick={removeVideo(save, video.videoId)}
                        aria-label={`Remove ${video.title}`}
                        title={`Remove ${video.title}`}
                        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-coral-ink outline-none transition hover:bg-coral-soft focus-visible:bg-coral-soft focus-visible:ring-[3px] focus-visible:ring-ring/60"
                      >
                        <XIcon className="size-5" aria-hidden="true" />
                      </button>
                    ))
                  )}
                </ul>
              )}
            </section>

            {onChange && suggestions.length > 0 && (
              <section aria-label="Suggestions" className="space-y-3">
                <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  Suggestions for this pattern
                </h3>
                <ul className="space-y-2">
                  {suggestions.map((video) =>
                    videoRow(video, (save) => (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={addVideo(save, video)}
                        aria-label={`Add ${video.title}`}
                        className="shrink-0 gap-1"
                      >
                        <PlusIcon className="size-4" aria-hidden="true" />
                        Add
                      </Button>
                    ))
                  )}
                </ul>
              </section>
            )}

            {onChange && (
              <section aria-label="Search videos" className="space-y-3">
                <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  Search videos
                </h3>
                <div>
                  <Label htmlFor="pattern-video-search" className="sr-only">
                    Search videos by title or channel
                  </Label>
                  <Input
                    id="pattern-video-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by title or channel"
                    maxLength={100}
                  />
                </div>
                {trimmedQuery !== '' &&
                  (searchResults.length > 0 ? (
                    <ul className="space-y-2">
                      {searchResults.map((video) => {
                        const isAttached = attachedIds.has(video.videoId)
                        return videoRow(video, (save) =>
                          isAttached ? (
                            <span className="shrink-0 rounded-full bg-leaf-soft px-3 py-1 text-[13px] font-bold text-leaf-ink">
                              Attached
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={addVideo(save, video)}
                              aria-label={`Add ${video.title}`}
                              className="shrink-0 gap-1"
                            >
                              <PlusIcon className="size-4" aria-hidden="true" />
                              Add
                            </Button>
                          )
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-[14px] text-muted-foreground">No videos matched your search.</p>
                  ))}
              </section>
            )}

            {onChange && (
              <section aria-label="Add a YouTube link" className="space-y-3">
                <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  Add a YouTube link
                </h3>
                <div>
                  <Label htmlFor="pattern-video-paste" className="sr-only">
                    Paste a YouTube link
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="pattern-video-paste"
                      value={pasteValue}
                      onChange={(e) => {
                        setPasteValue(e.target.value)
                        setPasteError(null)
                      }}
                      placeholder="Paste a YouTube link"
                      inputMode="url"
                    />
                    <Button
                      type="button"
                      onClick={pasteAndAdd(onChange)}
                      disabled={verifying || !pasteValue.trim()}
                      className="shrink-0 gap-2"
                    >
                      <LinkIcon className="size-4" aria-hidden="true" />
                      {verifying ? 'Checking...' : 'Add video'}
                    </Button>
                  </div>
                  {pasteError && (
                    <p role="alert" className="pt-1 text-[13px] font-semibold text-coral-ink">
                      {pasteError}
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
