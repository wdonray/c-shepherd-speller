import type { Metadata } from 'next'
import BackLink from '@/components/BackLink'
import PatternListsManager from '@/components/PatternListsManager'

export const metadata: Metadata = {
  title: 'My spelling lists | PatternSpell',
  description: 'All of your spelling lists, organized by spelling pattern. Create a new list or open one to edit.',
}

/** Full-page overview of all word lists. Replaces the old list drawer. */
export default function ListsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <BackLink href="/">Home</BackLink>
      <div className="mt-2 space-y-1">
        <h1 className="text-3xl font-bold">My Spelling Lists</h1>
        <p className="text-[15px] text-muted-foreground">
          Organize words by spelling pattern. Each list groups words under the patterns that spell a target sound.
        </p>
      </div>
      <div className="mt-6">
        <PatternListsManager />
      </div>
    </div>
  )
}
