<img src="src/app/icon.svg" alt="PatternSpell logo" width="64" height="64" />

# PatternSpell

[![Tests](https://github.com/wdonray/c-shepherd-speller/actions/workflows/test.yml/badge.svg)](https://github.com/wdonray/c-shepherd-speller/actions/workflows/test.yml)
[![Coverage: 100%](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/wdonray/c-shepherd-speller/actions/workflows/test.yml)

A login-gated web app for teachers to manage classroom spelling lists (words, sounds, spelling patterns) and store them in DynamoDB. Google OAuth and optional Cognito email/password handle sign-in.

> **Renamed:** this project was formerly called "Shepherd Speller". The repository name (`c-shepherd-speller`) and infrastructure names (DynamoDB tables, etc.) are intentionally unchanged; only the product name and branding are now PatternSpell.

## Status

This app was written in August 2025, never deployed, and has no users. A revival and modernization is in progress (October 2026). Setup below reflects the current state; see [Future](#future) for what is planned.

## Stack

- Next.js 15.4.6 (App Router), React 19, TypeScript
- Tailwind CSS v4, Radix/shadcn UI, next-themes (light/dark), zod
- next-auth v4 with the DynamoDB adapter, DynamoDB via AWS SDK v3
- oxlint for linting, prettier for formatting, husky + lint-staged hooks

## What exists today

- **Google OAuth sign-in** for teachers, with sign-in, sign-out, and error pages. An optional **Cognito email/password** sign-in appears as a second button once a User Pool is configured (see Setup). Routes outside `/api/*` redirect unauthenticated visitors to `/auth/signin` via middleware.
- **Teacher list manager**: a dashboard where the signed-in teacher manages their own lists of words, sounds, and spelling patterns (add, edit, delete), with JSON import/export, a profile dialog, and a light/dark theme toggle.
- **REST API** under `/api/users`:
  - `POST /api/users` and `GET /api/users?email=` (create, look up)
  - `GET` / `PUT /api/users/[id]` (read, update profile)
  - `GET` / `PUT /api/users/[id]/spelling` (read, update lists)
  - `POST /api/users/[id]/last-active` (activity ping)
- **Storage**: two DynamoDB tables, `c-shepherd-users` (teacher records) and `next-auth` (session/adapter data). Table names are overridable via `USER_TABLE_NAME` and `AUTH_TABLE_NAME`.
- **Testing**: 100% unit-test coverage (vitest, thresholds enforced in CI), Playwright E2E plus axe-core accessibility gates on every PR.

## Setup

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- Docker (for DynamoDB Local), or an AWS account with DynamoDB access
- Google OAuth credentials (for sign-in; the app's other pages work without them)

### Local development with DynamoDB Local (no AWS account needed)

```bash
# Install dependencies
npm install

# Copy the environment template and edit values as needed
cp .env.example .env.local

# Start DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Create the tables
npm run create-tables

# Verify the setup
npm run test-db

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `.env.example` already points `DYNAMODB_ENDPOINT` at `http://localhost:8000`; DynamoDB Local accepts any credentials.

### Using real AWS instead

Leave `DYNAMODB_ENDPOINT` unset and fill in `AUTH_DYNAMODB_REGION`, `AUTH_DYNAMODB_ID`, and `AUTH_DYNAMODB_SECRET` in `.env.local`. Then run `npm run create-tables` to create the tables in that region.

### Google OAuth setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one) and configure an OAuth consent screen
3. Create OAuth 2.0 client credentials (Web application)
4. Add `http://localhost:3000/api/auth/callback/google` to the authorized redirect URIs
5. Copy the Client ID and Client Secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`

### Cognito email/password setup (optional)

Adds a "Continue with email" button on the sign-in page. Teachers sign up and sign in with an email and password through Cognito's Hosted UI; no password handling lives in this codebase.

1. In the [Cognito console](https://console.aws.amazon.com/cognito/), create a User Pool:
   - Sign-in options: email (use email as the username, keep it a required attribute)
   - Password policy: Cognito defaults are fine
   - Email verification: required (Cognito sends the code; SES charges are pennies at this scale)
   - Pricing tier: Lite is enough (10,000 free MAU/month, then $0.0055/MAU; the app is far below the free tier)
2. Create an app client:
   - Confidential client, generate a client secret
   - Allowed OAuth flows: Authorization code grant
   - Allowed OAuth scopes: `openid`, `email`, `profile`
3. Under the Hosted UI / domain settings, create a Cognito domain prefix and add the callback and sign-out URLs:
   - `https://patternspell.org/api/auth/callback/cognito`
   - `https://patternspell.org/auth/signin`
   - plus `http://localhost:3000` equivalents for local dev
4. Copy the client ID, client secret, and the issuer URL (`https://cognito-idp.<region>.amazonaws.com/<user-pool-id>`) into `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, and `COGNITO_ISSUER` (Amplify env vars in production)

   Optional: to show the Hosted UI on a custom domain (e.g. `https://auth.patternspell.org`) instead of the default `amazoncognito.com` URL, add the custom domain to the user pool, then set `COGNITO_HOSTED_UI_DOMAIN` to its URL (also an Amplify env var in production). Leave it empty to use the pool's default domain.

The button only renders when all three variables are set, so Google-only deployments are unaffected. A teacher who signs in with both Google and email gets two separate accounts; they are not linked.

## Available scripts

```bash
npm run dev             # Start the development server
npm run build           # Build for production
npm run start           # Start the production server
npm run typecheck       # TypeScript type check (tsc --noEmit)
npm run lint            # Lint with oxlint
npm run lint:fix        # Lint and auto-fix
npm run format          # Format everything with prettier
npm run format:check    # Check formatting with prettier
npm run create-tables   # Create the DynamoDB tables (idempotent; see scripts/create-tables.mjs)
npm run test-db         # Test the DynamoDB connection and check required tables exist
npm run test:unit       # Vitest unit suite with 100% coverage thresholds (requires DynamoDB Local running; see below)
```

The unit suite needs DynamoDB Local for the auth-adapter regression test. Start it first (any credentials work locally), then create the tables:

```bash
docker run -p 8000:8000 amazon/dynamodb-local
DYNAMODB_ENDPOINT=http://localhost:8000 npm run create-tables
npm run test:unit
```

## Project structure

```
c-shepherd-speller/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/   # NextAuth route (Google + optional Cognito providers, DynamoDB adapter)
│   │   │   └── users/               # User and spelling-data API routes
│   │   ├── auth/                    # signin, signout, error, verify-request pages
│   │   ├── layout.tsx               # Root layout
│   │   └── page.tsx                 # Teacher dashboard (signed-in)
│   ├── components/                  # SpellingManager, dialogs, shadcn/ui primitives
│   ├── lib/                         # DynamoDB client, db-utils, helpers
│   ├── models/                      # User schema and table key constants
│   ├── types/                       # TypeScript type extensions
│   └── middleware.ts                # Redirects unauthenticated page visits to sign-in
├── scripts/
│   ├── create-tables.mjs            # DynamoDB table bootstrap
│   └── test-db.mjs                  # DynamoDB connection diagnostic
├── public/                          # Static assets
└── package.json
```

## Future

Planned next, in this order:

1. **Harden the list manager** (F1): input validation, empty states, import error handling, and general reliability of the existing CRUD flows. No new top-level features.
2. **Big-screen display mode** (F2): a route the teacher opens on a projector or smartboard that shows **all the words in the active list at once**, in large high-contrast type, while the kids spell. No paging, no manual advance, no timers, no scoring; the teacher runs the spelling verbally from the full list.

Explicitly out of scope: student accounts, student-facing practice or quizzes, games, analytics, and mobile apps.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

PR titles follow [conventional commits](https://www.conventionalcommits.org/), and PR bodies use `## What` / `## Why` / `## How` sections. Run the formatter before pushing.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

Built with Next.js 15, TypeScript, Tailwind CSS, DynamoDB, and NextAuth.js.
