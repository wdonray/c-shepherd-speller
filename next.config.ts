import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

// Modeled on donray.dev's header set. Notes on the CSP for this app:
// - Google OAuth is a full-page redirect to accounts.google.com (top-level
//   navigation, not fetch/iframe), so no Google origins are needed here.
// - next/font/google self-hosts the font files, so no font CDN is needed.
// - All next-auth traffic is same-origin (/api/auth/*), covered by 'self'.
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.github.com https://*.ingest.us.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: 'donray-williams',
  project: 'patternspell',
  // Error tracking only: no sourcemap upload, no release tracking.
  sourcemaps: { disable: true },
  release: { create: false },
  silent: true,
})
