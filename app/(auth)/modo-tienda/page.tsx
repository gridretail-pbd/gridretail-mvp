'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Laptop, Loader2, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PinPad } from '@/components/auth/PinPad'
import { RosterTienda } from '@/components/auth/RosterTienda'
import {
  establecerPin,
  fetchRoster,
  pinLogin,
  solicitarOtp,
  type RosterResponse,
  type RosterUsuario,
} from '@/lib/auth/modo-tienda-client'

const PIN_LENGTH = 6

type Vista = 'roster' | 'pin' | 'setup'

export default function ModoTiendaPage() {
  const router = useRouter()
  const [roster, setRoster] = useState<RosterResponse | null>(null)
  const [cargando, setCargando] = useState(true)
  const [noEnrolado, setNoEnrolado] = useState(false)

  const [vista, setVista] = useState<Vista>('roster')
  const [usuario, setUsuario] = useState<RosterUsuario | null>(null)

  // Estado de login por PIN
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [verificando, setVerificando] = useState(false)

  // Estado de configuración de PIN (OTP)
  const [otpEnviado, setOtpEnviado] = useState(false)
  const [otp, setOtp] = useState('')
  const [nuevoPin, setNuevoPin] = useState('')
  const [confirmaPin, setConfirmaPin] = useState('')
  const [setupError, setSetupError] = useState<string | null>(null)
  const [setupMsg, setSetupMsg] = useState<string | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)

  const cargarRoster = useCallback(async () => {
    setCargando(true)
    try {
      const data = await fetchRoster()
      setRoster(data)
      setNoEnrolado(false)
    } catch (e) {
      if ((e as { status?: number }).status === 401) setNoEnrolado(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarRoster()
  }, [cargarRoster])

  function volverAlRoster() {
    setVista('roster')
    setUsuario(null)
    setPin('')
    setPinError(null)
    setOtp('')
    setNuevoPin('')
    setConfirmaPin('')
    setOtpEnviado(false)
    setSetupError(null)
    setSetupMsg(null)
  }

  function seleccionarUsuario(u: RosterUsuario) {
    setUsuario(u)
    setPin('')
    setPinError(null)
    setVista(u.tiene_pin ? 'pin' : 'setup')
  }

  const intentarLogin = useCallback(
    async (u: RosterUsuario, valor: string) => {
      setVerificando(true)
      setPinError(null)
      try {
        await pinLogin(u.id, valor)
        router.push('/dashboard')
        router.refresh()
      } catch (e) {
        const err = e as { status?: number; payload?: { intentos_restantes?: number } }
        if (err.status === 409) {
          // PIN no configurado → flujo de setup
          setVista('setup')
        } else if (err.status === 423) {
          setPinError('PIN bloqueado temporalmente. Usa "Olvidé mi PIN".')
        } else if (err.status === 401) {
          const r = err.payload?.intentos_restantes
          setPinError(
            r != null ? `PIN incorrecto. Te quedan ${r} intento(s).` : 'PIN incorrecto.'
          )
        } else {
          setPinError('No se pudo verificar el PIN.')
        }
        setPin('')
      } finally {
        setVerificando(false)
      }
    },
    [router]
  )

  // Auto-enviar cuando el PIN llega a la longitud completa.
  useEffect(() => {
    if (vista === 'pin' && usuario && pin.length === PIN_LENGTH && !verificando) {
      intentarLogin(usuario, pin)
    }
  }, [pin, vista, usuario, verificando, intentarLogin])

  async function enviarOtp() {
    if (!usuario) return
    setSetupLoading(true)
    setSetupError(null)
    setSetupMsg(null)
    try {
      const r = await solicitarOtp(usuario.id, usuario.tiene_pin ? 'RESET_PIN' : 'ENROLAR_PIN')
      setOtpEnviado(true)
      setSetupMsg(
        r.debug_codigo
          ? `Código enviado por WhatsApp. (DEV: ${r.debug_codigo})`
          : 'Te enviamos un código por WhatsApp.'
      )
    } catch (e) {
      setSetupError((e as Error).message || 'No se pudo enviar el código.')
    } finally {
      setSetupLoading(false)
    }
  }

  async function guardarPin() {
    if (!usuario) return
    if (!/^\d{6}$/.test(nuevoPin)) {
      setSetupError('El PIN debe tener 6 dígitos.')
      return
    }
    if (nuevoPin !== confirmaPin) {
      setSetupError('Los PIN no coinciden.')
      return
    }
    setSetupLoading(true)
    setSetupError(null)
    try {
      await establecerPin(usuario.id, otp, nuevoPin)
      // PIN listo → iniciar sesión directamente.
      await intentarLogin({ ...usuario, tiene_pin: true }, nuevoPin)
    } catch (e) {
      setSetupError((e as Error).message || 'No se pudo guardar el PIN.')
    } finally {
      setSetupLoading(false)
    }
  }

  // --- Render ---

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (noEnrolado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 pt-6 text-center">
            <Laptop className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Equipo no enrolado</h2>
            <p className="text-muted-foreground">
              Esta laptop aún no está atada a una tienda. Un supervisor debe enrolarla.
            </p>
            <Button className="w-full" onClick={() => router.push('/enrolar-dispositivo')}>
              Enrolar este equipo
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => router.push('/login')}>
              Login tradicional
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      {/* Header con tienda enrolada */}
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">
              GR
            </div>
            <span className="text-lg font-semibold">GridRetail</span>
          </div>
          {roster?.tienda && (
            <div className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-primary" />
              <span className="font-medium">{roster.tienda.nombre}</span>
              <span className="text-muted-foreground">({roster.tienda.codigo})</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        {vista === 'roster' && (
          <div className="w-full max-w-4xl">
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-3xl font-bold">¿Quién eres?</h1>
              <p className="text-muted-foreground">
                Toca tu foto para ingresar con tu PIN
              </p>
            </div>
            {roster && (
              <RosterTienda usuarios={roster.usuarios} onSelect={seleccionarUsuario} />
            )}
          </div>
        )}

        {vista === 'pin' && usuario && (
          <Card className="w-full max-w-sm">
            <CardContent className="space-y-6 pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Ingresa tu PIN</p>
                <h2 className="text-2xl font-bold">{usuario.nombre_completo}</h2>
              </div>
              <PinPad
                value={pin}
                onChange={(v) => {
                  setPinError(null)
                  setPin(v)
                }}
                length={PIN_LENGTH}
                disabled={verificando}
                error={!!pinError}
              />
              {verificando && (
                <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
                </p>
              )}
              {pinError && (
                <p className="text-center text-sm text-destructive">{pinError}</p>
              )}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={volverAlRoster}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Cambiar usuario
                </Button>
                <Button variant="link" size="sm" onClick={() => setVista('setup')}>
                  Olvidé mi PIN
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {vista === 'setup' && usuario && (
          <Card className="w-full max-w-sm">
            <CardContent className="space-y-4 pt-6">
              <div className="text-center">
                <h2 className="text-xl font-bold">
                  {usuario.tiene_pin ? 'Restablecer PIN' : 'Configurar tu PIN'}
                </h2>
                <p className="text-sm text-muted-foreground">{usuario.nombre_completo}</p>
              </div>

              {!otpEnviado ? (
                <>
                  <p className="text-center text-sm text-muted-foreground">
                    Te enviaremos un código por WhatsApp para verificar tu identidad.
                  </p>
                  <Button className="w-full" onClick={enviarOtp} disabled={setupLoading}>
                    {setupLoading ? 'Enviando...' : 'Enviar código por WhatsApp'}
                  </Button>
                </>
              ) : (
                <>
                  {setupMsg && (
                    <p className="rounded-md bg-muted p-2 text-center text-xs text-muted-foreground">
                      {setupMsg}
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="otp">Código recibido</Label>
                    <Input
                      id="otp"
                      inputMode="numeric"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="6 dígitos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nuevoPin">Nuevo PIN (6 dígitos)</Label>
                    <Input
                      id="nuevoPin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={nuevoPin}
                      onChange={(e) => setNuevoPin(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmaPin">Confirma el PIN</Label>
                    <Input
                      id="confirmaPin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmaPin}
                      onChange={(e) => setConfirmaPin(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <Button className="w-full" onClick={guardarPin} disabled={setupLoading}>
                    {setupLoading ? 'Guardando...' : 'Guardar PIN e ingresar'}
                  </Button>
                </>
              )}

              {setupError && (
                <p className="text-center text-sm text-destructive">{setupError}</p>
              )}

              <Button variant="ghost" size="sm" className="w-full" onClick={volverAlRoster}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Volver
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
