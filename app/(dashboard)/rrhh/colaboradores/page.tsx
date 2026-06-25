'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { puedeGestionarRRHH } from '@/lib/rrhh/utils/permisos-rrhh'
import { useUsuariosRRHH } from '@/lib/rrhh/hooks/useUsuariosRRHH'
import {
  USUARIO_STATUS, USUARIO_STATUS_LABELS, USUARIO_STATUS_COLORS,
  AREA_FUNCIONAL, AREA_FUNCIONAL_LABELS,
  TIPO_CONTRATO_LABELS,
} from '@/lib/rrhh/types'
import type { UsuarioStatus, AreaFuncional, TipoContrato } from '@/lib/rrhh/types'
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

import { Users, Search, MoreHorizontal, Eye, Pencil, X, Loader2 } from 'lucide-react'

export default function ColaboradoresPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [areaFilter, setAreaFilter] = useState<string>('')

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

  const { data: colaboradores, loading, total } = useUsuariosRRHH({
    status: statusFilter.length > 0 ? statusFilter : undefined,
    area_funcional: areaFilter || undefined,
    search: debouncedSearch || undefined,
  })

  const esGestion = user ? puedeGestionarRRHH(user.rol) : false
  const hayFiltrosActivos = statusFilter.length > 0 || areaFilter || searchTerm

  function limpiarFiltros() {
    setSearchTerm('')
    setStatusFilter([])
    setAreaFilter('')
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-muted-foreground">
            Fichas del personal con datos laborales, personales y bancarios
          </p>
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

            {/* Status */}
            <Select
              value={statusFilter.length === 1 ? statusFilter[0] : ''}
              onValueChange={(val) => setStatusFilter(val ? [val] : [])}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {USUARIO_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {USUARIO_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Área funcional */}
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Área funcional" />
              </SelectTrigger>
              <SelectContent>
                {AREA_FUNCIONAL.map((a) => (
                  <SelectItem key={a} value={a}>
                    {AREA_FUNCIONAL_LABELS[a]}
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
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Lista de Colaboradores</CardTitle>
              <CardDescription>{total} colaboradores encontrados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : colaboradores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-lg font-medium">
                No se encontraron colaboradores
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {hayFiltrosActivos
                  ? 'Intenta modificar los filtros de búsqueda'
                  : 'Aún no se han registrado fichas RRHH'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Ingreso</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradores.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/rrhh/colaboradores/${c.id}`)}
                    >
                      <TableCell className="font-medium">
                        {c.nombre_completo || c.usuario?.nombre_completo || '—'}
                      </TableCell>
                      <TableCell>{c.dni || c.usuario?.dni || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {c.codigo_asesor || c.usuario?.codigo_asesor || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.usuario?.rol || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', USUARIO_STATUS_COLORS[c.status as UsuarioStatus])}>
                          {USUARIO_STATUS_LABELS[c.status as UsuarioStatus] || c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {AREA_FUNCIONAL_LABELS[c.area_funcional as AreaFuncional] || c.area_funcional}
                      </TableCell>
                      <TableCell className="text-sm">
                        {TIPO_CONTRATO_LABELS[c.tipo_contrato_actual as TipoContrato] || c.tipo_contrato_actual}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.fecha_ingreso
                          ? new Date(c.fecha_ingreso).toLocaleDateString('es-PE')
                          : '—'}
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
                                router.push(`/rrhh/colaboradores/${c.id}`)
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Ver ficha
                            </DropdownMenuItem>
                            {esGestion && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/rrhh/colaboradores/${c.id}?editar=1`)
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
