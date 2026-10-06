'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PencilIcon, TrashIcon, PresentationIcon } from 'lucide-react'
import type { WordList } from '@/models/WordList'
import Link from 'next/link'

interface WordListCardProps {
  list: WordList
  onEdit: (list: WordList) => void
  onDelete: (list: WordList) => void
}

/** Summary card for a pattern-based word list. */
export default function WordListCard({ list, onEdit, onDelete }: WordListCardProps) {
  const wordCount = list.patterns.reduce((sum, p) => sum + p.words.length, 0)
  const patternCount = list.patterns.length

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="truncate">{list.name}</span>
          {list.gradeLevel && (
            <span className="text-xs font-normal text-muted-foreground shrink-0">Grade {list.gradeLevel}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          {patternCount} {patternCount === 1 ? 'pattern' : 'patterns'} · {wordCount}{' '}
          {wordCount === 1 ? 'word' : 'words'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/display?list=${encodeURIComponent(list.id)}`}>
              <PresentationIcon className="size-4" />
              Present
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(list)}>
            <PencilIcon className="size-4" />
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDelete(list)}>
            <TrashIcon className="size-4" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
