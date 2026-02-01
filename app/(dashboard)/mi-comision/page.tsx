'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, Wallet, TrendingUp, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SimulationResult,
  ResultBreakdown,
  HCProgressBar,
  WhatIfCalculator,
  EffectiveQuotaCard,
  QuotaProrationBadge,
} from '@/components/simulador'
import {
  useSimulation,
  useSchemeData,
  useHCQuota,
} from '@/lib/simulador/hooks'
import {
  getEffectiveItemName,
  getDisplayName,
  getEffectiveCategory,
  groupItemsByCategory,
} from '@/lib/simulador/profiles'
import { formatCurrency, formatPeriod } from '@/lib/simulador/formatters'
import type { SalesData, SimulationResult as SimulationResultType, HCEffectiveQuota } from '@/lib/simulador/types'
import {
  calculateRemainingDays,
  calculateSalesNeeded,
  calculateSalesPerDayNeeded,
} from '@/lib/simulador/profiles'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown } from 'lucide-react'

// Roles que pueden ver Mi Comisión
const ROLES_MI_COMISION = ['ASESOR', 'ASESOR_REFERENTE', 'SUPERVISOR', 'COORDINADOR']

export default function MiComisionPage() {
  // Usuario y permisos
  const [usuario, setUsuario] = useState<{
    id: string
    nombre: string
    rol: string
    dni?: string
  } | null>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)

  // Datos del esquema y ventas
  const [salesData, setSalesData] = useState<SalesData>({})
  const [loadingSales, setLoadingSales] = useState(false)
  const [showFullBreakdown, setShowFullBreakdown] = useState(false)

  // Período actual
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Hooks
  const { selectedScheme, loadSchemeWithItems, loading: loadingScheme } = useSchemeData()
  const { simulateLocal, result, loading: simulating, error } = useSimulation()

  // v1.2: Hook para obtener cuota efectiva con prorrateo
  const {
    quota: hcQuota,
    loading: loadingQuota,
    fetchQuota
  } = useHCQuota({
    userId: usuario?.id || '',
    year: currentYear,
    month: currentMonth,
    enabled: !!usuario?.id && hasAccess
  })

  const supabase = createClient()

  // Cargar usuario
  useEffect(() => {
    const user = getUsuarioFromLocalStorage()
    setUsuario(user as typeof usuario)
    setHasAccess(user?.rol ? ROLES_MI_COMISION.includes(user.rol) : false)
    setLoadingUser(false)
  }, [])

  // Cargar esquema asignado al usuario
  useEffect(() => {
    const loadAssignedScheme = async () => {
      if (!usuario?.id) return

      try {
        // Buscar asignación activa
        const { data: assignment } = await supabase
          .from('commission_hc_assignments')
          .select('scheme_id')
          .eq('user_id', usuario.id)
          .eq('is_active', true)
          .single()

        if (assignment?.scheme_id) {
          await loadSchemeWithItems(assignment.scheme_id)
        } else {
          // Si no hay asignación, buscar esquema aprobado del mes actual
          const now = new Date()
          const { data: defaultScheme } = await supabase
            .from('commission_schemes')
            .select('id')
            .eq('status', 'aprobado')
            .eq('year', now.getFullYear())
            .eq('month', now.getMonth() + 1)
            .eq('scheme_type', usuario.rol === 'SUPERVISOR' ? 'supervisor' : 'asesor')
            .single()

          if (defaultScheme?.id) {
            await loadSchemeWithItems(defaultScheme.id)
          }
        }
      } catch (err) {
        console.error('Error cargando esquema:', err)
      }
    }

    loadAssignedScheme()
  }, [usuario?.id, usuario?.rol, supabase, loadSchemeWithItems])

  // v1.2: Cargar cuota efectiva del HC
  useEffect(() => {
    if (usuario?.id && hasAccess) {
      fetchQuota()
    }
  }, [usuario?.id, hasAccess, fetchQuota])

  // Cargar ventas reales del usuario
  useEffect(() => {
    const loadRealSales = async () => {
      if (!usuario?.dni || !selectedScheme) return

      setLoadingSales(true)
      try {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split('T')[0]
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .split('T')[0]

        // Intentar cargar de INAR primero
        const { data: inarData } = await supabase
          .from('lineas_inar')
          .select('vchtipo_venta, intnumlineas')
          .eq('vchvendedordni', usuario.dni)
          .gte('dtefecha_alta', startOfMonth)
          .lte('dtefecha_alta', endOfMonth)

        if (inarData && inarData.length > 0) {
          // Agrupar ventas por tipo
          const salesByType: Record<string, number> = {}
          inarData.forEach((row) => {
            const tipo = row.vchtipo_venta
            salesByType[tipo] = (salesByType[tipo] || 0) + (row.intnumlineas || 1)
          })

          // Mapear a partidas del esquema
          const mappedSales: SalesData = {}
          selectedScheme.items.forEach((item) => {
            const itemName = getEffectiveItemName(item)
            let count = 0

            // Sumar ventas de tipos de venta mapeados a esta partida
            item.mapped_tipos_venta?.forEach((mapping) => {
              if (salesByType[mapping.codigo]) {
                if (mapping.cuentaLinea) {
                  count += salesByType[mapping.codigo]
                }
              }
            })

            mappedSales[itemName] = count
          })

          setSalesData(mappedSales)
        } else {
          // Si no hay datos de INAR, intentar con BU
          const { data: buData } = await supabase
            .from('ventas')
            .select('tipo_venta_id, cantidad')
            .eq('usuario_id', usuario.id)
            .eq('estado', 'aprobada')
            .gte('fecha_venta', startOfMonth)
            .lte('fecha_venta', endOfMonth)

          if (buData && buData.length > 0) {
            // Similar mapping para BU
            const mappedSales: SalesData = {}
            selectedScheme.items.forEach((item) => {
              const itemName = getEffectiveItemName(item)
              mappedSales[itemName] = 0
            })
            setSalesData(mappedSales)
          }
        }
      } catch (err) {
        console.error('Error cargando ventas:', err)
      } finally {
        setLoadingSales(false)
      }
    }

    loadRealSales()
  }, [usuario, selectedScheme, supabase])

  // v1.2: Calcular simulación cuando hay datos (con cuota efectiva)
  useEffect(() => {
    if (selectedScheme && Object.keys(salesData).length > 0 && !result) {
      // Pasar cuota del HC para usar metas prorrateadas
      simulateLocal(selectedScheme, salesData, hcQuota || undefined)
    }
  }, [selectedScheme, salesData, result, simulateLocal, hcQuota])

  // v1.2: Calcular totales para barra de progreso usando cuota efectiva
  const progressData = useMemo(() => {
    if (!selectedScheme) return {
      totalQuota: 0,
      effectiveQuota: 0,
      totalSales: 0,
      prorationFactor: 1
    }

    const principalItems = selectedScheme.items.filter(
      (item) => item.is_active && getEffectiveCategory(item) === 'principal'
    )

    const prorationFactor = hcQuota?.proration_factor ?? 1

    const totalQuota = principalItems.reduce((sum, item) => sum + (item.quota || 0), 0)
    const effectiveQuota = hcQuota?.effective_quota
      ?? Math.round(totalQuota * prorationFactor * 10) / 10

    const totalSales = principalItems.reduce((sum, item) => {
      const itemName = getEffectiveItemName(item)
      return sum + (salesData[itemName] || 0)
    }, 0)

    return {
      totalQuota,
      effectiveQuota,
      totalSales,
      prorationFactor
    }
  }, [selectedScheme, salesData, hcQuota])

  // v1.2: Handler para What If Calculator con cuota
  const handleWhatIfCalculate = useCallback(
    async (newSalesData: SalesData): Promise<SimulationResultType | null> => {
      if (!selectedScheme) return null
      return await simulateLocal(selectedScheme, newSalesData, hcQuota || undefined)
    },
    [selectedScheme, simulateLocal, hcQuota]
  )

  // Verificar acceso
  if (loadingUser) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            Esta página es exclusiva para asesores y supervisores.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const isLoading = loadingScheme || loadingSales || simulating || loadingQuota

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Mi Comisión
          </h1>
          {selectedScheme && (
            <p className="text-muted-foreground">
              {formatPeriod(selectedScheme.year, selectedScheme.month)}
            </p>
          )}
        </div>
        {usuario && (
          <div className="text-right">
            <p className="font-medium">{usuario.nombre}</p>
            <Badge variant="outline">{usuario.rol}</Badge>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Estado de carga */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {loadingScheme
                ? 'Cargando esquema...'
                : loadingSales
                ? 'Cargando tus ventas...'
                : 'Calculando comisión...'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sin esquema */}
      {!isLoading && !selectedScheme && (
        <Alert>
          <AlertTitle>Sin esquema asignado</AlertTitle>
          <AlertDescription>
            No tienes un esquema de comisiones asignado para este período.
            Contacta a tu supervisor.
          </AlertDescription>
        </Alert>
      )}

      {/* Contenido principal */}
      {!isLoading && selectedScheme && result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda: Proyección y progreso */}
          <div className="lg:col-span-2 space-y-6">
            {/* Proyección principal */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Hola, {usuario?.nombre?.split(' ')[0]}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tu proyección de ingresos este mes:
                  </p>
                  <p className="text-5xl font-bold tabular-nums">
                    {formatCurrency(result.totalNet)}
                  </p>
                  <div className="flex items-center justify-center gap-4 text-sm pt-2">
                    <span>
                      Fijo: <strong>{formatCurrency(result.fixedSalary)}</strong>
                    </span>
                    <span>+</span>
                    <span>
                      Variable:{' '}
                      <strong>
                        {formatCurrency(
                          result.variableCommission +
                            result.additionalCommission +
                            result.pxqCommission +
                            result.bonusCommission
                        )}
                      </strong>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* v1.2: Card de Cuota Efectiva */}
            {hcQuota && hcQuota.has_quota && (
              <EffectiveQuotaCard
                quota={hcQuota}
                loading={loadingQuota}
                year={currentYear}
                month={currentMonth}
                showBreakdown={false}
              />
            )}

            {/* Barra de progreso - usa cuota efectiva (con prorrateo) */}
            <HCProgressBar
              totalQuota={progressData.effectiveQuota}
              currentSales={progressData.totalSales}
            />

            {/* Desglose expandible */}
            <Collapsible open={showFullBreakdown} onOpenChange={setShowFullBreakdown}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full">
                  {showFullBreakdown ? 'Ocultar' : 'Ver'} desglose completo
                  <ChevronDown
                    className={`ml-2 h-4 w-4 transition-transform ${
                      showFullBreakdown ? 'rotate-180' : ''
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <ResultBreakdown
                  details={result.details}
                  showLocks={true}
                  showRestrictions={false}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Columna derecha: What If Calculator */}
          <div className="space-y-6">
            <WhatIfCalculator
              schemeItems={selectedScheme.items}
              currentResult={result}
              currentSalesData={salesData}
              onCalculate={handleWhatIfCalculate}
            />

            {/* Penalidades si existen */}
            {result.predictedPenalties !== 0 && (
              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-yellow-800">
                    <AlertTriangle className="h-4 w-4" />
                    Penalidades Estimadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-yellow-800 tabular-nums">
                    {formatCurrency(result.predictedPenalties)}
                  </p>
                  <p className="text-sm text-yellow-700 mt-2">
                    Basado en tu histórico. El monto real puede variar.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Tips - v1.2: usa cuota efectiva */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Tip del día
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {progressData.totalSales >= progressData.effectiveQuota
                    ? 'Felicitaciones, ya alcanzaste tu meta. Cada venta adicional te acerca al Top 20%.'
                    : `Te faltan ${Math.ceil(
                        progressData.effectiveQuota - progressData.totalSales
                      )} líneas para alcanzar el 100% de tu cuota${
                        progressData.prorationFactor < 1 ? ' (ajustada por prorrateo)' : ''
                      }.`}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
