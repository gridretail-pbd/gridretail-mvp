'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { useContratos } from '@/lib/rrhh/hooks/useContratos'
import {
  ESTADO_CONTRATO, ESTADO_CONTRATO_LABELS, ESTADO_CONTRATO_COLORS,
  TIPO_CONTRATO, TIPO_CONTRATO_LABELS,
} from '@/lib/rrhh/types'
import type { EstadoContrato, TipoContrato } from '@/lib/rrhh/types'
import type { Usuario } from '@/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { FileText, Search, MoreHorizontal, Eye, X, Loader2, AlertTriangle } from 'lucide-react'

export default function ContratosPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<string[]>([])
  const [tipoFilter, setTipoFilter] = useState<string>('')

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    setUser(usuario)
  }, [router])

  const { data: contratos, loading, total } = useContratos({
    estado: estadoFilter.length > 0 ? estadoFilter : undefined,
    tipo_contrato: tipoFilter || undefined,
    search: debouncedSearch || undefined,
  })

  const esGestion = user ? puedeGestionarRRHH(user.rol) : false
  const hayFiltrosActivos = estadoFilter.length > 0 || tipoFilter || searchTerm

  function limpiarFiltros() {
    setSearchTerm('')
    setEstadoFilter([])
    setTipoFilter('')
  }

  function formatFecha(fecha: string | null) {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-PE')
  }

  function diasParaVencer(fechaFin: string | null): number | null {
    if (!fechaFin) return null
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fin = new Date(fechaFin)
    fin.setHours(0, 0, 0, 0)
    return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos</h1>
          <p className="text-muted-foreground">
            Gestión de contratos laborales y ciclos de renovación
          </p>
        </div>
        <div className="flex gap-2">
          {esGestion && (
            <Button
              variant="outline"
              onClick={() => router.push('/rrhh/contratos/renovacion')}
            >
              Lotes de Renovación
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, DNI o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Estado */}
            <Select
              value={estadoFilter.length === 1 ? estadoFilter[0] : ''}
              onValueChange={(val) => setEstadoFilter(val ? [val] : [])}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_CONTRATO.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ESTADO_CONTRATO_LABELS[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tipo contrato */}
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo contrato" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_CONTRATO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_CONTRATO_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Limpiar */}
            {hayFiltrosActivos && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Lista de Contratos</CardTitle>
              <CardDescription>{total} contratos encontrados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contratos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg font-medium">
                No se encontraron contratos
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {hayFiltrosActivos
                  ? 'Intenta modificar los filtros de búsqueda'
                  : 'Aún no se han registrado contratos'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contratos.map((c) => {
                    const dias = diasParaVencer(c.fecha_fin)
                    const proximoAVencer = dias !== null && dias >= 0 && dias <= 30

                    return (
                      <TableRow key={c.id} className="cursor-pointer">
                        <TableCell className="font-medium">
                          {c.usuario?.nombre_completo || '—'}
                        </TableCell>
                        <TableCell>{c.usuario?.dni || '—'}</TableCell>
                        <TableCell className="text-sm">
                          {TIPO_CONTRATO_LABELS[c.tipo_contrato as TipoContrato] || c.tipo_contrato}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatFecha(c.fecha_inicio)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatFecha(c.fecha_fin)}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', ESTADO_CONTRATO_COLORS[c.estado as EstadoContrato])}>
                            {ESTADO_CONTRATO_LABELS[c.estado as EstadoContrato] || c.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {dias !== null ? (
                            <div className={cn(
                              'flex items-center gap-1 text-sm',
                              proximoAVencer && c.estado === 'VIGENTE' ? 'text-orange-600 font-medium' : 'text-muted-foreground'
                            )}>
                              {proximoAVencer && c.estado === 'VIGENTE' && (
                                <AlertTriangle className="h-3.5 w-3.5" />
                              )}
                              {dias < 0 ? 'Vencido' : dias === 0 ? 'Hoy' : `${dias}d`}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Navigate to colaborador's ficha with contrato context
                                  router.push(`/rrhh/colaboradores/${c.usuario_id}`)
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Ver ficha colaborador
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
