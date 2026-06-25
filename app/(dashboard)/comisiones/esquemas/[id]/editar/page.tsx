'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { SchemeForm } from '@/components/comisiones/SchemeForm'
import { type SchemeFormValues } from '@/lib/comisiones/validations'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { Usuario } from '@/types'
import { toast } from 'sonner'

const ROLES_EDICION = ['ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES']

export default function EditarEsquemaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [scheme, setScheme] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [redistributeQuotas, setRedistributeQuotas] = useState(false)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_EDICION.includes(usuario.rol)) {
      router.push('/comisiones/esquemas')
      return
    }
    setUser(usuario)
  }, [router])

  useEffect(() => {
    if (!user) return
    async function loadScheme() {
      try {
        const response = await fetch(`/api/comisiones/esquemas/${id}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        if (data.scheme.status !== 'draft') {
          toast.error('Solo se pueden editar esquemas en estado borrador')
          router.push(`/comisiones/esquemas/${id}`)
          return
        }
        setScheme(data.scheme)
        setItems(data.items || [])
      } catch (error) {
        console.error('Error:', error)
        toast.error('Error al cargar esquema')
        router.push('/comisiones/esquemas')
      } finally {
        setLoading(false)
      }
    }
    loadScheme()
  }, [user, id, router])

  // Calcular suma de cuotas de partidas principales (SS)
  // Las partidas principales son OSS, OPP, VR - identificadas por nombre/código
  const ssPatterns = ['OSS', 'OPP', 'VR_', 'VR ']
  const principalItems = items.filter(item => {
    if (!item.is_active) return false
    const name = (item.custom_name || item.preset?.name || item.item_type?.name || item.item_type?.code || '').toUpperCase()
    return ssPatterns.some(pattern => name.includes(pattern))
  })
  const principalItemsSum = principalItems.reduce((sum, item) => sum + (item.quota || 0), 0)

  // Verificar que hay items principales y sus pesos suman ~100%
  const principalWeightSum = principalItems.reduce((sum, item) => sum + (item.weight || 0), 0)
  const isPrincipalGroupValid = principalItems.length > 0 && Math.abs(principalWeightSum - 1) < 0.1

  const hasQuotaMismatch = scheme && isPrincipalGroupValid && principalItemsSum > 0 && principalItemsSum !== scheme.total_ss_quota

  const handleSubmit = async (values: SchemeFormValues) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/comisiones/esquemas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          redistribute_quotas: redistributeQuotas, // Enviar siempre si está marcado
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al actualizar esquema')

      if (data.quotas_redistributed) {
        toast.success('Esquema actualizado y cuotas redistribuidas')
      } else {
        toast.success('Esquema actualizado')
      }
      router.push(`/comisiones/esquemas/${id}`)
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!scheme) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/comisiones/esquemas/${id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Esquema</h1>
          <p className="text-muted-foreground">
            {scheme.name} - {scheme.code}
          </p>
        </div>
      </div>

      {/* Alerta de desajuste de cuotas */}
      {hasQuotaMismatch && (
        <Card className="max-w-2xl border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Desajuste en cuotas de partidas
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    La suma de cuotas individuales de partidas principales ({principalItemsSum}) no coincide con
                    la Cuota SS Total del esquema ({scheme.total_ss_quota}).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="redistribute"
                    checked={redistributeQuotas}
                    onCheckedChange={(checked) => setRedistributeQuotas(checked === true)}
                  />
                  <Label htmlFor="redistribute" className="text-sm text-yellow-800 dark:text-yellow-200 cursor-pointer">
                    Redistribuir cuotas de partidas proporcionalmente al guardar
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="max-w-2xl">
        <SchemeForm
          defaultValues={{
            name: scheme.name,
            code: scheme.code,
            description: scheme.description || '',
            scheme_type: scheme.scheme_type,
            year: scheme.year,
            month: scheme.month,
            fixed_salary: scheme.fixed_salary,
            variable_salary: scheme.variable_salary,
            total_ss_quota: scheme.total_ss_quota,
            default_min_fulfillment: scheme.default_min_fulfillment,
            conversion_table: scheme.conversion_table,
            accelerator_base: scheme.accelerator_base,
          }}
          onSubmit={handleSubmit}
          isLoading={saving}
          submitLabel="Guardar Cambios"
        />
      </div>
    </div>
  )
}
