import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config. Tests run against a production build
 * (`npm run start`) with DynamoDB Local as the database.
 *
 * Required environment (CI provides these; see .github/workflows/test.yml):
 *   DYNAMODB_ENDPOINT=http://localhost:8000
 *   NEXTAUTH_SECRET=<any secret, must match the app's>
 *   NEXTAUTH_URL=http://localhost:3000
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (dummy values are fine;
 *     the suite never hits Google)
 *   COGNITO_CLIENT_ID / COGNITO_CLIENT_SECRET / COGNITO_ISSUER (dummy values
 *     are fine; the suite never hits Cognito, it only renders the email
 *     sign-in button)
 *
 * Local run:
 *   1. Start DynamoDB Local and create tables (see README)
 *   2. npm run build
 *   3. npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
      AUTH_DYNAMODB_ID: process.env.AUTH_DYNAMODB_ID ?? 'AKIAIOSFODNN7EXAMPLE',
      AUTH_DYNAMODB_SECRET: process.env.AUTH_DYNAMODB_SECRET ?? 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'e2e-local-secret',
      NEXTAUTH_URL: 'http://localhost:3000',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? 'e2e-dummy',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? 'e2e-dummy',
      // Dummy Cognito pool so the sign-in page renders the email button in
      // E2E; the suite never redirects to the issuer.
      COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID ?? 'e2e-dummy',
      COGNITO_CLIENT_SECRET: process.env.COGNITO_CLIENT_SECRET ?? 'e2e-dummy',
      COGNITO_ISSUER: process.env.COGNITO_ISSUER ?? 'https://cognito-idp.us-east-1.amazonaws.com/e2e-dummy',
    },
  },
})
