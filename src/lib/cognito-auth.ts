/**
 * Server-side Cognito email/password operations for the custom auth pages.
 *
 * Everything here runs on the server only: the client secret, the
 * SECRET_HASH computation, and every AWS SDK call. Client components must
 * never import this module (it would bundle the AWS SDK and the secret
 * handling into the browser). Pages talk to it through the
 * /api/auth/email/* route handlers, and the next-auth Credentials provider
 * calls it from `authorize()`.
 */
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  DeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { createHmac } from 'node:crypto'

/** Minimal surface of the SDK client, so tests can inject a mock. */
export type CognitoIdpClient = Pick<CognitoIdentityProviderClient, 'send'>

export type CognitoErrorCode =
  | 'invalid-credentials'
  | 'not-confirmed'
  | 'email-in-use'
  | 'invalid-code'
  | 'expired-code'
  | 'weak-password'
  | 'too-many-attempts'
  | 'invalid-input'
  | 'not-configured'
  | 'server-error'

/** User-facing copy for each failure mode. No em dashes. */
export const COGNITO_ERROR_MESSAGES: Record<CognitoErrorCode, string> = {
  'invalid-credentials': 'Incorrect email or password. Check both and try again.',
  'not-confirmed': 'This account is not verified yet. Enter the code from your email.',
  'email-in-use': 'An account with this email already exists. Try signing in instead.',
  'invalid-code': 'That code is not right. Check the email and try again.',
  'expired-code': 'That code has expired. Request a new one and try again.',
  'weak-password': 'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.',
  'too-many-attempts': 'Too many attempts. Wait a few minutes and try again.',
  'invalid-input': 'Something in that form is not valid. Check the fields and try again.',
  'not-configured': 'Email sign-in is not set up yet. Try signing in with Google instead.',
  'server-error': 'Something went wrong on our end. Try again in a moment.',
}

export class CognitoAuthError extends Error {
  readonly code: CognitoErrorCode

  constructor(code: CognitoErrorCode, message: string = COGNITO_ERROR_MESSAGES[code]) {
    super(message)
    this.name = 'CognitoAuthError'
    this.code = code
  }
}

function toErrorCode(error: unknown): CognitoErrorCode {
  const name = (error as { name?: unknown } | null)?.name
  switch (name) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      // Deliberately the same message: never reveal whether an email is registered.
      return 'invalid-credentials'
    case 'UserNotConfirmedException':
      return 'not-confirmed'
    case 'UsernameExistsException':
      return 'email-in-use'
    case 'CodeMismatchException':
      return 'invalid-code'
    case 'ExpiredCodeException':
      return 'expired-code'
    case 'InvalidPasswordException':
      return 'weak-password'
    case 'TooManyRequestsException':
    case 'LimitExceededException':
      return 'too-many-attempts'
    case 'InvalidParameterException':
      return 'invalid-input'
    default:
      return 'server-error'
  }
}

/** Normalize any thrown value into a CognitoAuthError with user-safe copy. */
export function toCognitoAuthError(error: unknown): CognitoAuthError {
  if (error instanceof CognitoAuthError) return error
  const code = toErrorCode(error)
  return new CognitoAuthError(code)
}

interface CognitoConfig {
  clientId: string
  clientSecret: string
  region: string
}

/** Extract the AWS region from a cognito-idp issuer URL, defaulting to us-east-1. */
export function parseCognitoRegion(issuer: string): string {
  return issuer.match(/^https:\/\/cognito-idp\.([^.]+)\.amazonaws\.com\//)?.[1] ?? 'us-east-1'
}

function cognitoConfig(): CognitoConfig {
  const clientId = process.env.COGNITO_CLIENT_ID
  const clientSecret = process.env.COGNITO_CLIENT_SECRET
  const issuer = process.env.COGNITO_ISSUER
  if (!clientId || !clientSecret || !issuer) {
    throw new CognitoAuthError('not-configured')
  }
  return { clientId, clientSecret, region: parseCognitoRegion(issuer) }
}

/** True when the pool is configured well enough to offer email auth. */
export function isCognitoEmailAuthConfigured(): boolean {
  return Boolean(process.env.COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_SECRET && process.env.COGNITO_ISSUER)
}

let cachedClient: CognitoIdentityProviderClient | null = null

function getClient(): CognitoIdentityProviderClient {
  if (!cachedClient) {
    cachedClient = new CognitoIdentityProviderClient({ region: cognitoConfig().region })
  }
  return cachedClient
}

/**
 * Cognito's SECRET_HASH for confidential app clients:
 * base64(HMAC-SHA256(key = client secret, message = username + client id)).
 */
export function computeSecretHash(username: string, clientId: string, clientSecret: string): string {
  return createHmac('sha256', clientSecret)
    .update(username + clientId)
    .digest('base64')
}

export interface CognitoUser {
  sub: string
  email: string
  name: string | null
}

function decodeIdToken(idToken: string): { sub: string; email?: string; name?: string } {
  const payload = idToken.split('.')[1]
  if (!payload) throw new CognitoAuthError('server-error')
  let claims: unknown
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    throw new CognitoAuthError('server-error')
  }
  const { sub, email, name } = claims as { sub?: unknown; email?: unknown; name?: unknown }
  if (typeof sub !== 'string' || sub.length === 0) throw new CognitoAuthError('server-error')
  return {
    sub,
    email: typeof email === 'string' ? email : undefined,
    name: typeof name === 'string' ? name : undefined,
  }
}

/**
 * Sign in with email and password (USER_PASSWORD_AUTH). Returns the Cognito
 * user identity from the ID token. Passwords are never logged or persisted.
 */
export async function cognitoSignIn(
  email: string,
  password: string,
  client: CognitoIdpClient = getClient()
): Promise<CognitoUser> {
  const { clientId, clientSecret } = cognitoConfig()
  const username = email.trim().toLowerCase()
  try {
    const response = await client.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: computeSecretHash(username, clientId, clientSecret),
        },
      })
    )
    const idToken = response.AuthenticationResult?.IdToken
    if (response.ChallengeName || !idToken) {
      // No secondary challenges are part of this flow; anything else is unexpected.
      throw new CognitoAuthError('server-error')
    }
    const claims = decodeIdToken(idToken)
    return { sub: claims.sub, email: claims.email ?? username, name: claims.name ?? null }
  } catch (error) {
    throw toCognitoAuthError(error)
  }
}

/** Register a new teacher. The pool requires email verification, so callers route to the verify page next. */
export async function cognitoSignUp(
  name: string,
  email: string,
  password: string,
  client: CognitoIdpClient = getClient()
): Promise<{ userConfirmed: boolean }> {
  const { clientId, clientSecret } = cognitoConfig()
  const username = email.trim().toLowerCase()
  try {
    const response = await client.send(
      new SignUpCommand({
        ClientId: clientId,
        SecretHash: computeSecretHash(username, clientId, clientSecret),
        Username: username,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: username },
          { Name: 'name', Value: name.trim() },
        ],
      })
    )
    return { userConfirmed: response.UserConfirmed ?? false }
  } catch (error) {
    throw toCognitoAuthError(error)
  }
}

/** Confirm a new account with the emailed 6-digit code. */
export async function cognitoConfirmSignUp(
  email: string,
  code: string,
  client: CognitoIdpClient = getClient()
): Promise<void> {
  const { clientId, clientSecret } = cognitoConfig()
  const username = email.trim().toLowerCase()
  try {
    await client.send(
      new ConfirmSignUpCommand({
        ClientId: clientId,
        SecretHash: computeSecretHash(username, clientId, clientSecret),
        Username: username,
        ConfirmationCode: code.trim(),
      })
    )
  } catch (error) {
    throw toCognitoAuthError(error)
  }
}

/** Resend the account-verification code. */
export async function cognitoResendConfirmationCode(
  email: string,
  client: CognitoIdpClient = getClient()
): Promise<void> {
  const { clientId, clientSecret } = cognitoConfig()
  const username = email.trim().toLowerCase()
  try {
    await client.send(
      new ResendConfirmationCodeCommand({
        ClientId: clientId,
        SecretHash: computeSecretHash(username, clientId, clientSecret),
        Username: username,
      })
    )
  } catch (error) {
    throw toCognitoAuthError(error)
  }
}

/** Start a password reset (Cognito emails the code). */
export async function cognitoForgotPassword(email: string, client: CognitoIdpClient = getClient()): Promise<void> {
  const { clientId, clientSecret } = cognitoConfig()
  const username = email.trim().toLowerCase()
  try {
    await client.send(
      new ForgotPasswordCommand({
        ClientId: clientId,
        SecretHash: computeSecretHash(username, clientId, clientSecret),
        Username: username,
      })
    )
  } catch (error) {
    throw toCognitoAuthError(error)
  }
}

/** Finish a password reset with the emailed code and the new password. */
export async function cognitoResetPassword(
  email: string,
  code: string,
  newPassword: string,
  client: CognitoIdpClient = getClient()
): Promise<void> {
  const { clientId, clientSecret } = cognitoConfig()
  const username = email.trim().toLowerCase()
  try {
    await client.send(
      new ConfirmForgotPasswordCommand({
        ClientId: clientId,
        SecretHash: computeSecretHash(username, clientId, clientSecret),
        Username: username,
        ConfirmationCode: code.trim(),
        Password: newPassword,
      })
    )
  } catch (error) {
    throw toCognitoAuthError(error)
  }
}

/**
 * Verify the caller's Cognito password and return a fresh access token.
 * Used as re-authentication before destructive actions like account deletion:
 * a wrong password throws CognitoAuthError('invalid-credentials') and nothing
 * is mutated. The returned token is short-lived; use it promptly.
 */
export async function cognitoVerifyPassword(
  email: string,
  password: string,
  client: CognitoIdpClient = getClient()
): Promise<string> {
  const { clientId, clientSecret } = cognitoConfig()
  const username = email.trim().toLowerCase()
  try {
    const response = await client.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          SECRET_HASH: computeSecretHash(username, clientId, clientSecret),
        },
      })
    )
    const accessToken = response.AuthenticationResult?.AccessToken
    if (response.ChallengeName || !accessToken) {
      // No secondary challenges are part of this flow; anything else is unexpected.
      throw new CognitoAuthError('server-error')
    }
    return accessToken
  } catch (error) {
    throw toCognitoAuthError(error)
  }
}

/**
 * Delete the caller's own Cognito user with a fresh access token (from
 * cognitoVerifyPassword). This is the self-service DeleteUser API, so no IAM
 * permissions are needed. Deleting an already-deleted user is a no-op, which
 * keeps deletion retries idempotent.
 */
export async function cognitoDeleteUser(accessToken: string, client: CognitoIdpClient = getClient()): Promise<void> {
  try {
    await client.send(new DeleteUserCommand({ AccessToken: accessToken }))
  } catch (error) {
    if ((error as { name?: unknown } | null)?.name === 'UserNotFoundException') return
    throw toCognitoAuthError(error)
  }
}
