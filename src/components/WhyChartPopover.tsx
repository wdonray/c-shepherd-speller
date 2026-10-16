'use client'

import { useEffect, useRef, useState } from 'react'
import { InfoIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * "Why this chart?" explainer next to the list name in the present chart
 * header. The landing page argues the chart format is what teachers
 * choose; in the app the chart just appears, so a teacher wondering "why
 * columns?" gets the answer where the question arises.
 *
 * The copy lives in exported constants so the mobile overflow menu
 * (ChartActionsMenu) shows the identical text without duplicating it.
 */
export const WHY_CHART_TITLE = 'Why this chart?'
export const WHY_CHART_BODY =
  'One column per pattern, all words visible at once. This is the format teachers choose over spelling trees and hand-drawn boards: every word stays readable from the back of the room, and the pattern jumps out because the words are grouped by it.'

export default function WhyChartPopover() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="why-chart-popover"
        aria-label={WHY_CHART_TITLE}
      >
        <InfoIcon className="size-5" aria-hidden="true" />
      </Button>
      {open && (
        <div
          id="why-chart-popover"
          role="dialog"
          aria-label={WHY_CHART_TITLE}
          className="absolute left-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-line bg-card p-5 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">{WHY_CHART_TITLE}</h2>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Close">
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{WHY_CHART_BODY}</p>
        </div>
      )}
    </div>
  )
}
