import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of PatternSpell.',
}

const EFFECTIVE_DATE = 'October 10, 2026'
const CONTACT_EMAIL = 'donrayxwilliams@gmail.com'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-8 first:mt-0">
      <h2 id={`${id}-heading`} className="text-xl font-bold text-ink">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-ink/90">{children}</div>
    </section>
  )
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen px-4 pt-24 pb-16 md:px-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-ink">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>

        <div className="mt-8">
          <Section id="acceptance" title="Acceptance of these terms">
            <p>
              By creating an account or using PatternSpell, you agree to these Terms of Service (&ldquo;Terms&rdquo;).
              If you do not agree, do not use the service. These Terms form a binding agreement between you and Donray
              Williams, the operator of PatternSpell.
            </p>
          </Section>

          <Section id="eligibility" title="Who may use PatternSpell">
            <p>
              PatternSpell is built for <strong>adult educators</strong>. You must be at least 18 years old to create an
              account or use the service. The service is <strong>not directed at children</strong>, and children may not
              create accounts.
            </p>
            <p>
              If you are a teacher, you may display the service in your classroom and guide students through practice
              activities. Students do not need accounts and should not create them.
            </p>
          </Section>

          <Section id="accounts" title="Your account">
            <p>
              You sign in with Google or with an email address and password. You are responsible for keeping your
              sign-in credentials confidential and for everything that happens under your account. Tell us promptly at{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {CONTACT_EMAIL}
              </a>{' '}
              if you believe your account has been compromised.
            </p>
          </Section>

          <Section id="educator-responsibilities" title="Your responsibilities as an educator">
            <p>By using PatternSpell with students, you represent that:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                You are an educator (or a parent or guardian) with the authority to use the service in your classroom or
                home.
              </li>
              <li>
                You have obtained any parental consents required by law for the way you use the service with students.
              </li>
              <li>
                You will not enter student names or other personal information about children into word lists or any
                other free-text field. You are solely responsible for any personal data you type into the service.
              </li>
              <li>
                You will handle any request from a parent to review or delete information related to their child, or
                direct the parent to contact us at the email address above.
              </li>
            </ul>
          </Section>

          <Section id="your-content" title="Your content">
            <p>
              The spelling lists you create belong to you. By using the service, you grant us a limited, worldwide
              license to host, store, and display your content solely to operate PatternSpell for you. We do not claim
              ownership of your lists, and we will not use them for any other purpose.
            </p>
          </Section>

          <Section id="acceptable-use" title="Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Use the service for any unlawful purpose.</li>
              <li>Upload content that is harassing, hateful, or infringes someone else&rsquo;s rights.</li>
              <li>Attempt to disrupt the service, scrape it aggressively, or inflate usage statistics.</li>
              <li>Share your account with others or let children create accounts.</li>
              <li>Misrepresent your identity or affiliation.</li>
            </ul>
          </Section>

          <Section id="service" title="The service is provided as is">
            <p>
              PatternSpell is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any
              kind. We do not guarantee that the service will be uninterrupted, error-free, or suitable for any
              particular educational outcome. We may modify or discontinue the service at any time.
            </p>
          </Section>

          <Section id="liability" title="Limitation of liability">
            <p>
              To the maximum extent permitted by law, Donray Williams will not be liable for any indirect, incidental,
              or consequential damages arising from your use of PatternSpell. Our total liability for any claim related
              to the service is limited to the amount you paid us, which is zero, since the service is free.
            </p>
          </Section>

          <Section id="indemnification" title="Indemnification">
            <p>
              You agree to indemnify and hold harmless Donray Williams from claims arising out of your use of the
              service, your content, or your violation of these Terms, including any claim related to your use of the
              service with students.
            </p>
          </Section>

          <Section id="termination" title="Termination">
            <p>
              You may stop using the service and delete your account at any time. We may suspend or terminate your
              account if you violate these Terms, including the educator responsibilities above. On termination, your
              right to use the service ends immediately.
            </p>
          </Section>

          <Section id="governing-law" title="Governing law">
            <p>
              These Terms are governed by the laws of the State of New Jersey, without regard to conflict-of-law
              principles. Any dispute will be resolved in the state or federal courts located in New Jersey.
            </p>
          </Section>

          <Section id="changes" title="Changes to these terms">
            <p>
              We may update these Terms from time to time. If the changes are material, we will post the updated Terms
              here and update the effective date above. Continued use of the service after changes take effect means you
              accept the updated Terms.
            </p>
          </Section>

          <Section id="contact" title="Contact">
            <p>
              Questions about these Terms? Email{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}
