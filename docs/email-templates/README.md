# Cognito email templates

PatternSpell-styled HTML emails for the Cognito user pool (`patternspell-users`, us-east-1). These are pasted into the Cognito console, not sent by the app.

## Which template goes where

Cognito uses the **Verification message** template for all three of our email flows (per AWS docs, all three map to the Verification message template):

| Flow                 | App API call             | Cognito template     |
| -------------------- | ------------------------ | -------------------- |
| Sign-up verification | `SignUp`                 | Verification message |
| Resend code          | `ResendConfirmationCode` | Verification message |
| Forgot password      | `ForgotPassword`         | Verification message |

Files:

- `verification.html` — sign-up and resend-code emails. Suggested subject: `Your PatternSpell verification code`.
- `forgot-password.html` — same design with reset-specific copy. Suggested subject: `Reset your PatternSpell password`. Use this if your console shows a separate forgot-password message entry; otherwise the verification template covers that flow too.

## Installing in the console

1. Cognito console > User pools > `patternspell-users` > **Messaging** > **Message templates**.
2. Edit the **Verification message** (and forgot-password entry, if shown separately).
3. Set verification type to **Code**.
4. Paste the subject line and the full HTML file contents into the message body.
5. Save.

## Placeholders

- `{####}` is the verification code. It must appear in the body when the verification type is Code, or Cognito refuses to save the template. Do not rename or reformat it; the surrounding HTML is fine.
- `{username}` is NOT available in the verification template, so it is not used here.

Constraints: max 20,000 UTF-8 characters per message (these are under 4,000). HTML with inline styles only, table layout, no external images, so the email renders in Gmail, Apple Mail, and Outlook.

## Sender and deliverability

These templates change what the email looks like, not who sends it. The pool currently sends from Cognito's default `no-reply@verificationemail.com`, which is a known spam-folder trigger and is capped at 50 emails/day per AWS account. For production, move the pool to SES:

1. SES console (us-east-1) > Verified identities > create a domain identity for `patternspell.org`, add the DKIM CNAME records to Route53.
2. SES > Account dashboard > Request production access (use case: transactional, account verification and password reset emails). Approval usually takes hours to a day.
3. Cognito > user pool > Messaging > Email > Edit > switch to **Send email with Amazon SES**, SES region us-east-1, FROM `PatternSpell <no-reply@patternspell.org>`.
4. Add SPF/DKIM/DMARC records for the domain (Route53) for best deliverability.

SES costs about $0.10 per 1,000 emails, so pennies at this scale.
