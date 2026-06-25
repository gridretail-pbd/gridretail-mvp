'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Auto-bloqueo por inactividad (Nivel 2). Solo se arma cuando `enabled` (modo
 * tienda). Tras `timeoutMs` sin actividad del usuario invoca `onLock` una vez.
 * Ver docs/SPEC_LOGIN_MODO_TIENDA.md §2.3 / §8.
 */

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

export function useInactivityLock({
  enabled,
  timeoutMs,
  onLock,
}: {
  enabled: boolean
  timeoutMs: number
  onLock: () => void
}) {
  const [remaining, setRemaining] = useState(timeoutMs)
  const lastActivity = useRef(0)
  const locked = useRef(false)
  const onLockRef = useRef(onLock)
  onLockRef.current = onLock

  const registrarActividad = useCallback(() => {
    lastActivity.current = Date.now()
  }, [])

  useEffect(() => {
    if (!enabled) return

    locked.current = false
    lastActivity.current = Date.now()
    setRemaining(timeoutMs)

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, registrarActividad, { passive: true })
    )

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - lastActivity.current
      const rem = Math.max(0, timeoutMs - elapsed)
      setRemaining(rem)
      if (rem <= 0 && !locked.current) {
        locked.current = true
        onLockRef.current()
      }
    }, 1000)

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, registrarActividad))
      window.clearInterval(interval)
    }
  }, [enabled, timeoutMs, registrarActividad])

  return { remaining }
}
