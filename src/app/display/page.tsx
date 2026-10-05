import type { Metadata } from 'next'
import DisplayMode from '@/components/DisplayMode'

export const metadata: Metadata = {
  title: 'Display Mode | Shepherd Speller',
  description: 'Show your spelling lists on the big screen for classroom spelling.',
}

export default function DisplayPage() {
  return <DisplayMode />
}
