'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number  // Animation duration in ms
  className?: string
  format?: boolean   // Use toLocaleString
}

export function AnimatedCounter({
  value,
  duration = 500,
  className = '',
  format = true
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const previousValue = useRef(value)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const startValue = previousValue.current
    const endValue = value
    const startTime = performance.now()

    // Don't animate if it's the first render or same value
    if (startValue === endValue) {
      setDisplayValue(endValue)
      return
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3)

      const current = Math.round(startValue + (endValue - startValue) * eased)
      setDisplayValue(current)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(endValue)
        previousValue.current = endValue
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration])

  // Update previous value when animation completes
  useEffect(() => {
    previousValue.current = value
  }, [value])

  return (
    <span className={className}>
      {format ? displayValue.toLocaleString() : displayValue}
    </span>
  )
}

// Animated percentage with smooth bar
interface AnimatedProgressProps {
  value: number  // 0-100
  className?: string
  barClassName?: string
}

export function AnimatedProgress({
  value,
  className = 'h-2 bg-bg rounded-full overflow-hidden',
  barClassName = 'h-full bg-accent'
}: AnimatedProgressProps) {
  return (
    <div className={className}>
      <div
        className={`${barClassName} transition-all duration-500 ease-out`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
