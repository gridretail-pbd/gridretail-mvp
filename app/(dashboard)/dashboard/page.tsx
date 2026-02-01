'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { DashboardMetrics, TiendaMetrics, Tienda, Usuario } from '@/types'
import { MetricsCards } from '@/components/dashboard/metrics-cards'
import { DashboardFilters } from '@/components/dashboard/dashboard-filters'
import { TiendasTable } from '@/components/dashboard/stores-table'
import { SalesChart } from '@/components/dashboard/sales-chart'

export default function DashboardPage() {
  const [user, setUser] = useState<Usuario | null>(null)
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [selectedTiendaId, setSelectedTiendaId] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  )
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalArribos: 0,
    totalVentas: 0,
    montoTotal: 0,
    conversion: 0,
    cumplimiento: 0,
  })
  const [tiendasData, setTiendasData] = useState<TiendaMetrics[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  // Cargar usuario desde localStorage
  useEffect(() => {
    console.log('=== Dashboard: Cargando usuario ===')
    const usuario = getUsuarioFromLocalStorage()
    console.log('Usuario desde localStorage:', usuario)

    if (usuario) {
      setUser(usuario)
    } else {
      console.log('No hay usuario en localStorage')
    }
  }, [])

  // Cargar tiendas según rol del usuario
  useEffect(() => {
    async function loadTiendas() {
      console.log('=== Dashboard: Cargando tiendas ===')
      if (!user) {
        console.log('No hay usuario, no se cargan tiendas')
        return
      }

      console.log('Usuario rol:', user.rol)

      try {
        let query = supabase.from('tiendas').select('*').eq('activa', true)

        // Si no es ADMIN, filtrar por tiendas asignadas
        if (user.rol !== 'ADMIN') {
          console.log('No es ADMIN, buscando tiendas asignadas...')
          const { data: usuarioTiendas } = await supabase
            .from('usuarios_tiendas')
            .select('tienda_id')
            .eq('usuario_id', user.id)

          console.log('Tiendas asignadas:', usuarioTiendas)

          if (usuarioTiendas && usuarioTiendas.length > 0) {
            const tiendaIds = usuarioTiendas.map((ut) => ut.tienda_id)
            query = query.in('id', tiendaIds)
          }
        } else {
          console.log('Usuario es ADMIN, cargando todas las tiendas')
        }

        const { data, error } = await query.order('codigo')

        if (error) {
          console.error('Error cargando tiendas:', error)
        } else {
          console.log('Tiendas cargadas:', data?.length)
          setTiendas(data as Tienda[])
        }
      } catch (error) {
        console.error('Error en loadTiendas:', error)
      }
    }

    if (user) {
      loadTiendas()
    }
  }, [user])

  // Cargar datos del dashboard
  useEffect(() => {
    async function loadDashboardData() {
      console.log('=== Dashboard: Cargando datos del dashboard ===')
      console.log('User:', user ? 'SÍ' : 'NO')
      console.log('Tiendas length:', tiendas.length)

      if (!user) {
        console.log('No hay usuario, no se cargan datos')
        return
      }

      setIsLoading(true)
      console.log('Loading iniciado...')

      try {
        // Determinar qué tiendas consultar
        let tiendaIds: string[] = []

        if (user.rol === 'ADMIN') {
          if (selectedTiendaId === 'all') {
            tiendaIds = tiendas.map((t) => t.id)
            console.log('ADMIN - Todas las tiendas:', tiendaIds.length)
          } else {
            tiendaIds = [selectedTiendaId]
            console.log('ADMIN - Tienda específica:', selectedTiendaId)
          }
        } else {
          // Obtener tiendas asignadas al usuario
          console.log('No ADMIN - Buscando tiendas asignadas...')
          const { data: usuarioTiendas } = await supabase
            .from('usuarios_tiendas')
            .select('tienda_id')
            .eq('usuario_id', user.id)

          tiendaIds = usuarioTiendas?.map((ut) => ut.tienda_id) || []
          console.log('Tiendas asignadas al usuario:', tiendaIds.length)
        }

        if (tiendaIds.length === 0) {
          console.log('No hay tiendas para consultar')
          setIsLoading(false)
          return
        }

        // Obtener datos por tienda
        const tiendasMetrics: TiendaMetrics[] = []

        for (const tienda of tiendas) {
          if (!tiendaIds.includes(tienda.id)) continue

          // Contar ventas
          const { data: ventas } = await supabase
            .from('ventas')
            .select('monto_liquidado')
            .eq('tienda_id', tienda.id)
            .eq('fecha', selectedDate)

          const totalVentas = ventas?.length || 0
          const montoTotal = ventas?.reduce(
            (sum, v) => sum + (v.monto_liquidado || 0),
            0
          ) || 0

          // Contar arribos
          const { count: arribosCount } = await supabase
            .from('arribos')
            .select('*', { count: 'exact', head: true })
            .eq('tienda_id', tienda.id)
            .eq('fecha', selectedDate)

          const totalArribos = arribosCount || 0

          const cuota = tienda.cuota_diaria
          const falta = cuota - montoTotal
          const cumplimiento = cuota > 0 ? (montoTotal / cuota) * 100 : 0
          const conversion =
            totalArribos > 0 ? (totalVentas / totalArribos) * 100 : 0

          tiendasMetrics.push({
            tienda_id: tienda.id,
            tienda_nombre: tienda.nombre,
            tienda_codigo: tienda.codigo,
            cuota,
            total_ventas: totalVentas,
            monto_total: montoTotal,
            falta,
            cumplimiento,
            conversion,
            arribos: totalArribos,
          })
        }

        setTiendasData(tiendasMetrics)

        // Calcular métricas totales
        const totalArribos = tiendasMetrics.reduce(
          (sum, t) => sum + t.arribos,
          0
        )
        const totalVentasCount = tiendasMetrics.reduce(
          (sum, t) => sum + t.total_ventas,
          0
        )
        const montoTotalSum = tiendasMetrics.reduce(
          (sum, t) => sum + t.monto_total,
          0
        )
        const cuotaTotalSum = tiendasMetrics.reduce(
          (sum, t) => sum + t.cuota,
          0
        )

        setMetrics({
          totalArribos,
          totalVentas: totalVentasCount,
          montoTotal: montoTotalSum,
          conversion:
            totalArribos > 0 ? (totalVentasCount / totalArribos) * 100 : 0,
          cumplimiento:
            cuotaTotalSum > 0 ? (montoTotalSum / cuotaTotalSum) * 100 : 0,
        })

        console.log('=== Datos cargados exitosamente ===')
        console.log('Métricas:', { totalArribos, totalVentasCount, montoTotalSum })
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        console.log('Finalizando carga, setIsLoading(false)')
        setIsLoading(false)
      }
    }

    if (user && tiendas.length > 0) {
      console.log('Condiciones cumplidas, llamando loadDashboardData()')
      loadDashboardData()
    } else {
      console.log('Condiciones NO cumplidas para cargar dashboard:', {
        user: !!user,
        tiendasLength: tiendas.length
      })
    }
  }, [user, tiendas, selectedDate, selectedTiendaId])

  const handleRefresh = () => {
    // Trigger reload by updating a dependency
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 100)
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido, {user.nombre_completo}
        </p>
      </div>

      <DashboardFilters
        tiendas={tiendas}
        selectedTiendaId={selectedTiendaId}
        selectedDate={selectedDate}
        onTiendaChange={setSelectedTiendaId}
        onDateChange={setSelectedDate}
        onRefresh={handleRefresh}
        user={user}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Cargando datos...</div>
        </div>
      ) : (
        <>
          <MetricsCards metrics={metrics} />

          <div className="grid gap-4 md:grid-cols-2">
            <TiendasTable tiendasData={tiendasData} />
            <SalesChart tiendasData={tiendasData} />
          </div>
        </>
      )}
    </div>
  )
}
