'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Laptop, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Tienda {
  id: string
  codigo: string
  nombre: string
  zona: string | null
}

/**
 * Enrolamiento del dispositivo (Nivel 1). Un supervisor/admin ata este equipo a
 * una tienda con sus credenciales completas. Ver docs/SPEC_LOGIN_MODO_TIENDA.md §6.1.
 */
export default function EnrolarDispositivoPage() {
  const router = useRouter()
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [codigoAsesor, setCodigoAsesor] = useState('')
  const [password, setPassword] = useState('')
  const [tiendaId, setTiendaId] = useState('')
  const [nombre, setNombre] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tiendas', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setTiendas(d.tiendas ?? []))
      .catch(() => setError('No se pudieron cargar las tiendas'))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!codigoAsesor || !password || !tiendaId || !nombre) {
      setError('Completa todos los campos')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dispositivos/enrolar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_asesor: codigoAsesor,
          password,
          tienda_id: tiendaId,
          nombre,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'No se pudo enrolar el equipo')
        return
      }
      // Equipo enrolado: el middleware ya enrutará a Modo Tienda.
      router.push('/modo-tienda')
      router.refresh()
    } catch {
      setError('Error al conectar con el servidor')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Laptop className="h-6 w-6" />
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl font-bold">Enrolar este equipo</CardTitle>
          <CardDescription>
            Un supervisor o administrador ata esta laptop a una tienda. Después, el
            personal entrará rápido con su PIN.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tienda">Tienda</Label>
              <Select value={tiendaId} onValueChange={setTiendaId} disabled={isLoading}>
                <SelectTrigger id="tienda">
                  <SelectValue placeholder="Selecciona la tienda" />
                </SelectTrigger>
                <SelectContent>
                  {tiendas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre} ({t.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del dispositivo</Label>
              <Input
                id="nombre"
                placeholder="Ej: Laptop Caja 1"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código de supervisor/admin</Label>
              <Input
                id="codigo"
                placeholder="Tu código de asesor"
                value={codigoAsesor}
                onChange={(e) => setCodigoAsesor(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Enrolando...' : 'Enrolar equipo en la tienda'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => router.push('/login')}
              disabled={isLoading}
            >
              Usar login tradicional
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
