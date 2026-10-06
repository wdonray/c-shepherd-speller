import type { Metadata } from 'next'
import TreeDisplayMode from '@/components/TreeDisplayMode'

export const metadata: Metadata = {
  title: 'Display Mode | Shepherd Speller',
  description: 'Present an interactive spelling tree on the big screen for classroom spelling.',
}

export default function DisplayPage() {
  return <TreeDisplayMode />
}
