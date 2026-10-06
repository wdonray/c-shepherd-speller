'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PlusIcon, PresentationIcon, GraduationCapIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLists } from '@/lib/lists-api'
import type { WordList } from '@/models/WordList'
import WordListCard from './WordListCard'

interface DashboardProps {
  onNewList: () => void
  onEditList: (list: WordList) => void
  onDeleteList: (list: WordList) => void
}

/**
 * Teacher dashboard: my lists, quick actions, getting started guide.
 * Replaces the generic welcome page.
 */
export default function Dashboard({ onNewList, onEditList, onDeleteList }: DashboardProps) {
  const [lists, setLists] = useState<WordList[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLists()
      .then(setLists)
      .catch(() => setLists([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]" role="status">
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Quick actions */}
      <section aria-label="Quick actions">
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={onNewList}>
            <PlusIcon className="size-5" />
            New list
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/practice">
              <GraduationCapIcon className="size-5" />
              Practice
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/display">
              <PresentationIcon className="size-5" />
              Present
            </Link>
          </Button>
        </div>
      </section>

      {/* My lists */}
      <section aria-label="My word lists">
        <h2 className="text-2xl font-bold mb-4">My word lists ({lists.length})</h2>
        {lists.length === 0 ? (
          <div className="border rounded-lg p-8 text-center space-y-4">
            <p className="text-xl text-muted-foreground">No word lists yet.</p>
            <div className="max-w-2xl mx-auto text-left space-y-3">
              <h3 className="font-semibold">Getting started with pattern-based spelling</h3>
              <p className="text-muted-foreground">
                Instead of memorizing flat word lists, group words by the spelling pattern for a target sound. For
                example, for the long A sound you might create patterns for a_e (cake, bake), ai (rain, pain), and ay
                (day, play). Research shows this helps students learn the pattern, not just the words.
              </p>
              <p className="text-muted-foreground">
                Click &ldquo;New list&rdquo; to create your first list. Add a pattern for each spelling, then add words
                under each pattern. Mark irregular spellings as &ldquo;odd ducks&rdquo;.
              </p>
            </div>
            <Button size="lg" onClick={onNewList}>
              <PlusIcon className="size-5" />
              Create your first list
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <WordListCard key={list.id} list={list} onEdit={onEditList} onDelete={onDeleteList} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
