'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Download,
  Eye,
  Pencil,
  Copy,
  Check,
  Search,
  Filter,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { SchemeStatusBadge } from '@/components/comisiones/SchemeStatusBadge'
import {
  CommissionScheme,
  SchemeStatus,
  SCHEME_STATUS_LABELS,
  SCHEME_TYPE_LABELS,
  MONTHS,
  formatPeriod,
} from '@/lib/comisiones'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { Usuario } from '@/types'

// Roles que pueden crear/editar esquemas
const ROLES_EDICION = ['ADMIN', 'GERENTE_COMERCIAL', 'BACKOFFICE_OPERACIONES']

// Roles que pueden ver esquemas
const ROLES_VISTA = [
  'ADMIN',
  'GERENTE_COMERCIAL',
  'GERENTE_GENERAL',
  'JEFE_VENTAS',
  'BACKOFFICE_OPERACIONES',
]

interface SchemeWithMeta extends CommissionScheme {
  created_by_name?: string | null
}

export default function EsquemasPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [schemes, setSchemes] = useState<SchemeWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Filtros
  const [statusFilter, setStatusFilter] = useState<SchemeStatus[]>([])
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [yearFilter, setYearFilter] = useState<string>('')

  const canEdit = user?.rol && ROLES_EDICION.includes(user.rol)
  const canView = user?.rol && ROLES_VISTA.includes(user.rol)

  // Cargar usuario
  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_VISTA.includes(usuario.rol)) {
      router.push('/dashboard')
      return
    }
    setUser(usuario)
  }, [router])

  // Cargar esquemas
  useEffect(() => {
    async function loadSchemes() {
      try {
        setLoading(true)
        const params = new URLSearchParams()

        if (statusFilter.length > 0) {
          params.set('status', statusFilter.join(','))
        }
        if (typeFilter) {
          params.set('scheme_type', typeFilter)
        }
        if (yearFilter) {
          params.set('year', yearFilter)
        }
        if (searchTerm) {
          params.set('search', searchTerm)
        }

        const response = await fetch(`/api/comisiones/esquemas?${params.toString()}`)
        const data = await response.json()

        if (data.schemes) {
          setSchemes(data.schemes)
        }
      } catch (error) {
        console.error('Error cargando esquemas:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadSchemes()
    }
  }, [user, statusFilter, typeFilter, yearFilter, searchTerm])

  const handleStatusFilterChange = (status: SchemeStatus, checked: boolean) => {
    if (checked) {
      setStatusFilter([...statusFilter, status])
    } else {
      setStatusFilter(statusFilter.filter(s => s !== status))
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(amount)
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Esquemas de Comisiones</h1>
          <p className="text-muted-foreground">
            Gestiona los esquemas de comisiones para el personal comercial
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" disabled>
              <Download className="mr-2 h-4 w-4" />
              Importar
            </Button>
            <Button onClick={() => router.push('/comisiones/esquemas/nuevo')}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Esquema
            </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filtro por estado */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[150px] justify-start">
                  <Filter className="mr-2 h-4 w-4" />
                  Estado
                  {statusFilter.length > 0 && (
                    <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      {statusFilter.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-4" align="start">
                <div className="space-y-2">
                  {(Object.keys(SCHEME_STATUS_LABELS) as SchemeStatus[]).map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={status}
                        checked={statusFilter.includes(status)}
                        onCheckedChange={(checked) =>
                          handleStatusFilterChange(status, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={status}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {SCHEME_STATUS_LABELS[status]}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Filtro por tipo */}
            <Select value={typeFilter || 'all'} onValueChange={(val) => setTypeFilter(val === 'all' ? '' : val)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="asesor">Asesor</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por año */}
            <Select value={yearFilter || 'all'} onValueChange={(val) => setYearFilter(val === 'all' ? '' : val)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Limpiar filtros */}
            {(statusFilter.length > 0 || typeFilter || yearFilter || searchTerm) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStatusFilter([])
                  setTypeFilter('')
                  setYearFilter('')
                  setSearchTerm('')
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla de esquemas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Esquemas
          </CardTitle>
          <CardDescription>
            {loading ? 'Cargando...' : `${schemes.length} esquemas encontrados`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : schemes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay esquemas que mostrar</p>
              {canEdit && (
                <Button
                  className="mt-4"
                  onClick={() => router.push('/comisiones/esquemas/nuevo')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primer esquema
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Cuota SS</TableHead>
                  <TableHead className="text-right">Variable</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schemes.map((scheme) => (
                  <TableRow key={scheme.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{scheme.name}</div>
                        <div className="text-sm text-muted-foreground">{scheme.code}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {SCHEME_TYPE_LABELS[scheme.scheme_type]}
                    </TableCell>
                    <TableCell>
                      {formatPeriod(scheme.year, scheme.month)}
                    </TableCell>
                    <TableCell>
                      <SchemeStatusBadge status={scheme.status} />
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{scheme.source}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {scheme.total_ss_quota} líneas
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(scheme.variable_salary)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Acciones
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/comisiones/esquemas/${scheme.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalle
                          </DropdownMenuItem>
                          {canEdit && scheme.status === 'draft' && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/comisiones/esquemas/${scheme.id}/editar`)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {canEdit && (
                            <DropdownMenuItem disabled>
                              <Copy className="mr-2 h-4 w-4" />
                              Clonar
                            </DropdownMenuItem>
                          )}
                          {canEdit && scheme.status === 'draft' && (
                            <DropdownMenuItem disabled>
                              <Check className="mr-2 h-4 w-4" />
                              Aprobar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
