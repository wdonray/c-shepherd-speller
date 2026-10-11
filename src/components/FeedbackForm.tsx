'use client'

import { useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FeedbackSchema, FEEDBACK_TYPE_LABELS, type FeedbackType } from '@/models/Feedback'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/report-error'

const SUBJECT_MAX = 120
const DETAILS_MAX = 5000

const TYPE_DESCRIPTIONS: Record<FeedbackType, string> = {
  issue: 'Something is not working the way it should.',
  feature: 'An idea for something new in PatternSpell.',
}

/**
 * "Report an issue / Request a feature" form. Posts to /api/feedback, which
 * emails the message to Donray with the reporter's address and app version.
 */
export default function FeedbackForm() {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('issue')
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ subject?: string; details?: string }>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function reset() {
    setFeedbackType('issue')
    setSubject('')
    setDetails('')
    setFieldErrors({})
    setSubmitError(null)
    setSent(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    const parsed = FeedbackSchema.safeParse({ type: feedbackType, subject, details })
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      setFieldErrors({ subject: flat.subject?.[0], details: flat.details?.[0] })
      return
    }
    setFieldErrors({})
    setSending(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      if (res.status === 429) {
        setSubmitError('You have sent a few messages recently. Please wait a little while and try again.')
      } else if (!res.ok) {
        setSubmitError('Something went wrong sending your message. Please try again.')
      } else {
        setSent(true)
      }
    } catch (err) {
      reportError(err, { location: 'FeedbackForm.handleSubmit' })
      setSubmitError('Something went wrong sending your message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border-2 border-line bg-card p-8 text-center">
        <CircleCheck className="mx-auto size-12 text-leaf" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-bold text-ink">Message sent</h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
          Thanks for the feedback. Every message is read by the person who builds PatternSpell.
        </p>
        <Button className="mt-6" variant="secondary" onClick={reset}>
          Send another message
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <fieldset>
        <legend className="text-[15px] font-semibold text-ink">What is this about?</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(['issue', 'feature'] as const).map((value) => (
            <label
              key={value}
              className={cn(
                'cursor-pointer rounded-xl border-2 p-4 transition outline-none focus-within:ring-[3px] focus-within:ring-ring/40',
                feedbackType === value
                  ? 'border-sky-deep bg-sky-soft/40'
                  : 'border-line bg-card hover:border-muted-foreground/50'
              )}
            >
              <input
                type="radio"
                name="feedback-type"
                value={value}
                checked={feedbackType === value}
                onChange={() => setFeedbackType(value)}
                className="sr-only"
              />
              <span className="block text-[15px] font-bold text-ink">{FEEDBACK_TYPE_LABELS[value]}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{TYPE_DESCRIPTIONS[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="feedback-subject">Subject</Label>
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            {subject.length}/{SUBJECT_MAX}
          </span>
        </div>
        <Input
          id="feedback-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Printing cuts off the last column"
          maxLength={SUBJECT_MAX}
          aria-invalid={fieldErrors.subject ? true : undefined}
          aria-describedby={fieldErrors.subject ? 'feedback-subject-error' : undefined}
        />
        {fieldErrors.subject && (
          <p id="feedback-subject-error" role="alert" className="text-sm font-medium text-destructive">
            {fieldErrors.subject}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="feedback-details">Details</Label>
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            {details.length}/{DETAILS_MAX}
          </span>
        </div>
        <Textarea
          id="feedback-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="What happened, what did you expect, and the steps to see it again. For a feature, describe what it would do for your classroom."
          rows={6}
          maxLength={DETAILS_MAX}
          aria-invalid={fieldErrors.details ? true : undefined}
          aria-describedby={fieldErrors.details ? 'feedback-details-error' : undefined}
        />
        {fieldErrors.details && (
          <p id="feedback-details-error" role="alert" className="text-sm font-medium text-destructive">
            {fieldErrors.details}
          </p>
        )}
      </div>
      {submitError && (
        <p role="alert" className="text-[15px] font-medium text-destructive">
          {submitError}
        </p>
      )}
      <div>
        <Button type="submit" disabled={sending}>
          {sending ? 'Sending...' : 'Send message'}
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">
          Your message is emailed to the PatternSpell developer along with your email address and the app version, so it
          can be followed up if needed.
        </p>
      </div>
    </form>
  )
}
