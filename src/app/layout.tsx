import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import SessionProvider from '@/components/providers/SessionProvider'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { ThemeProvider } from '@/components/ThemeProvider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Shepherd Speller',
  description: 'Interactive spelling application for learning and practicing spelling skills.',
  keywords: 'spelling, education, learning, interactive, practice, words',
  authors: [{ name: 'Donray Williams' }],
  creator: 'Donray Williams',
  publisher: 'Educational Tool',
  robots: 'index, follow',
  openGraph: {
    title: 'Shepherd Speller',
    description: 'Interactive spelling application for learning and practicing spelling skills.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shepherd Speller',
    description: 'Interactive spelling application for learning and practicing spelling skills.',
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
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}>
          <noscript>
            <div className="fixed inset-0 bg-background flex items-center justify-center p-4 z-50">
              <div className="text-center space-y-4">
                <h1 className="text-2xl font-bold">JavaScript Required</h1>
                <p className="text-muted-foreground">
                  Shepherd Speller requires JavaScript to function. Please enable it in your browser to continue.
                </p>
              </div>
            </div>
          </noscript>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <Header />
            <main className="min-h-screen container m-auto p-8">{children}</main>
            <Footer />
          </ThemeProvider>
        </body>
      </SessionProvider>
    </html>
  )
}
