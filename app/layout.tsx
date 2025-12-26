import './globals.css'
import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FiveM Metrics',
  description: 'Track FiveM servers and resources in real-time',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-bg/80 backdrop-blur-lg border-b border-border">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg">FiveM Metrics</Link>
            <div className="flex gap-6">
              <Link href="/" className="text-sm text-muted hover:text-white transition-colors">Home</Link>
              <Link href="/servers" className="text-sm text-muted hover:text-white transition-colors">Servers</Link>
              <Link href="/resources" className="text-sm text-muted hover:text-white transition-colors">Resources</Link>
              <Link href="/api-docs" className="text-sm text-muted hover:text-white transition-colors">API</Link>
            </div>
          </div>
        </nav>
        <main className="pt-14">{children}</main>
      </body>
    </html>
  )
}
