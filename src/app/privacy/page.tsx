import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How PatternSpell collects, uses, and protects your information.',
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

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen px-4 pt-24 pb-16 md:px-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-ink">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>

        <div className="mt-8">
          <Section id="who-we-are" title="Who we are">
            <p>
              PatternSpell (&ldquo;we,&rdquo; &ldquo;us&rdquo;) is a free spelling-list toolkit for K-3 teachers,
              operated by Donray Williams. If you have questions about this policy, contact{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section id="who-this-is-for" title="Who this service is for">
            <p>
              PatternSpell is built for <strong>adult educators</strong>. You must be at least 18 years old to create an
              account. The service is <strong>not directed at children</strong>, and children may not create accounts.
            </p>
            <p>
              Teachers use PatternSpell to prepare spelling lists and present them in the classroom. Students view the
              teacher&rsquo;s screen during guided practice; they do not sign up, log in, or enter information into the
              service themselves.
            </p>
          </Section>

          <Section id="what-we-collect" title="Information we collect">
            <p>We collect the minimum information needed to run the service:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Account information.</strong> When you sign in with Google, we receive your name, email address,
                and profile image from Google. When you sign in with email and password, we store the email address you
                provide. You may optionally add a preferred name, grade level, subject, school name, and classroom size
                to your profile.
              </li>
              <li>
                <strong>Your content.</strong> The spelling lists you create: patterns, words, example sentences, and
                keyword images. This content belongs to you.
              </li>
              <li>
                <strong>Analytics.</strong> We count page views and unique visitors so we can understand usage. A
                visitor is identified by a one-way salted hash of their IP address and browser type; we never store raw
                IP addresses. The hash cannot be reversed to identify you, and it is used only for aggregate counting,
                never for advertising or tracking across sites.
              </li>
              <li>
                <strong>Error reports.</strong> When something breaks, our error-reporting service may record technical
                details (browser type, the page you were on) so we can fix the bug.
              </li>
            </ul>
          </Section>

          <Section id="what-we-dont-collect" title="What we do not collect">
            <ul className="list-disc space-y-2 pl-6">
              <li>We do not offer student accounts and do not solicit information from children.</li>
              <li>We do not collect student names, grades, or performance data.</li>
              <li>We do not sell your information to anyone.</li>
              <li>We do not show third-party advertising and do not use your data for ad targeting.</li>
              <li>We do not collect payment information; the service is free.</li>
            </ul>
          </Section>

          <Section id="children" title="Children's privacy">
            <p>
              PatternSpell is not directed at children under 13, and we do not knowingly collect personal information
              from children. Because our analytics run on public pages, a classroom device displaying the site may be
              counted as a visitor; that count uses only the anonymous hash described above and is never linked to a
              child&rsquo;s identity.
            </p>
            <p>
              Our word-list fields are free text. Please do not enter student names or other personal information about
              children into your lists. If you are a teacher, you are responsible for what you type into the service.
            </p>
            <p>
              If you believe a child&rsquo;s personal information has been entered into the service, contact us at{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {CONTACT_EMAIL}
              </a>{' '}
              and we will delete it promptly. Parents may also contact us directly to review or request deletion of any
              such information.
            </p>
          </Section>

          <Section id="how-we-use" title="How we use information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Provide the service: sign you in, save your lists, and display them back to you.</li>
              <li>Understand aggregate usage through analytics.</li>
              <li>Fix bugs and keep the service reliable.</li>
              <li>Send transactional emails you request, such as sign-in verification and password resets.</li>
            </ul>
            <p>We do not use your information for marketing, and we do not share it with advertisers.</p>
          </Section>

          <Section id="third-parties" title="Third parties we rely on">
            <p>We use a small number of service providers to operate PatternSpell:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Google:</strong> if you choose Google sign-in, Google handles authentication and shares your
                name, email, and profile image with us.
              </li>
              <li>
                <strong>Amazon Web Services:</strong> hosts the app (Amplify), stores your data (DynamoDB), and manages
                email/password sign-in (Cognito), all in the United States.
              </li>
              <li>
                <strong>Sentry:</strong> error reporting, so we can find and fix bugs.
              </li>
            </ul>
            <p>
              These providers process data only to provide their service to us, under their own privacy policies and our
              agreements with them.
            </p>
          </Section>

          <Section id="retention" title="How long we keep information">
            <p>
              Your account data and lists are kept for as long as your account exists. If you delete your account, we
              delete your profile and lists. Analytics counts are kept indefinitely in aggregate form; because visitor
              identifiers are one-way hashes, they cannot be tied back to you.
            </p>
          </Section>

          <Section id="your-rights" title="Your rights">
            <p>You can at any time:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>View and edit your profile information in the app.</li>
              <li>Export or delete your word lists.</li>
              <li>
                Ask us to correct or delete your information by emailing{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </li>
            </ul>
          </Section>

          <Section id="security" title="Security">
            <p>
              We use industry-standard measures to protect your information, including encrypted connections (HTTPS) and
              authentication through established providers (Google, AWS Cognito). No method of transmission over the
              internet is completely secure, but we work to keep your data safe.
            </p>
          </Section>

          <Section id="changes" title="Changes to this policy">
            <p>
              If we change this policy in a way that affects how we handle your information, we will post the updated
              policy here and update the effective date above. Continued use of the service after changes take effect
              means you accept the updated policy.
            </p>
          </Section>

          <Section id="contact" title="Contact">
            <p>
              Questions about this policy or your information? Email{' '}
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
