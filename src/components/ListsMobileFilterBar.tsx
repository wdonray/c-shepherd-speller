'use client'

import { useEffect, useRef } from 'react'
import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ListSortMenu from './ListSortMenu'
import type { ListSort } from '@/lib/list-organize'

/** All/Favorites view selection, persisted across sessions (storage key lives in the parent). */
export type ListView = 'all' | 'favorites'

interface ListsMobileFilterBarProps {
  view: ListView
  onViewChange: (view: ListView) => void
  showFavoritesTab: boolean
  searching: boolean
  sort: ListSort
  onSortChange: (sort: ListSort) => void
  showSort: boolean
  query: string
  searchExpanded: boolean
  onSearchExpandedChange: (expanded: boolean) => void
}

/**
 * Compact single-row filter bar for the lists page on mobile (issue #484).
 * Below the md breakpoint the three stacked desktop toolbar rows collapse
 * into one 56px row: compact All/Favorites tabs, a sort icon button that
 * opens the existing bottom sheet, and a search icon that opens the
 * full-screen search view (issue #555, rendered by the parent).
 *
 * No layout shift: the row keeps a fixed h-14 geometry, and opening the
 * search view never moves the content below the sticky bar.
 */
export default function ListsMobileFilterBar({
  view,
  onViewChange,
  showFavoritesTab,
  searching,
  sort,
  onSortChange,
  showSort,
  query,
  searchExpanded,
  onSearchExpandedChange,
}: ListsMobileFilterBarProps) {
  const searchToggleRef = useRef<HTMLButtonElement>(null)

  // Focus choreography for the search view: closing it returns focus to
  // the toggle that opened it, so keyboard users never lose their place.
  // The toggle stays mounted behind the full-screen view, so the ref is
  // always live. The view itself focuses its field on open.
  const wasExpandedRef = useRef(searchExpanded)
  useEffect(() => {
    if (!searchExpanded && wasExpandedRef.current) {
      searchToggleRef.current?.focus()
    }
    wasExpandedRef.current = searchExpanded
  }, [searchExpanded])

  return (
    <div className="flex h-14 items-center gap-2" data-testid="mobile-filter-bar">
      {showFavoritesTab && !searching && (
        <div
          role="tablist"
          aria-label="List views"
          className="inline-flex shrink-0 rounded-full border-2 border-line bg-card p-0.5"
        >
          {(['all', 'favorites'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={view === tab}
              onClick={() => onViewChange(tab)}
              className={cn(
                'min-h-[44px] rounded-full px-3 text-sm font-bold outline-none transition-colors',
                'focus-visible:ring-[3px] focus-visible:ring-ring/60',
                view === tab ? 'bg-ink text-background' : 'text-muted-foreground hover:text-ink'
              )}
            >
              {tab === 'all' ? 'All' : 'Favorites'}
            </button>
          ))}
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {showSort && <ListSortMenu sort={sort} onSortChange={onSortChange} iconOnly />}
        <Button
          ref={searchToggleRef}
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Search lists"
          aria-pressed={query.trim().length > 0}
          onClick={() => onSearchExpandedChange(true)}
          className={cn('size-11 shrink-0', query.trim().length > 0 && 'border-ink bg-ink text-background')}
        >
          <SearchIcon className="size-5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
