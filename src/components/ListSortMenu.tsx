'use client'

import { useState } from 'react'
import { ArrowUpDownIcon, CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/lib/use-media-query'
import { LIST_SORT_OPTIONS, type ListSort } from '@/lib/list-organize'

const MOBILE_QUERY = '(max-width: 767px)'

interface ListSortMenuProps {
  sort: ListSort
  onSortChange: (sort: ListSort) => void
}

/**
 * Sort control for the lists overview (issue #275).
 *
 * Desktop: a dropdown menu. Mobile: a bottom sheet (large touch targets
 * for tablet-at-the-board use). The teacher's choice persists via the
 * parent's localStorage hook.
 */
export default function ListSortMenu({ sort, onSortChange }: ListSortMenuProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const [sheetOpen, setSheetOpen] = useState(false)
  const activeLabel = LIST_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Recently modified'

  const choose = (value: ListSort) => {
    onSortChange(value)
    setSheetOpen(false)
  }

  if (isMobile) {
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="min-h-[44px]">
            <ArrowUpDownIcon className="size-4" aria-hidden="true" />
            Sort: {activeLabel}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="gap-0 rounded-t-[20px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* iOS-style grabber, centered at the top of the sheet. */}
          <div className="flex justify-center pt-3" aria-hidden="true">
            <div className="h-[5px] w-9 rounded-full bg-line-deep" />
          </div>
          <SheetHeader className="px-0 pb-2 pt-2">
            <SheetTitle>Sort lists</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            {LIST_SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => choose(option.value)}
                aria-pressed={sort === option.value}
                className={cn(
                  'flex min-h-[52px] items-center justify-between rounded-2xl border-2 px-4 py-3 text-left text-[16px] font-bold outline-none',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/60',
                  sort === option.value
                    ? 'border-ink bg-ink text-background'
                    : 'border-line bg-card text-ink hover:border-line-deep'
                )}
              >
                {option.label}
                {sort === option.value && <CheckIcon className="size-5" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-h-[44px]">
          <ArrowUpDownIcon className="size-4" aria-hidden="true" />
          Sort: {activeLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuRadioGroup value={sort} onValueChange={(value) => onSortChange(value as ListSort)}>
          {LIST_SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="text-[15px]">
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
