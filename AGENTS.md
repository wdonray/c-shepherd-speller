# AGENTS.md

Operating notes for AI agents working in this repo. Donray is the owner;
he decides, you execute. He verifies your work as a habit, be precise.

## Workflow

- **One PR per task.** Small, focused PRs. Merge as soon as all required CI
  checks are green; do not wait for human review and do not let green PRs sit.
- **Run formatting before the first push:** `npm run format` (prettier).
- **PR titles follow conventional commits.** PR bodies use
  `## What` / `## Why` / `## How` sections.
- **Screenshots gate UI changes but are never committed.** Take local
  Playwright screenshots to review UI changes, show them in chat, keep them
  out of the repo.
- **No em dashes in user-facing copy.** Use commas, colons, or split the
  sentence instead.
- **Keep the public surface truthful.** If a feature does not exist, do not
  document it as if it does.

## Local development loop (DynamoDB Local, no AWS account)

1. `cp .env.example .env.local`
2. `docker run -p 8000:8000 amazon/dynamodb-local`
3. `npm run create-tables` (idempotent; creates `c-shepherd-users` and
   `next-auth`, honoring `DYNAMODB_ENDPOINT`, `USER_TABLE_NAME`,
   `AUTH_TABLE_NAME`)
4. `npm run test-db` to verify the connection and table presence
5. `npm run dev`

`DYNAMODB_ENDPOINT` set routes DynamoDB traffic to the local instance;
unset it and set `AUTH_DYNAMODB_REGION`/`AUTH_DYNAMODB_ID`/
`AUTH_DYNAMODB_SECRET` to use real AWS. Local DynamoDB accepts any
credentials.

## Stack

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS v4, Radix/shadcn UI, next-themes, zod
- next-auth v4 + DynamoDB adapter, Google OAuth, DynamoDB via AWS SDK v3
- oxlint for linting, prettier for formatting, husky + lint-staged hooks
