import type { Metadata } from 'next'
import DisplayMode from '@/components/DisplayMode'

export const metadata: Metadata = {
  title: 'Display Mode | Shepherd Speller',
  description:
    'Present an interactive pattern chart on the big screen for classroom spelling: one column per spelling pattern, sized by frequency.',
}

export default function DisplayPage() {
  return <DisplayMode />
}
