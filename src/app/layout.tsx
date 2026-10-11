import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import SessionProvider from '@/components/providers/SessionProvider'
import { SiteChrome } from '@/components/SiteChrome'
import { ThemeProvider } from '@/components/ThemeProvider'
import AnalyticsTracker from '@/components/analytics-tracker'
import { ErrorToaster } from '@/components/error-toaster'
import { VersionReloadToast } from '@/components/version-reload-toast'

const lexend = localFont({
  variable: '--font-lexend',
  display: 'swap',
  // Vendored under src/fonts (see README there): next/font/google fetched
  // this at build time and broke the build whenever the fetch failed.
  src: [
    {
      path: '../fonts/lexend-latin-variable.woff2',
      weight: '100 900',
      style: 'normal',
    },
  ],
})

export const metadata: Metadata = {
  title: 'PatternSpell',
  description: 'Pattern-based spelling instruction for K-3 classrooms.',
  keywords: 'spelling, education, learning, interactive, practice, words',
  authors: [{ name: 'Donray Williams' }],
  creator: 'Donray Williams',
  publisher: 'Educational Tool',
  robots: 'index, follow',
  openGraph: {
    title: 'PatternSpell',
    description: 'Pattern-based spelling instruction for K-3 classrooms.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PatternSpell',
    description: 'Pattern-based spelling instruction for K-3 classrooms.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://accounts.google.com" />
        <link rel="dns-prefetch" href="https://accounts.google.com" />
      </head>
      <SessionProvider>
        <body className={`${lexend.variable} antialiased bg-background`}>
          <noscript>
            <div className="fixed inset-0 bg-background flex items-center justify-center p-4 z-50">
              <div className="text-center space-y-4">
                <h1 className="text-2xl font-bold">JavaScript Required</h1>
                <p className="text-muted-foreground">
                  PatternSpell requires JavaScript to function. Please enable it in your browser to continue.
                </p>
              </div>
            </div>
          </noscript>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <SiteChrome>{children}</SiteChrome>
            <AnalyticsTracker />
            <ErrorToaster />
            <VersionReloadToast />
          </ThemeProvider>
        </body>
      </SessionProvider>
    </html>
  )
}
