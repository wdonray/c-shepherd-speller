import { NextResponse } from 'next/server'
import {
  COGNITO_ERROR_MESSAGES,
  CognitoAuthError,
  isCognitoEmailAuthConfigured,
  type CognitoErrorCode,
} from './cognito-auth'
import { reportError } from './report-error'

const STATUS_FOR_CODE: Record<CognitoErrorCode, number> = {
  'invalid-credentials': 401,
  'not-confirmed': 403,
  'email-in-use': 409,
  'invalid-code': 400,
  'expired-code': 410,
  'weak-password': 400,
  'too-many-attempts': 429,
  'invalid-input': 400,
  'not-configured': 503,
  'server-error': 500,
}

/**
 * 503 when the pool is not configured, null when email auth can proceed.
 * Every /api/auth/email/* route calls this first.
 */
export function requireEmailAuth(): NextResponse | null {
  if (isCognitoEmailAuthConfigured()) return null
  return NextResponse.json(
    { ok: false, code: 'not-configured', message: COGNITO_ERROR_MESSAGES['not-configured'] },
    { status: 503 }
  )
}

/**
 * Map a service failure to a JSON error response. Expected Cognito failures
 * (wrong code, weak password, ...) are user-facing and not reported;
 * unexpected ones go to Sentry.
 */
export function emailAuthErrorResponse(error: unknown, location: string): NextResponse {
  if (error instanceof CognitoAuthError) {
    if (error.code === 'server-error') reportError(error, { location })
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: STATUS_FOR_CODE[error.code] }
    )
  }
  reportError(error, { location })
  return NextResponse.json(
    { ok: false, code: 'server-error', message: COGNITO_ERROR_MESSAGES['server-error'] },
    { status: 500 }
  )
}
