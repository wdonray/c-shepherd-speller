'use client'

import { useEffect, useState } from 'react'
import { ArrowLeftIcon, CheckIcon, ChevronRightIcon, RotateCcwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLists, notifyListsChanged, updateList } from '@/lib/lists-api'
import type { PatternVideo, SpellingPattern, WordList } from '@/models/WordList'

/** The schema cap on PatternVideoSchema.videos per pattern (issue #401). */
const MAX_PATTERN_VIDEOS = 20

const LOAD_ERROR = 'Could not load your lists. Check your connection and try again.'
const SAVE_ERROR = 'Could not save the video. Check your connection and try again.'

/**
 * The add-to-list flow is a stack of modal views. `notice` carries the
 * list to go back to; a null list means the flow started from an empty
 * collection, so Back returns to the player instead of a pattern picker.
 */
type View =
  | { name: 'loading' }
  | { name: 'loadError' }
  | { name: 'lists'; lists: WordList[] }
  | { name: 'patterns'; list: WordList }
  | { name: 'saving'; list: WordList; pattern: SpellingPattern }
  | { name: 'saveError'; list: WordList; pattern: SpellingPattern }
  | { name: 'notice'; message: string; list: WordList | null }
  | { name: 'success'; list: WordList; pattern: SpellingPattern }

interface AddVideoToPatternFlowProps {
  /** The video being added, from the browse-only modal's player view. */
  video: PatternVideo
  /** Back to the player view. */
  onBack: () => void
  /** Close the modal after the flow finishes. */
  onDone: () => void
}

/** Back button shared by every view of the flow. */
function FlowBackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={onClick} className="gap-2">
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      Back
    </Button>
  )
}

/** Centered spinner used while lists load and while a save is in flight. */
function FlowSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center" role="status" aria-label={label}>
      <div className="size-10 animate-spin rounded-full border-4 border-line border-t-sky-deep" aria-hidden="true" />
    </div>
  )
}

/** Plain full-width row button used by both pickers. */
function PickerRow({
  onClick,
  title,
  subtitle,
  label,
}: {
  onClick: () => void
  title: string
  subtitle: string
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex w-full items-center gap-2 rounded-2xl border-2 border-line bg-card p-4 text-left outline-none transition hover:border-sky-deep focus-visible:border-sky-deep focus-visible:ring-[3px] focus-visible:ring-ring/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-ink">{title}</span>
        <span className="block truncate text-[13px] text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  )
}

/**
 * Add a song video to a pattern in one of the teacher's lists
 * (issue #449). Lives inside the browse-only PatternVideoModal: the
 * teacher picks a list, then a pattern in that list, and the video is
 * appended to that pattern's videos. Errors and edge states (no lists,
 * already attached, a full pattern, failed loads or saves) all stay in
 * the modal so the teacher is never stranded on the page behind it.
 */
export default function AddVideoToPatternFlow({ video, onBack, onDone }: AddVideoToPatternFlowProps) {
  const [view, setView] = useState<View>({ name: 'loading' })

  const loadLists = () => {
    setView({ name: 'loading' })
    getLists().then(
      (lists) =>
        // An empty collection is a notice, not an empty picker: the teacher
        // learns why there is nothing to pick, and Back returns to the
        // player since there is no list to go back through.
        lists.length === 0
          ? setView({
              name: 'notice',
              message: 'You do not have any lists yet. Create one from the dashboard first.',
              list: null,
            })
          : setView({ name: 'lists', lists }),
      () => setView({ name: 'loadError' })
    )
  }

  useEffect(() => {
    loadLists()
    // Mount-only: the teacher's lists are fetched once when the flow
    // opens; a retry re-runs loadLists explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Attach the video to the pattern, or explain why it cannot be saved. */
  const attachToPattern = (list: WordList, pattern: SpellingPattern) => () => {
    const existing = pattern.videos ?? []
    if (existing.some((attached) => attached.videoId === video.videoId)) {
      setView({
        name: 'notice',
        message: `This video is already on pattern ${pattern.pattern}.`,
        list,
      })
      return
    }
    if (existing.length >= MAX_PATTERN_VIDEOS) {
      setView({
        name: 'notice',
        message: `Pattern ${pattern.pattern} already has the maximum of ${MAX_PATTERN_VIDEOS} videos.`,
        list,
      })
      return
    }
    setView({ name: 'saving', list, pattern })
    updateList(list.id, {
      patterns: list.patterns.map((candidate) =>
        candidate.id === pattern.id ? { ...candidate, videos: [...existing, video] } : candidate
      ),
    }).then(
      () => {
        notifyListsChanged()
        setView({ name: 'success', list, pattern })
      },
      () => setView({ name: 'saveError', list, pattern })
    )
  }

  if (view.name === 'loading') return <FlowSpinner label="Loading your lists" />
  if (view.name === 'saving') return <FlowSpinner label="Saving the video" />

  if (view.name === 'loadError') {
    return (
      <div className="space-y-4">
        <FlowBackButton onClick={onBack} />
        <p
          role="alert"
          className="rounded-2xl border-2 border-coral bg-coral-soft p-4 text-[14px] font-bold text-coral-ink"
        >
          {LOAD_ERROR}
        </p>
        <Button type="button" variant="secondary" onClick={loadLists} className="gap-2">
          <RotateCcwIcon className="size-4" aria-hidden="true" />
          Try again
        </Button>
      </div>
    )
  }

  if (view.name === 'saveError') {
    return (
      <div className="space-y-4">
        <FlowBackButton onClick={() => setView({ name: 'patterns', list: view.list })} />
        <p
          role="alert"
          className="rounded-2xl border-2 border-coral bg-coral-soft p-4 text-[14px] font-bold text-coral-ink"
        >
          {SAVE_ERROR}
        </p>
        <Button type="button" variant="secondary" onClick={attachToPattern(view.list, view.pattern)} className="gap-2">
          <RotateCcwIcon className="size-4" aria-hidden="true" />
          Try again
        </Button>
      </div>
    )
  }

  if (view.name === 'notice') {
    return (
      <div className="space-y-4">
        <FlowBackButton onClick={() => (view.list ? setView({ name: 'patterns', list: view.list }) : onBack())} />
        <p className="rounded-2xl border-2 border-line bg-card p-4 text-[14px] text-muted-foreground">{view.message}</p>
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </div>
    )
  }

  if (view.name === 'success') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-leaf bg-leaf-soft p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leaf text-white">
            <CheckIcon className="size-5" aria-hidden="true" />
          </span>
          <p className="text-[15px] font-bold text-leaf-ink">
            Added to {view.list.name}, pattern {view.pattern.pattern}.
          </p>
        </div>
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </div>
    )
  }

  if (view.name === 'patterns') {
    return (
      <div className="space-y-4">
        <FlowBackButton onClick={() => loadLists()} />
        <section aria-label="Pick a pattern" className="space-y-3">
          <div>
            <h3 className="text-[15px] font-bold text-ink">Add to a pattern in {view.list.name}</h3>
            <p className="text-[13px] text-muted-foreground">The video attaches to the pattern you pick.</p>
          </div>
          <ul className="space-y-2">
            {view.list.patterns.map((pattern) => (
              <li key={pattern.id}>
                <PickerRow
                  onClick={attachToPattern(view.list, pattern)}
                  title={pattern.pattern}
                  subtitle={pattern.sound}
                  label={`Add to pattern ${pattern.pattern}`}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  // List picker. The collection is never empty here: loadLists turns an
  // empty collection into a notice instead (see above).
  return (
    <div className="space-y-4">
      <FlowBackButton onClick={onBack} />
      <section aria-label="Pick a list" className="space-y-3">
        <div>
          <h3 className="text-[15px] font-bold text-ink">Add to a list</h3>
          <p className="text-[13px] text-muted-foreground">Pick one of your spelling lists first.</p>
        </div>
        <ul className="space-y-2">
          {view.lists.map((list) => (
            <li key={list.id}>
              <PickerRow
                onClick={() => setView({ name: 'patterns', list })}
                title={list.name}
                subtitle={`${list.patterns.length} pattern${list.patterns.length === 1 ? '' : 's'}`}
                label={`Add to list ${list.name}`}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
