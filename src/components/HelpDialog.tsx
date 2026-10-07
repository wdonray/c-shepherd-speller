'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface HelpDialogProps {
  isOpen: boolean
  onClose: () => void
}

const FAQS = [
  {
    question: 'What is a pattern chart?',
    answer:
      'One column per spelling of a target sound. Wider columns are more common spellings, so students see at a glance which spelling to try first.',
  },
  {
    question: 'How do I show a list on the projector?',
    answer:
      'Open Present chart for a list. The chart stays light and large even in dark mode, so it reads clearly from the back of the room.',
  },
  {
    question: 'Can students practice on their own devices?',
    answer:
      'Practice mode is teacher-led for now. Students answer on the classroom device while you guide the review queue.',
  },
  {
    question: 'Where is my data stored?',
    answer:
      'In your PatternSpell account. Exports download as a JSON backup file you can keep or move to another account.',
  },
  {
    question: 'Does PatternSpell work offline?',
    answer: 'List viewing works once loaded. Text-to-speech and sentence lookup need an internet connection.',
  },
  {
    question: 'What does "odd duck" mean?',
    answer:
      'A word whose spelling does not follow the pattern, like "said" for long a. Mark odd ducks so students learn them as exceptions.',
  },
]

export default function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-ink">Get help</DialogTitle>
          <DialogDescription className="text-[15px] leading-6 text-muted-foreground">
            Quick answers for the classroom, plus troubleshooting when something is not working.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 pt-2">
          <section>
            <h3 className="text-lg font-bold text-ink">Quick start</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-6 text-[15px] leading-6 text-ink">
              <li>
                <strong>Create a list:</strong> pick one target sound, like long a, and name the list for your week.
              </li>
              <li>
                <strong>Add patterns:</strong> add one column per spelling and size each column by how common the
                spelling is.
              </li>
              <li>
                <strong>Present and practice:</strong> project the pattern chart for the class, then run practice mode
                with the review queue.
              </li>
            </ol>
          </section>

          <section>
            <h3 className="text-lg font-bold text-ink">Frequently asked questions</h3>
            <div className="mt-2 space-y-2">
              {FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="rounded-2xl border-2 border-line bg-card px-4 py-3 text-[15px] leading-6"
                >
                  <summary className="cursor-pointer font-semibold text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60">
                    {faq.question}
                  </summary>
                  <p className="mt-2 text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold text-ink">Troubleshooting</h3>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-[15px] leading-6 text-ink">
              <li>
                <strong>No voice?</strong> Check your device volume and use Chrome for the best voices.
              </li>
              <li>
                <strong>Lists not loading?</strong> Check your connection and press Try again.
              </li>
              <li>
                <strong>Signed out unexpectedly?</strong> Sign back in with the same Google account.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-ink">Contact</h3>
            <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
              Still stuck? Contact support at [SUPPORT CONTACT TBD].
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
