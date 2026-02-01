'use client'

import { ArrowUp, ArrowDown } from 'lucide-react'

interface QuotaDifferenceIndicatorProps {
  diferencia: number
  showPercentage?: boolean
  baseValue?: number
  size?: 'sm' | 'md' | 'lg'
}

export function QuotaDifferenceIndicator({
  diferencia,
  showPercentage = false,
  baseValue,
  size = 'md'
}: QuotaDifferenceIndicatorProps) {
  if (diferencia === 0) {
    return <span className="text-gray-400">-</span>
  }

  const isPositive = diferencia > 0
  const percentage =
    baseValue && baseValue > 0
      ? ((diferencia / baseValue) * 100).toFixed(1)
      : null

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold'
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  return (
    <span
      className={`flex items-center gap-0.5 font-medium ${sizeClasses[size]} ${
        isPositive ? 'text-green-600' : 'text-orange-500'
      }`}
    >
      {isPositive ? '+' : ''}
      {diferencia}
      {isPositive ? (
        <ArrowUp className={iconSizes[size]} />
      ) : (
        <ArrowDown className={iconSizes[size]} />
      )}
      {showPercentage && percentage && (
        <span className="text-xs ml-1">
          ({isPositive ? '+' : ''}
          {percentage}%)
        </span>
      )}
    </span>
  )
}
