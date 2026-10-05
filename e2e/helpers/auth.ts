/**
 * Test authentication helper for E2E tests.
 *
 * There is NO auth bypass in the application code. Instead, the tests mint a
 * REAL next-auth v4 JWT session token (the same JWE the Google OAuth flow
 * would produce) and set it as the `next-auth.session-token` cookie. The app
 * then treats the request as a genuinely authenticated session through the
 * normal middleware -> getServerSession path.
 *
 * Why this is safe for production:
 * - Minting requires NEXTAUTH_SECRET, which is only known to the test runner.
 * - No test-only code paths exist in the app; production behavior is unchanged.
 * - The CI E2E job runs against `next start` (a production build), so this
 *   exercises the exact session handling production uses.
 */
import { encode } from 'next-auth/jwt'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'

export const E2E_USER_ID = 'e2e-test-user'
export const E2E_USER_EMAIL = 'e2e@example.com'
export const E2E_USER_NAME = 'E2E Teacher'

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET must be set for E2E tests')
  return secret
}

/**
 * Creates (or replaces) the E2E test user in DynamoDB Local. Idempotent:
 * safe to call in beforeEach.
 *
 * Uses the same key format as src/lib/db-utils.ts getUserKeys().
 */
export async function ensureE2EUser(): Promise<void> {
  const client = DynamoDBDocument.from(
    new DynamoDB({
      region: 'us-east-1',
      endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
      credentials: {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },
    })
  )

  const uniqueId = E2E_USER_ID.replace('-user', '')
  await client.put({
    TableName: process.env.USER_TABLE_NAME ?? 'c-shepherd-users',
    Item: {
      PK: `${uniqueId}-user`,
      SK: `${uniqueId}-profile`,
      id: E2E_USER_ID,
      email: E2E_USER_EMAIL,
      name: E2E_USER_NAME,
      words: [],
      sounds: [],
      spelling: [],
    },
  })
}

/**
 * Mints a next-auth v4 JWT session token for the E2E user. Returns the
 * cookie value to set as `next-auth.session-token`.
 */
export async function mintSessionToken(): Promise<string> {
  return encode({
    secret: getSecret(),
    token: {
      sub: E2E_USER_ID,
      email: E2E_USER_EMAIL,
      name: E2E_USER_NAME,
    },
    maxAge: 30 * 24 * 60 * 60, // 30 days, matches next-auth default
  })
}

/** The cookie Playwright should set to act as the E2E user. */
export async function sessionCookie() {
  return {
    name: 'next-auth.session-token',
    value: await mintSessionToken(),
    domain: 'localhost',
    path: '/',
  }
}
