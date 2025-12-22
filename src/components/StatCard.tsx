import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string | number
  subValue?: string
  delay?: number
}

export default function StatCard({ icon, label, value, subValue, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="stat-card group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-surface-hover border border-border group-hover:border-border-light transition-colors">
          {icon}
        </div>
      </div>
      <p className="text-muted text-sm mb-1">{label}</p>
      <p className="text-3xl font-semibold text-primary tracking-tight">
        {typeof value === 'number' ? new Intl.NumberFormat().format(value) : value}
      </p>
      {subValue && (
        <p className="text-secondary text-sm mt-1">{subValue}</p>
      )}
    </motion.div>
  )
}
