import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CognitoProvider from 'next-auth/providers/cognito'
import CredentialsProvider from 'next-auth/providers/credentials'
import { DynamoDBAdapter } from '@next-auth/dynamodb-adapter'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { client } from './dynamodb'
import { CognitoAuthError, cognitoSignIn, isCognitoEmailAuthConfigured } from './cognito-auth'

// The low-level client comes from the shared connection manager so the auth
// route honors DYNAMODB_ENDPOINT (DynamoDB Local) and optional credentials
// exactly like the rest of the app. Wrapped as a document client for the
// v4-line adapter (@next-auth/dynamodb-adapter), which expects DynamoDBDocument.
const docClient = DynamoDBDocument.from(client, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
})

/**
 * Endpoint overrides that point a Cognito provider at a custom hosted-UI
 * domain instead of the default amazoncognito.com URL.
 *
 * next-auth's CognitoProvider discovers its endpoints from the pool's OIDC
 * discovery document, which only advertises the default domain. Setting
 * `wellKnown` to undefined bypasses discovery so the explicit endpoints are
 * used. Everything else matches the discovered configuration: `issuer` (set
 * by the caller) keeps ID-token `iss` validation working, `jwks_endpoint`
 * is the pool's standard JWKS location, and no authorization params are
 * added, so openid-client's defaults (scope `openid`, response_type `code`)
 * apply exactly as they do without the override.
 */
function cognitoCustomDomainOptions(hostedUiDomain: string, issuer: string) {
  const domain = hostedUiDomain.replace(/\/+$/, '')
  return {
    wellKnown: undefined,
    authorization: `${domain}/oauth2/authorize`,
    token: `${domain}/oauth2/token`,
    userinfo: `${domain}/oauth2/userInfo`,
    jwks_endpoint: `${issuer}/.well-known/jwks.json`,
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Email/password sign-in via a Cognito User Pool. The provider is only
    // registered when the pool is configured, so the sign-in page keeps
    // showing just Google until then. See README "Cognito email/password
    // setup" for the pool settings these map to.
    //
    // COGNITO_HOSTED_UI_DOMAIN optionally points the OAuth endpoints at a
    // custom hosted-UI domain (e.g. https://auth.patternspell.org) instead of
    // the default amazoncognito.com URL. The pool's OIDC discovery document
    // only knows the default domain, so discovery is bypassed and the
    // endpoints are pinned explicitly. `issuer` stays the cognito-idp URL so
    // ID-token `iss` validation still passes, and `jwks_endpoint` keeps the
    // signature check working. Authorization params are left untouched, so
    // the login flow is byte-for-byte the same apart from the host.
    ...(process.env.COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_SECRET && process.env.COGNITO_ISSUER
      ? [
          CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID,
            clientSecret: process.env.COGNITO_CLIENT_SECRET,
            issuer: process.env.COGNITO_ISSUER,
            ...(process.env.COGNITO_HOSTED_UI_DOMAIN
              ? cognitoCustomDomainOptions(process.env.COGNITO_HOSTED_UI_DOMAIN, process.env.COGNITO_ISSUER)
              : {}),
          }),
        ]
      : []),
    // Custom email/password pages (under /auth/email) authenticate through
    // this Credentials provider. authorize() runs server-side against the
    // Cognito user pool, so passwords never touch the browser beyond the
    // form post to next-auth's own callback endpoint. Thrown error messages
    // surface as the signIn() error, so they are machine-readable codes the
    // custom sign-in page maps to friendly copy.
    ...(isCognitoEmailAuthConfigured()
      ? [
          CredentialsProvider({
            id: 'email-password',
            name: 'Email',
            credentials: {
              email: { label: 'Email', type: 'email' },
              password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
              const email = typeof credentials?.email === 'string' ? credentials.email : ''
              const password = typeof credentials?.password === 'string' ? credentials.password : ''
              if (!email || !password) return null
              try {
                const user = await cognitoSignIn(email, password)
                return { id: user.sub, email: user.email, name: user.name }
              } catch (error) {
                if (error instanceof CognitoAuthError) throw new Error(error.code)
                throw new Error('server-error')
              }
            },
          }),
        ]
      : []),
  ],
  adapter: DynamoDBAdapter(docClient, {
    tableName: process.env.AUTH_TABLE_NAME || 'next-auth',
  }),
  session: { strategy: 'jwt' as const },
  callbacks: {
    async session({ session, token }) {
      // Add user ID to session
      if (session.user) {
        session.user.id = token.sub!
      }
      return session
    },
    async jwt({ token, user }) {
      // Add user ID to token
      if (user) {
        token.sub = user.id
      }
      return token
    },
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
