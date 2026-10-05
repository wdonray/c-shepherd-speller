import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { DynamoDBAdapter } from '@next-auth/dynamodb-adapter'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { client } from './dynamodb'

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

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
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
