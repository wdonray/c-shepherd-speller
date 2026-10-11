import PatternChartDisplay from '@/components/PatternChartDisplay'
import type { WordList } from '@/models/WordList'

/**
 * A fixed sample chart shown on the landing page so visitors can see
 * what the product looks like before creating an account. Rendered with
 * the print variant: non-interactive, words as plain text. Labeled as a
 * sample so nobody mistakes it for their own data.
 */
const SAMPLE_LIST: WordList = {
  id: 'sample-long-a',
  userId: 'sample',
  name: 'Week 5: Long A',
  color: 'leaf',
  patterns: [
    {
      id: 'sample-a-e',
      sound: 'long a',
      pattern: 'a_e',
      frequency: 'common',
      words: ['cake', 'bake', 'made', 'late', 'game', 'take'],
    },
    {
      id: 'sample-ai',
      sound: 'long a',
      pattern: 'ai',
      frequency: 'less-common',
      words: ['rain', 'train', 'paint', 'wait'],
    },
    {
      id: 'sample-ay',
      sound: 'long a',
      pattern: 'ay',
      frequency: 'rare',
      words: ['day', 'play', 'say'],
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export function SampleChart() {
  return (
    <figure aria-label="Sample pattern chart">
      <PatternChartDisplay list={SAMPLE_LIST} variant="print" />
      <figcaption className="mt-3 text-center text-[14px] text-muted-foreground">
        A sample chart: three spellings of the long a sound, one column per pattern.
      </figcaption>
    </figure>
  )
}
