'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Calculator, RotateCcw, Plus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  SalesInputTable,
  SimulationResult,
  ResultBreakdown,
  ProfileSelector,
  SchemeSelector,
  ScenarioComparison,
  HCSelector,
  QuotaProrationBadge,
} from '@/components/simulador'
import {
  useSimulation,
  useSchemeData,
  useScenarios,
  useHCQuota,
  useHCSalesData,
} from '@/lib/simulador/hooks'
import {
  generateSalesProfile,
  getEffectiveItemName,
} from '@/lib/simulador/profiles'
import type { SalesData, SalesProfile, Scenario, HCEffectiveQuota } from '@/lib/simulador/types'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'

// Roles que pueden usar el simulador gerencia
const ROLES_SIMULADOR = [
  'ADMIN',
  'GERENTE_COMERCIAL',
  'GERENTE_GENERAL',
  'JEFE_VENTAS',
  'BACKOFFICE_OPERACIONES',
]

// Roles que pueden ver esquemas draft
const ROLES_DRAFT = ['ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES']

type DataInputMode = 'profile' | 'manual' | 'hc'

export default function SimuladorPage() {
  // Usuario y permisos
  const [usuario, setUsuario] = useState<{ rol: string } | null>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [canViewDraft, setCanViewDraft] = useState(false)

  // Estado del simulador
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null)
  const [dataInputMode, setDataInputMode] = useState<DataInputMode>('profile')
  const [selectedProfile, setSelectedProfile] = useState<SalesProfile>('average')
  const [salesData, setSalesData] = useState<SalesData>({})
  const [includePenalties, setIncludePenalties] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('input')

  // v1.2: Estado para HC específico
  const [showHCSelector, setShowHCSelector] = useState(false)
  const [selectedHC, setSelectedHC] = useState<{
    id: string
    nombre: string
    codigo: string
    dni: string
    tienda_nombre: string | null
    cuota_efectiva?: HCEffectiveQuota | null
  } | null>(null)

  // Período actual
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  // Hooks
  const { schemes, selectedScheme, loadSchemes, loadSchemeWithItems, loading: loadingSchemes } = useSchemeData()
  const { simulate, simulateLocal, result, loading: simulating, error, reset } = useSimulation()
  const { scenarios, addScenario, clearScenarios } = useScenarios()

  // v1.2: Hook para cargar ventas de HC específico
  const { loadSalesData: loadHCSales, loading: loadingHCSales } = useHCSalesData()

  // Cargar usuario
  useEffect(() => {
    const user = getUsuarioFromLocalStorage()
    setUsuario(user)
    setHasAccess(user?.rol ? ROLES_SIMULADOR.includes(user.rol) : false)
    setCanViewDraft(user?.rol ? ROLES_DRAFT.includes(user.rol) : false)
  }, [])

  // Cargar esquemas cuando el usuario tiene acceso
  useEffect(() => {
    if (hasAccess) {
      const status = canViewDraft ? ['aprobado', 'draft'] : ['aprobado']
      loadSchemes({ status })
    }
  }, [hasAccess, canViewDraft, loadSchemes])

  // Cargar partidas cuando se selecciona un esquema
  useEffect(() => {
    if (selectedSchemeId) {
      loadSchemeWithItems(selectedSchemeId)
    }
  }, [selectedSchemeId, loadSchemeWithItems])

  // Generar datos de venta cuando cambia el perfil o el esquema
  useEffect(() => {
    if (selectedScheme && dataInputMode === 'profile' && selectedProfile !== 'custom') {
      // v1.2: Usar cuota del HC si está disponible
      const hcQuota = selectedHC?.cuota_efectiva || undefined
      const generatedData = generateSalesProfile(selectedScheme.items, selectedProfile, hcQuota)
      setSalesData(generatedData)
    }
  }, [selectedScheme, selectedProfile, dataInputMode, selectedHC?.cuota_efectiva])

  // Handlers
  const handleSchemeChange = useCallback((schemeId: string) => {
    setSelectedSchemeId(schemeId)
    reset()
    setSalesData({})
    setSelectedHC(null) // Limpiar HC seleccionado
  }, [reset])

  const handleProfileChange = useCallback((profile: SalesProfile) => {
    setSelectedProfile(profile)
    if (profile === 'custom') {
      setDataInputMode('manual')
    }
  }, [])

  const handleSalesChange = useCallback((itemName: string, value: number) => {
    setSalesData(prev => ({ ...prev, [itemName]: value }))
  }, [])

  const handleCalculate = useCallback(async () => {
    if (!selectedScheme) return

    // v1.2: Obtener cuota del HC si está disponible
    const hcQuota = selectedHC?.cuota_efectiva || undefined

    // Intentar simular con RPC, sino usar cálculo local
    try {
      const rpcResult = await simulate({
        schemeId: selectedScheme.id,
        salesData,
        includePenalties,
        userId: selectedHC?.id,
        hcQuota,
      })

      if (!rpcResult) {
        // Fallback a cálculo local (con cuota del HC)
        await simulateLocal(selectedScheme, salesData, hcQuota)
      }

      setActiveTab('result')
    } catch (err) {
      console.error('Error en simulación:', err)
    }
  }, [selectedScheme, salesData, includePenalties, simulate, simulateLocal, selectedHC])

  const handleClearData = useCallback(() => {
    if (selectedScheme && selectedProfile !== 'custom') {
      const generatedData = generateSalesProfile(selectedScheme.items, selectedProfile)
      setSalesData(generatedData)
    } else {
      // Limpiar a ceros
      const clearedData: SalesData = {}
      selectedScheme?.items.forEach(item => {
        const itemName = getEffectiveItemName(item)
        clearedData[itemName] = 0
      })
      setSalesData(clearedData)
    }
    reset()
  }, [selectedScheme, selectedProfile, reset])

  const handleAddToComparison = useCallback(() => {
    if (!selectedScheme || !result) return

    addScenario(selectedScheme, selectedProfile, salesData, result)
    setShowComparison(true)
  }, [selectedScheme, selectedProfile, salesData, result, addScenario])

  // v1.2: Handler para seleccionar HC específico
  const handleHCSelect = useCallback(async (user: {
    id: string
    nombre: string
    codigo: string
    dni: string
    tienda_nombre: string | null
    cuota_efectiva?: HCEffectiveQuota | null
  }) => {
    setSelectedHC(user)
    setDataInputMode('hc')
    setIncludePenalties(true) // Auto-habilitar penalidades

    // Cargar ventas reales del HC si hay esquema seleccionado
    if (selectedScheme && user.dni) {
      const result = await loadHCSales(
        user.dni,
        selectedScheme.items,
        currentYear,
        currentMonth
      )
      if (result?.salesData) {
        setSalesData(result.salesData)
      }
    }
  }, [selectedScheme, loadHCSales, currentYear, currentMonth])

  // Verificar acceso
  if (!hasAccess) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            No tienes permisos para acceder al Simulador de Ingresos.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Simulador de Ingresos HC</h1>
          <p className="text-muted-foreground">
            Proyecta comisiones basándote en esquemas y datos de venta
          </p>
        </div>
        {scenarios.length >= 2 && (
          <Button
            variant={showComparison ? 'default' : 'outline'}
            onClick={() => setShowComparison(!showComparison)}
          >
            {showComparison ? 'Ocultar comparación' : 'Ver comparación'}
          </Button>
        )}
      </div>

      {/* Comparación de escenarios */}
      {showComparison && scenarios.length >= 2 && (
        <ScenarioComparison
          scenarioA={scenarios[0]}
          scenarioB={scenarios[1]}
          onSwap={() => {
            // Implementar swap de escenarios
          }}
        />
      )}

      {/* Panel principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuración */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Configuración</CardTitle>
            <CardDescription>
              Selecciona el esquema y configura los datos de venta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selector de esquema */}
            <div className="space-y-2">
              <Label>Esquema</Label>
              {loadingSchemes ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando esquemas...
                </div>
              ) : (
                <SchemeSelector
                  schemes={schemes}
                  selectedSchemeId={selectedSchemeId}
                  onSchemeChange={handleSchemeChange}
                />
              )}
            </div>

            {/* Modo de entrada de datos */}
            <div className="space-y-3">
              <Label>Datos de venta</Label>
              <RadioGroup
                value={dataInputMode}
                onValueChange={(v) => {
                  setDataInputMode(v as DataInputMode)
                  if (v === 'hc' && !selectedHC) {
                    setShowHCSelector(true)
                  }
                }}
                disabled={!selectedScheme}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="profile" id="profile" />
                  <Label htmlFor="profile" className="font-normal">
                    Perfil predefinido
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="font-normal">
                    Ingreso manual
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hc" id="hc" />
                  <Label htmlFor="hc" className="font-normal">
                    HC específico
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Selector de perfil */}
            {dataInputMode === 'profile' && (
              <div className="space-y-2">
                <Label>Perfil</Label>
                <ProfileSelector
                  selectedProfile={selectedProfile}
                  onProfileChange={handleProfileChange}
                  disabled={!selectedScheme}
                />
              </div>
            )}

            {/* v1.2: HC seleccionado */}
            {dataInputMode === 'hc' && (
              <div className="space-y-3">
                {selectedHC ? (
                  <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{selectedHC.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedHC.tienda_nombre} • {selectedHC.codigo}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowHCSelector(true)}
                      >
                        Cambiar
                      </Button>
                    </div>
                    {/* Info de cuota */}
                    {selectedHC.cuota_efectiva && (
                      <div className="pt-2 border-t flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cuota efectiva:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{selectedHC.cuota_efectiva.effective_quota}</span>
                          {selectedHC.cuota_efectiva.proration_factor < 1 && (
                            <QuotaProrationBadge
                              startDate={selectedHC.cuota_efectiva.start_date}
                              prorationFactor={selectedHC.cuota_efectiva.proration_factor}
                              size="sm"
                              noTooltip
                            />
                          )}
                        </div>
                      </div>
                    )}
                    {!selectedHC.cuota_efectiva && (
                      <p className="text-sm text-amber-600 pt-2 border-t">
                        Sin cuota asignada para este período
                      </p>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowHCSelector(true)}
                    disabled={!selectedScheme}
                  >
                    Seleccionar HC
                  </Button>
                )}
              </div>
            )}

            {/* Opciones adicionales */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="penalties"
                  checked={includePenalties}
                  onCheckedChange={(checked) => setIncludePenalties(!!checked)}
                  disabled={dataInputMode !== 'hc' || !selectedHC}
                />
                <Label htmlFor="penalties" className="font-normal text-sm">
                  Incluir predicción de penalidades
                  {dataInputMode === 'hc' && !selectedHC && (
                    <span className="text-muted-foreground"> (requiere seleccionar HC)</span>
                  )}
                </Label>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleCalculate}
                disabled={!selectedScheme || simulating}
                className="w-full"
              >
                {simulating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Calcular Comisión
                  </>
                )}
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClearData}
                  disabled={!selectedScheme}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
                {result && (
                  <Button
                    variant="outline"
                    onClick={handleAddToComparison}
                    disabled={scenarios.length >= 2}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Comparar
                  </Button>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Datos y resultado */}
        <Card className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="input">Datos de Venta</TabsTrigger>
                <TabsTrigger value="result" disabled={!result}>
                  Resultado
                </TabsTrigger>
                <TabsTrigger value="detail" disabled={!result}>
                  Detalle
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Tab: Datos de venta */}
              <TabsContent value="input" className="mt-0">
                {selectedScheme ? (
                  <SalesInputTable
                    schemeItems={selectedScheme.items}
                    salesData={salesData}
                    onSalesChange={handleSalesChange}
                    readOnly={dataInputMode === 'profile' && selectedProfile !== 'custom'}
                    showTiposVenta={false}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Selecciona un esquema para comenzar
                  </div>
                )}
              </TabsContent>

              {/* Tab: Resultado */}
              <TabsContent value="result" className="mt-0">
                {result ? (
                  <SimulationResult
                    result={result}
                    schemeName={selectedScheme?.name}
                    showExport={true}
                    onExport={() => {
                      // TODO: Implementar exportación
                      console.log('Exportar resultado')
                    }}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Ejecuta una simulación para ver el resultado
                  </div>
                )}
              </TabsContent>

              {/* Tab: Detalle */}
              <TabsContent value="detail" className="mt-0">
                {result ? (
                  <ResultBreakdown
                    details={result.details}
                    showLocks={true}
                    showRestrictions={true}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Ejecuta una simulación para ver el detalle
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* v1.2: Modal para seleccionar HC */}
      <HCSelector
        open={showHCSelector}
        onOpenChange={setShowHCSelector}
        onSelect={handleHCSelect}
        year={currentYear}
        month={currentMonth}
        title="Seleccionar HC para Simulación"
      />
    </div>
  )
}
