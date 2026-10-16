'use client'

import Link from 'next/link'
import { MenuIcon, PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import FullscreenButton from './FullscreenButton'
import RulesVisibilityToggle from './RulesVisibilityToggle'
import WordUnderlineToggle from './WordUnderlineToggle'
import { WHY_CHART_BODY, WHY_CHART_TITLE } from './WhyChartPopover'

interface ChartActionsMenuProps {
  listId: string
  showRules: boolean
  onToggleRules: () => void
  showUnderlines: boolean
  onToggleUnderlines: () => void
}

/**
 * Mobile overflow menu for the Present chart header (issue #312).
 *
 * Follows the app's established mobile pattern (Header.tsx, ListSortMenu):
 * on small screens the secondary chart controls collapse into a single menu
 * entry point that opens a bottom sheet, instead of crowding the list title.
 * The desktop header keeps its full control bar; this trigger hides at sm
 * and up. "Sort words" stays in the bar as the primary action on all sizes.
 */
export default function ChartActionsMenu({
  listId,
  showRules,
  onToggleRules,
  showUnderlines,
  onToggleUnderlines,
}: ChartActionsMenuProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="icon" className="shrink-0 sm:hidden" aria-label="Open chart options">
          <MenuIcon className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t-2 border-line bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>Chart options</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <div className="flex min-h-[52px] items-center justify-between gap-2 rounded-2xl border-2 border-line bg-background px-4">
            <span className="text-[16px] font-bold text-ink">Rules</span>
            <RulesVisibilityToggle showRules={showRules} onToggle={onToggleRules} />
          </div>
          <div className="flex min-h-[52px] items-center justify-between gap-2 rounded-2xl border-2 border-line bg-background px-4">
            <span className="text-[16px] font-bold text-ink">Word underlines</span>
            <WordUnderlineToggle showUnderlines={showUnderlines} onToggle={onToggleUnderlines} />
          </div>
          <SheetClose asChild>
            <Button variant="secondary" size="lg" asChild className="justify-start">
              <Link href={`/lists/${listId}/print`}>
                <PrinterIcon className="size-4" aria-hidden="true" />
                Print chart
              </Link>
            </Button>
          </SheetClose>
          {/* Renders nothing where the Fullscreen API is unavailable. */}
          <FullscreenButton
            alwaysShowLabel
            className="min-h-[52px] w-full justify-start gap-3 px-4 text-[16px] font-bold"
          />
          <div className="rounded-2xl border-2 border-line bg-background p-4">
            <h3 className="text-[16px] font-bold text-ink">{WHY_CHART_TITLE}</h3>
            <p className="mt-1 text-[15px] leading-6 text-muted-foreground">{WHY_CHART_BODY}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
