import type { Metadata } from 'next'
import BackLink from '@/components/BackLink'
import FeedbackForm from '@/components/FeedbackForm'

export const metadata: Metadata = {
  title: 'Report an issue | PatternSpell',
  description: 'Report a problem or request a feature in PatternSpell.',
}

/** Full-page feedback form. The message is emailed to the developer. */
export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <BackLink href="/">Back to home</BackLink>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Report an issue or request a feature
      </h1>
      <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">
        Describe the problem or the idea below. It is emailed directly to the PatternSpell developer.
      </p>
      <div className="mt-8">
        <FeedbackForm />
      </div>
    </div>
  )
}
