'use client'

import { useBlockedVideos } from '@/hooks/useBlockedVideos'
import { youtubeThumbnailUrl } from '@/lib/youtube'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

/**
 * The teacher's hidden-video list on the profile page (issue #443).
 * Every video hidden from suggestions, the home browse section, or the
 * present-mode video list lands here, with an Unhide action that puts it
 * back into suggestions, search, and browse.
 */
export default function HiddenVideosSection() {
  const { blockedVideos, unblockVideo, isLoaded } = useBlockedVideos()

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-bold text-ink">Hidden videos</h3>
        <CardDescription>
          Videos you hid from suggestions, search, and the home page. Unhide one to see it again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isLoaded ? (
          <p className="text-sm text-muted-foreground">Loading hidden videos...</p>
        ) : blockedVideos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hidden videos. Hide a video from its suggestions, the home page, or the present-mode video list to keep
            it out of sight.
          </p>
        ) : (
          <ul className="space-y-2">
            {blockedVideos.map((video) => (
              <li key={video.videoId} className="flex items-center gap-3 rounded-2xl border-2 border-line bg-card p-3">
                <img
                  src={youtubeThumbnailUrl(video.videoId)}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="h-14 w-24 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-ink">{video.title}</p>
                  {video.channel && <p className="truncate text-[13px] text-muted-foreground">{video.channel}</p>}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void unblockVideo(video.videoId)}
                  aria-label={`Unhide ${video.title}`}
                  className="shrink-0"
                >
                  Unhide
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
