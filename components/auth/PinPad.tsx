'use client'

import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Teclado numérico para ingresar el PIN (Nivel 2). Controlado: el padre maneja
 * `value`. Optimizado para pantalla táctil de tienda (botones grandes).
 */

interface PinPadProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  error?: boolean
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function PinPad({ value, onChange, length = 6, disabled, error }: PinPadProps) {
  function press(digit: string) {
    if (disabled) return
    if (value.length >= length) return
    onChange(value + digit)
  }

  function backspace() {
    if (disabled) return
    onChange(value.slice(0, -1))
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Indicador de dígitos */}
      <div className={cn('flex gap-3', error && 'animate-pulse')}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-colors',
              i < value.length
                ? error
                  ? 'border-destructive bg-destructive'
                  : 'border-primary bg-primary'
                : 'border-muted-foreground/40'
            )}
          />
        ))}
      </div>

      {/* Teclado */}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            disabled={disabled}
            className="h-16 w-16 rounded-full border bg-background text-2xl font-semibold transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
          >
            {k}
          </button>
        ))}
        <span />
        <button
          type="button"
          onClick={() => press('0')}
          disabled={disabled}
          className="h-16 w-16 rounded-full border bg-background text-2xl font-semibold transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          disabled={disabled || value.length === 0}
          className="flex h-16 w-16 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:scale-95 disabled:opacity-30"
          aria-label="Borrar"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
