import * as Sentry from '@sentry/nextjs'
import { sentryBeforeSend } from '@/lib/report-error'

// Error tracking only. No tracing, no session replay.
// The SDK no-ops when the DSN is undefined (local dev).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Transient connectivity blips (device briefly offline) are environmental
  // noise, not app bugs. Drop them before they reach Sentry.
  beforeSend: sentryBeforeSend,
})
