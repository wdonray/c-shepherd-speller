import type { Metadata } from 'next'
import { Lexend } from 'next/font/google'
import './globals.css'
import SessionProvider from '@/components/providers/SessionProvider'
import { SiteChrome } from '@/components/SiteChrome'
import { ThemeProvider } from '@/components/ThemeProvider'
import AnalyticsTracker from '@/components/analytics-tracker'

const lexend = Lexend({
  variable: '--font-lexend',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
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
          </ThemeProvider>
        </body>
      </SessionProvider>
    </html>
  )
}
