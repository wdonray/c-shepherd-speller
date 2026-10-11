import { z } from 'zod'

/** What the feedback form can send. Shared by the form and the API route. */
export const FeedbackTypeSchema = z.enum(['issue', 'feature'])
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>

export const FeedbackSchema = z.object({
  type: FeedbackTypeSchema,
  subject: z
    .string()
    .trim()
    .min(3, 'Give your message a short subject.')
    .max(120, 'Keep the subject under 120 characters.'),
  details: z
    .string()
    .trim()
    .min(10, 'Describe it in a little more detail (at least 10 characters).')
    .max(5000, 'Keep the details under 5000 characters.'),
})
export type FeedbackInput = z.infer<typeof FeedbackSchema>

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  issue: 'Report an issue',
  feature: 'Request a feature',
}
