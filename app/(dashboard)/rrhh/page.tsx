'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { createClient } from '@/lib/supabase/client'
import { puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { Usuario } from '@/types'
import {
  USUARIO_STATUS_COLORS, USUARIO_STATUS_LABELS,
  TIPO_MOVIMIENTO_LABELS, TIPO_MOVIMIENTO_COLORS,
  TIPO_SALIDA_LABELS, ESTADO_OFFBOARDING_LABELS,
} from '@/lib/rrhh/types'
import type { UsuarioStatus, TipoMovimiento } from '@/lib/rrhh/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Users,
  UserPlus,
  FileText,
  AlertTriangle,
  Clock,
  TrendingUp,
  ArrowRightLeft,
  LogOut,
} from 'lucide-react'

interface DashboardMetrics {
  totalColaboradores: number
  colaboradoresPorStatus: Record<string, number>
  candidatosEnPipeline: number
  contratosPorVencer: number
  alertasPendientes: number
  incidenciasMes: number
  movimientosMes: number
  offboardingsEnProceso: number
}

interface MovimientoReciente {
  id: string
  tipo_movimiento: string
  fecha_efectiva: string
  usuario: { nombre_completo: string } | null
}

interface OffboardingActivo {
  id: string
  tipo_salida: string
  estado: string
  fecha_inicio: string
  usuario: { nombre_completo: string; codigo_asesor: string } | null
}

export default function RRHHDashboardPage() {
  const [user, setUser] = useState<Usuario | null>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [movimientosRecientes, setMovimientosRecientes] = useState<MovimientoReciente[]>([])
  const [offboardingsActivos, setOffboardingsActivos] = useState<OffboardingActivo[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    setUser(usuario)
  }, [])

  useEffect(() => {
    if (!user) return

    async function loadMetrics() {
      try {
        // Colaboradores por status
        const { data: rrhhData } = await supabase
          .from('usuarios_rrhh')
          .select('status')

        const colaboradoresPorStatus: Record<string, number> = {}
        let total = 0
        if (rrhhData) {
          for (const row of rrhhData) {
            colaboradoresPorStatus[row.status] = (colaboradoresPorStatus[row.status] || 0) + 1
            if (row.status !== 'CESADO' && row.status !== 'CANDIDATO') {
              total++
            }
          }
        }

        // Candidatos activos en pipeline
        const { count: candidatosCount } = await supabase
          .from('candidatos')
          .select('*', { count: 'exact', head: true })
          .eq('descartado', false)
          .not('etapa_actual', 'in', '("ALTA","DESCARTADO")')

        // Contratos por vencer (próximos 30 días)
        const hoy = new Date().toISOString().split('T')[0]
        const en30Dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const { count: contratosCount } = await supabase
          .from('contratos')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'VIGENTE')
          .gte('fecha_fin', hoy)
          .lte('fecha_fin', en30Dias)

        // Alertas pendientes
        const { count: alertasCount } = await supabase
          .from('alertas_rrhh')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'PENDIENTE')

        // Incidencias del mes actual
        const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          .toISOString().split('T')[0]
        const { count: incidenciasCount } = await supabase
          .from('incidencias_laborales')
          .select('*', { count: 'exact', head: true })
          .gte('fecha', primerDiaMes)

        // Movimientos del mes actual
        const { count: movimientosCount } = await supabase
          .from('movimientos_personal')
          .select('*', { count: 'exact', head: true })
          .gte('fecha_efectiva', primerDiaMes)

        // Offboardings en proceso
        const { count: offboardingsCount } = await supabase
          .from('offboarding_checklist')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'EN_PROCESO')

        // Últimos 5 movimientos
        const { data: movRecientes } = await supabase
          .from('movimientos_personal')
          .select('id, tipo_movimiento, fecha_efectiva, usuario:usuarios!movimientos_personal_usuario_id_fkey(nombre_completo)')
          .order('created_at', { ascending: false })
          .limit(5)

        // Offboardings activos
        const { data: obActivos } = await supabase
          .from('offboarding_checklist')
          .select('id, tipo_salida, estado, fecha_inicio, usuario:usuarios!offboarding_checklist_usuario_id_fkey(nombre_completo, codigo_asesor)')
          .eq('estado', 'EN_PROCESO')
          .order('created_at', { ascending: false })
          .limit(5)

        setMetrics({
          totalColaboradores: total,
          colaboradoresPorStatus,
          candidatosEnPipeline: candidatosCount || 0,
          contratosPorVencer: contratosCount || 0,
          alertasPendientes: alertasCount || 0,
          incidenciasMes: incidenciasCount || 0,
          movimientosMes: movimientosCount || 0,
          offboardingsEnProceso: offboardingsCount || 0,
        })
        setMovimientosRecientes((movRecientes as unknown as MovimientoReciente[]) || [])
        setOffboardingsActivos((obActivos as unknown as OffboardingActivo[]) || [])
      } catch (error) {
        console.error('Error cargando métricas RRHH:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMetrics()
  }, [user, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Cargando métricas...</div>
      </div>
    )
  }

  const esGestion = user && puedeGestionarRRHH(user.rol)

  function formatFecha(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestión de RRHH</h1>
        <p className="text-muted-foreground">
          Panel de control de Recursos Humanos
        </p>
      </div>

      {/* KPIs principales — 8 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">HC Activo</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalColaboradores ?? 0}</div>
            <p className="text-xs text-muted-foreground">colaboradores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.candidatosEnPipeline ?? 0}</div>
            <p className="text-xs text-muted-foreground">candidatos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.contratosPorVencer ?? 0}</div>
            <p className="text-xs text-muted-foreground">por vencer (30d)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.alertasPendientes ?? 0}</div>
            <p className="text-xs text-muted-foreground">pendientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidencias</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.incidenciasMes ?? 0}</div>
            <p className="text-xs text-muted-foreground">este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.colaboradoresPorStatus?.['ACTIVO'] ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">status activo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movimientos</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.movimientosMes ?? 0}</div>
            <p className="text-xs text-muted-foreground">este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offboarding</CardTitle>
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.offboardingsEnProceso ?? 0}</div>
            <p className="text-xs text-muted-foreground">en proceso</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribución por status */}
      {metrics?.colaboradoresPorStatus && Object.keys(metrics.colaboradoresPorStatus).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.colaboradoresPorStatus)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <Badge
                    key={status}
                    variant="outline"
                    className={USUARIO_STATUS_COLORS[status as UsuarioStatus] ?? ''}
                  >
                    {USUARIO_STATUS_LABELS[status as UsuarioStatus] ?? status}: {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Secciones de detalle */}
      {esGestion && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Movimientos recientes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Movimientos Recientes</CardTitle>
              <Link href="/rrhh/movimientos" className="text-xs text-primary hover:underline">
                Ver todos
              </Link>
            </CardHeader>
            <CardContent>
              {movimientosRecientes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay movimientos recientes</p>
              ) : (
                <div className="space-y-3">
                  {movimientosRecientes.map((mov) => (
                    <div key={mov.id} className="flex items-center gap-3">
                      <Badge className={cn('text-[10px] shrink-0', TIPO_MOVIMIENTO_COLORS[mov.tipo_movimiento as TipoMovimiento])}>
                        {TIPO_MOVIMIENTO_LABELS[mov.tipo_movimiento as TipoMovimiento] || mov.tipo_movimiento}
                      </Badge>
                      <p className="text-sm truncate flex-1">{mov.usuario?.nombre_completo || '—'}</p>
                      <p className="text-xs text-muted-foreground shrink-0">{formatFecha(mov.fecha_efectiva)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Offboardings activos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Offboardings Activos</CardTitle>
              <Link href="/rrhh/offboarding" className="text-xs text-primary hover:underline">
                Ver todos
              </Link>
            </CardHeader>
            <CardContent>
              {offboardingsActivos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay procesos de offboarding activos</p>
              ) : (
                <div className="space-y-3">
                  {offboardingsActivos.map((ob) => (
                    <Link key={ob.id} href={`/rrhh/offboarding/${ob.id}`} className="flex items-center gap-3 hover:bg-accent rounded-md p-1 -m-1">
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {TIPO_SALIDA_LABELS[ob.tipo_salida as keyof typeof TIPO_SALIDA_LABELS] || ob.tipo_salida}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{ob.usuario?.nombre_completo || '—'}</p>
                        <p className="text-xs text-muted-foreground">{ob.usuario?.codigo_asesor}</p>
                      </div>
                      <p className="text-xs text-muted-foreground shrink-0">{formatFecha(ob.fecha_inicio)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
