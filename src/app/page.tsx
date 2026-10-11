import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpenText, LayoutGrid, Presentation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { SampleChart } from '@/components/landing/SampleChart'
import { SignedInRedirect } from '@/components/landing/SignedInRedirect'

export const metadata: Metadata = {
  title: 'PatternSpell: Spelling Lists by Phonics Pattern',
  description:
    'PatternSpell helps elementary teachers build spelling lists organized by phonics pattern and display them as a clear chart on a projector or smartboard.',
}

const STEPS = [
  {
    icon: BookOpenText,
    title: "Pick the week's patterns",
    body: 'Type in the spelling patterns you are teaching, like a_e, ai, and ay for the long a sound.',
  },
  {
    icon: LayoutGrid,
    title: 'Add your words',
    body: 'Sort words under each pattern. Flag the irregular words that break the rule.',
  },
  {
    icon: Presentation,
    title: 'Display the chart',
    body: 'Project one clear chart during your lesson. Every word is visible at once, grouped so the pattern jumps out.',
  },
]

/**
 * Public landing page. Explains what PatternSpell is, who it is for, and
 * why a teacher would create an account, then points at the login/signup
 * flow. The app itself stays behind auth; see src/proxy.ts.
 */
export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SignedInRedirect />
      <LandingHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[15px] font-bold uppercase tracking-wide text-leaf-deep">
              A spelling tool for elementary teachers
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Teach spelling by pattern. Show it on a chart the whole class can read.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              PatternSpell helps you build spelling lists organized by phonics pattern and display them as one clear
              chart on your projector or smartboard.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full px-8 sm:w-auto">
                <Link href="/auth/signin">Get started free</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="w-full px-8 sm:w-auto">
                <Link href="/auth/signin">Log in</Link>
              </Button>
            </div>
            <p className="mt-4 text-[14px] text-muted-foreground">
              Free for teachers 18 and older. Sign in with Google or email.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-5xl">
            <SampleChart />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-line bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 className="text-center text-3xl font-extrabold tracking-tight">How it works</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[17px] leading-7 text-muted-foreground">
              Three steps, once a week. No printing, no cutting, no rewriting the same words on the board.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-line bg-paper p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-leaf-soft text-leaf-deep">
                      <step.icon className="size-6" aria-hidden="true" />
                    </span>
                    <span className="text-[14px] font-bold text-muted-foreground">Step {index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold">{step.title}</h3>
                  <p className="mt-2 text-[16px] leading-7 text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who it is for */}
        <section id="who-its-for" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-center text-3xl font-extrabold tracking-tight">Made for pattern teachers</h2>
              <p className="mt-5 text-[17px] leading-8 text-muted-foreground">
                PatternSpell is for elementary teachers and homeschool educators who teach spelling through phonics
                patterns. It works with any program: CKLA, Fundations, UFLI, Words Their Way, or your own sequence.
              </p>
              <p className="mt-4 text-[17px] leading-8 text-muted-foreground">
                It is not a curriculum. It is the list-building and display layer that sits on top of the sequence you
                already teach. If your spelling program is pure memorization of unrelated word lists, this tool is not
                for you.
              </p>
            </div>
          </div>
        </section>

        {/* Why patterns */}
        <section className="border-t border-line bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-center text-3xl font-extrabold tracking-tight">Why patterns beat memorizing</h2>
              <p className="mt-5 text-[17px] leading-8 text-muted-foreground">
                One pattern learned is dozens of words spelled. When students see words grouped by a shared spelling
                pattern, they learn the rule behind the words and can spell new words they have never seen. Memorizing a
                list only teaches the listed words.
              </p>
              <p className="mt-4 text-[17px] leading-8 text-muted-foreground">
                That is why every major phonics program organizes spelling around patterns. PatternSpell gives you the
                chart format teachers actually choose: one column per pattern, all words visible at once.
              </p>
            </div>
          </div>
        </section>

        {/* What it is not */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-card p-6 sm:p-8">
              <h2 className="text-2xl font-extrabold tracking-tight">What PatternSpell is not</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-[16px] leading-7 text-muted-foreground">
                <li>Not a game site. There is nothing here for students to click through.</li>
                <li>Not a replacement for your phonics curriculum.</li>
                <li>
                  Not an app students log into. You build the lists and display the chart. Your students learn from what
                  you show.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-line bg-leaf-soft">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-20">
            <h2 className="text-3xl font-extrabold tracking-tight">Ready for a clearer spelling lesson?</h2>
            <p className="mx-auto mt-3 max-w-xl text-[17px] leading-7 text-muted-foreground">
              Build your first pattern chart in minutes. Free for teachers.
            </p>
            <Button asChild size="lg" className="mt-8 px-10">
              <Link href="/auth/signin">Get started free</Link>
            </Button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
