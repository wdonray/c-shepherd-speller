import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    // API routes get a JSON 401; pages redirect to the signin page.
    // Route-level require-auth checks remain the primary gate; this is the backstop.
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - / (the public landing page; signed-in visitors are redirected
     *   client-side to /home)
     * - api/auth (next-auth's own routes handle their own auth and must stay
     *   reachable unauthenticated: signin, callback, session, etc.)
     * - api/version (the public version endpoint; the new-version reload
     *   prompt polls it from every page, including signed-out sessions)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, apple-icon.png, icon.png, icon.svg (icon files for browsers and home-screen shortcuts)
     * - auth (authentication pages)
     * - privacy, terms (public legal pages; must stay readable without sign-in)
     */
    '/((?!$|api/auth|api/version|_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|icon.svg|auth|privacy|terms).*)',
  ],
}
