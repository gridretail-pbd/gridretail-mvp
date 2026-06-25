'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { WIZARD_STEPS } from '../hooks/useWizardImportacion'

interface ProgressWizardProps {
  currentStep: number
}

export function ProgressWizard({ currentStep }: ProgressWizardProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isLast = index === WIZARD_STEPS.length - 1

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors',
                    isCompleted && 'bg-green-600 border-green-600 text-white',
                    isCurrent && 'bg-blue-600 border-blue-600 text-white',
                    !isCompleted && !isCurrent && 'bg-white border-gray-300 text-gray-500',
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span
                  className={cn(
                    'text-xs mt-1 text-center whitespace-nowrap',
                    isCurrent ? 'text-blue-600 font-medium' : 'text-gray-500',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 mt-[-16px]',
                    isCompleted ? 'bg-green-600' : 'bg-gray-200',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
