'use client'

import { getMatchSegments } from '@/lib/list-search'
import { cn } from '@/lib/utils'

interface HighlightedTextProps {
  text: string
  query: string
  className?: string
}

/**
 * Renders text with query matches in bold (issue #275 search).
 * Renders plain text when the query is empty.
 */
export default function HighlightedText({ text, query, className }: HighlightedTextProps) {
  const segments = getMatchSegments(text, query)
  return (
    <span className={className}>
      {segments.map((segment, i) => (
        <span key={i} className={cn(segment.match && 'font-extrabold')}>
          {segment.text}
        </span>
      ))}
    </span>
  )
}
