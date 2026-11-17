import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPrebuiltWeek, UFLI_DISCLAIMER } from '@/lib/prebuilt-lists'
import PrintButton from './print-button'

export const metadata: Metadata = {
  title: 'UFLI Lesson 84 ai/ay words: free list, chart and worksheet | PatternSpell',
  description:
    'Free ai and ay spelling words for UFLI Foundations Lesson 84 (Grade 2, Week 7): rain, train, wait, snail, paint, chain, play, day, say, away, stay, tray. Projectable pattern chart and printable worksheet with answer key. No sign-up needed to use the list.',
  keywords:
    'UFLI Lesson 84, ai ay words, ai ay spelling words, UFLI word list, grade 2 spelling words, free spelling worksheet',
  openGraph: {
    title: 'UFLI Lesson 84 ai/ay words: free list, chart and worksheet',
    description:
      'Free ai and ay spelling words for UFLI Foundations Lesson 84 (Grade 2, Week 7), with a projectable pattern chart and a printable worksheet with answer key.',
    type: 'website',
  },
}

/**
 * Public, findable page for one pattern week (marketing plan, flagship page).
 * The whole list is on the page so a teacher can use it without signing in.
 * Words come from the app's own UFLI prebuilt list, never typed by hand.
 */
export default function UfliLesson84AiAyPage() {
  const week = getPrebuiltWeek('ufli-g2-w07')
  if (!week) notFound()

  const allWords = week.patterns.flatMap((pattern) => pattern.words)

  return (
    <div className="min-h-screen px-4 pt-24 pb-16 md:px-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">UFLI Foundations, Grade 2, Week 7</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">UFLI Lesson 84: ai and ay Words</h1>
        <p className="mt-3 text-[15px] leading-7 text-ink/90">
          The long a sound in Lesson 84 is spelled two ways. The pattern <strong>ai</strong> spells long a in the middle
          of a word, and <strong>ay</strong> spells it at the end. The full list below is free to use, project, and
          print. No sign-up needed.
        </p>

        <section aria-labelledby="word-list-heading" className="mt-10">
          <h2 id="word-list-heading" className="text-xl font-bold text-ink">
            The word list
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {week.patterns.map((pattern) => (
              <div key={pattern.pattern} className="rounded-lg border p-4">
                <h3 className="text-lg font-bold text-ink">
                  {pattern.pattern} <span className="font-normal text-muted-foreground">({pattern.sound})</span>
                </h3>
                <ul className="mt-2 space-y-1">
                  {pattern.words.map((word) => (
                    <li key={word} className="text-[15px] leading-7 text-ink/90">
                      {word}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {allWords.length} words in this lesson: {allWords.join(', ')}.
          </p>
        </section>

        <section aria-labelledby="chart-heading" className="mt-10">
          <h2 id="chart-heading" className="text-xl font-bold text-ink">
            Projectable pattern chart
          </h2>
          <p className="mt-2 text-[15px] leading-7 text-ink/90">
            One column per pattern, all words visible at once. Project it as is, or open the list in PatternSpell for
            the interactive chart with videos and more worksheet types.
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="grid sm:grid-cols-2">
              {week.patterns.map((pattern, index) => (
                <div key={pattern.pattern} className={index > 0 ? 'border-t sm:border-t-0 sm:border-l' : ''}>
                  <div className="border-b bg-muted/50 px-4 py-3 text-center">
                    <span className="text-xl font-bold text-ink">{pattern.pattern}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{pattern.sound}</span>
                  </div>
                  <ul className="space-y-2 px-4 py-3 text-center">
                    {pattern.words.map((word) => (
                      <li key={word} className="text-[15px] leading-7 text-ink/90">
                        {word}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="build-heading" className="mt-10 rounded-lg border p-4">
          <h2 id="build-heading" className="text-xl font-bold text-ink">
            Use this list in PatternSpell
          </h2>
          <p className="mt-2 text-[15px] leading-7 text-ink/90">
            A free PatternSpell account lets you project the interactive chart, print more worksheet types with answer
            keys, and build your own lists for any week.
          </p>
          <Link
            href="/lists/prebuilt/ufli-g2-w07"
            className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-[15px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open this list in PatternSpell
          </Link>
        </section>

        <section aria-labelledby="worksheet-heading" className="mt-10">
          <h2 id="worksheet-heading" className="text-xl font-bold text-ink">
            Free printable worksheet
          </h2>
          <p className="mt-2 text-[15px] leading-7 text-ink/90">
            Word bank first, then write each word once. Print it straight from your browser, no email or account needed.
          </p>
          <div className="mt-4 rounded-lg border p-4">
            <h3 className="font-bold text-ink">Word bank</h3>
            <p className="mt-1 text-[15px] leading-7 text-ink/90">{allWords.join(', ')}</p>
            <h3 className="mt-4 font-bold text-ink">Write each word</h3>
            <ol className="mt-2 space-y-3">
              {allWords.map((word, index) => (
                <li key={word} className="flex items-baseline gap-3 text-[15px] text-ink/90">
                  <span className="w-6 shrink-0 text-right font-medium">{index + 1}.</span>
                  <span className="flex-1 border-b border-muted-foreground/40 pb-1" aria-hidden="true">
                    &nbsp;
                  </span>
                </li>
              ))}
            </ol>
            <h3 className="mt-6 font-bold text-ink">Answer key</h3>
            {week.patterns.map((pattern) => (
              <p key={pattern.pattern} className="mt-1 text-[15px] leading-7 text-ink/90">
                <strong>{pattern.pattern}:</strong> {pattern.words.join(', ')}
              </p>
            ))}
          </div>
          <div className="mt-4">
            <PrintButton />
          </div>
        </section>

        <p className="mt-10 text-sm text-muted-foreground">{UFLI_DISCLAIMER}</p>
      </div>
    </div>
  )
}
