'use client'

import { Package } from 'lucide-react'
import Link from 'next/link'

export default function ResourcesPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Resources</h1>
      <p className="text-muted mb-8">Resource tracking</p>

      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Package size={48} className="text-muted mx-auto mb-4" />
        <h2 className="text-xl font-medium mb-2">Resource Tracking Coming Soon</h2>
        <p className="text-muted mb-6">
          Resource data is not currently available in the FiveM API stream.
          <br />
          We're working on alternative methods to track resources.
        </p>
        <Link
          href="/servers"
          className="inline-block px-6 py-2 bg-accent text-black rounded-lg hover:bg-accent/90 transition-colors"
        >
          Browse Servers
        </Link>
      </div>
    </div>
  )
}
