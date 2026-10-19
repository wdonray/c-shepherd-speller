'use client'

import { EyeOffIcon } from 'lucide-react'
import { youtubeThumbnailUrl } from '@/lib/youtube'
import type { PatternVideoEntry } from '@/data/pattern-videos'

interface SongVideoCardProps {
  /** The bank entry to render. */
  entry: PatternVideoEntry
  /** Play the video (opens the player modal). */
  onPlay: (entry: PatternVideoEntry) => void
  /** Hide the video for this teacher; omitted for signed-out visitors. */
  onHide?: (entry: PatternVideoEntry) => void
}

/**
 * One song-video card (issue #439): thumbnail, title, channel, and covered
 * patterns; the whole card plays the video, with an overlay Hide action
 * for signed-in teachers. Shared by the home spotlight and the /videos
 * browse page so both surfaces stay identical. The teacher's own pasted
 * videos (issue #458) carry no pattern tags and sometimes no channel, so
 * those lines are omitted for them rather than faked.
 */
export default function SongVideoCard({ entry, onPlay, onHide }: SongVideoCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border-2 border-line bg-card outline-none transition hover:border-sky-deep focus-within:border-sky-deep focus-within:ring-[3px] focus-within:ring-ring/60">
      <button
        type="button"
        onClick={() => onPlay(entry)}
        aria-label={`Play ${entry.title}`}
        className="block w-full cursor-pointer text-left outline-none"
      >
        <img
          src={youtubeThumbnailUrl(entry.videoId)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
        <div className="space-y-1 p-4">
          <p className="text-[15px] font-bold leading-snug text-ink">{entry.title}</p>
          {entry.channel && <p className="text-[13px] text-muted-foreground">{entry.channel}</p>}
          {entry.patterns.length > 0 && (
            <p className="text-[13px] text-muted-foreground">Patterns: {entry.patterns.join(', ')}</p>
          )}
        </div>
      </button>
      {onHide && (
        <button
          type="button"
          onClick={() => onHide(entry)}
          aria-label={`Hide ${entry.title}`}
          title={`Hide ${entry.title}`}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-[13px] font-bold text-white outline-none transition hover:bg-black/75 focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <EyeOffIcon className="size-4" aria-hidden="true" />
          Hide
        </button>
      )}
    </div>
  )
}
