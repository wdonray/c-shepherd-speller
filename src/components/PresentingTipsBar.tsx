'use client'

import { useState } from 'react'
import { LightbulbIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { dismissPresentingTips, isPresentingTipsDismissed } from '@/lib/presenting-tips'

/**
 * One-time presenting guidance at the top of the present chart view.
 * The fullscreen, lock, sort, and print controls are otherwise only
 * discovered by tapping around, so this bar teaches the presenting
 * workflow at the moment of use. Dismissal is remembered per browser.
 */
export default function PresentingTipsBar() {
  const [dismissed, setDismissed] = useState(isPresentingTipsDismissed)

  if (dismissed) return null

  const handleDismiss = () => {
    dismissPresentingTips()
    setDismissed(true)
  }

  return (
    <div
      role="region"
      aria-label="Presenting tips"
      className="mx-auto mb-6 flex w-full max-w-3xl items-start gap-3 rounded-[20px] border-2 border-line bg-card p-4"
    >
      <LightbulbIcon className="mt-0.5 size-5 shrink-0 text-sun-ink" aria-hidden="true" />
      <p className="flex-1 text-[15px] leading-6 text-ink">
        <strong>Presenting tips:</strong> Press the fullscreen button for the biggest chart. Lock a pattern to hide it
        until you are ready to reveal it. Sort words turns the chart into a hands-on sorting activity. Print chart makes
        a handout of the same layout.
      </p>
      <Button variant="ghost" size="sm" onClick={handleDismiss} aria-label="Dismiss presenting tips">
        <XIcon className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline-block">Dismiss</span>
      </Button>
    </div>
  )
}
