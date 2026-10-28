'use client'

import { useEffect } from 'react'
import { ArrowLeftIcon, SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { WordList } from '@/models/WordList'
import ListsOverviewCard from './ListsOverviewCard'

interface ListsMobileSearchOverlayProps {
  query: string
  onQueryChange: (query: string) => void
  onClose: () => void
  results: WordList[]
  onOpen: (list: WordList) => void
  onDelete: (list: WordList) => void
  onToggleFavorite: (list: WordList) => void
}

/**
 * Full-screen search view for the lists page on mobile (issue #555).
 *
 * Tapping the search icon in the compact mobile bar used to expand the
 * field inline in the 56px toolbar row, so with the keyboard up the
 * results ended up behind the keyboard. This view takes the whole screen
 * instead: the field sits focused at the top, and the matching lists
 * scroll in the space that remains.
 *
 * Two ways out, covering both platform conventions with our own UI (not
 * the phone's): a back arrow (Android) and a Cancel label (iOS). Either
 * one clears the query and returns to the list unchanged. Desktop never
 * sees this view (md:hidden); it keeps the inline expansion.
 *
 * The keyboard fix is h-dvh, not h-screen: the dynamic viewport height
 * shrinks when the on-screen keyboard opens, so the scrollable results
 * region stays above the keyboard instead of extending behind it.
 */
export default function ListsMobileSearchOverlay({
  query,
  onQueryChange,
  onClose,
  results,
  onOpen,
  onDelete,
  onToggleFavorite,
}: ListsMobileSearchOverlayProps) {
  const searching = query.trim().length > 0

  // Lock the page behind the view: it covers the screen, so the list
  // underneath must not scroll while the view is open.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') onClose()
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex h-dvh flex-col bg-background md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Search lists"
      data-testid="mobile-search-overlay"
    >
      <div className="flex shrink-0 items-center gap-1 px-2 pb-1 pt-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors',
            'hover:bg-line/60 hover:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/60'
          )}
        >
          <ArrowLeftIcon className="size-5" aria-hidden="true" />
        </button>
        <SearchIcon className="ml-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search lists"
          aria-label="Search lists"
          className="min-h-[44px] flex-1 rounded-full"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel search"
          className={cn(
            'shrink-0 rounded-full px-3 py-3 text-[15px] font-bold text-muted-foreground outline-none transition-colors',
            'hover:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/60'
          )}
        >
          Cancel
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {searching && (
          <p className="pb-3 text-[15px] text-muted-foreground" role="status">
            {results.length === 0
              ? `No lists match "${query.trim()}".`
              : `${results.length} ${results.length === 1 ? 'result' : 'results'} for "${query.trim()}".`}
          </p>
        )}
        <div className="grid gap-4" data-testid="mobile-search-results">
          {results.map((list) => (
            <ListsOverviewCard
              key={list.id}
              list={list}
              reorderable={false}
              onOpen={onOpen}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              highlightQuery={searching ? query : ''}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
