'use client'

import { useEffect } from 'react'
import { reportPageName } from '@/lib/navigation-history'

/**
 * Lets a server-rendered page with a dynamic title (a ready-made week's
 * title) name itself for history-aware back controls (issue #504).
 */
export default function ReportPageName({ name }: { name: string }) {
  useEffect(() => {
    reportPageName(name)
  }, [name])
  return null
}
