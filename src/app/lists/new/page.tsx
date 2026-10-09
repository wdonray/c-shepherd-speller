import type { Metadata } from 'next'
import NewListForm from '@/components/NewListForm'

export const metadata: Metadata = {
  title: 'New word list | PatternSpell',
  description: 'Create a new pattern-based spelling list.',
}

/** Dedicated new-list form page. Replaces the old new-list dialog. */
export default function NewListPage() {
  return <NewListForm />
}
