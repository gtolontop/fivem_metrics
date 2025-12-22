import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import Navbar from './Navbar'
import { useStats } from '../hooks/useStats'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { stats } = useStats()

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="pt-20"
      >
        {children}
      </motion.main>
      <footer className="border-t border-border py-8 mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted text-sm">
              FiveM Metrics
            </p>
            <p className="text-muted text-sm">
              {stats ? (
                <>Tracking {stats.totalServers.toLocaleString()} servers worldwide</>
              ) : (
                <>Loading...</>
              )}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
