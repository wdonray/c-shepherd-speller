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

/**
 * Feedback attachments are screenshots only: one image per message, 5 MB
 * max. Limits from Donray's decision on issue #202. Shared by the form (for
 * client-side validation) and the API route (which enforces them again).
 */
export const FEEDBACK_ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024
export const FEEDBACK_ATTACHMENT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const
