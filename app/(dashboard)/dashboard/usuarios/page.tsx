'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { RolBadge } from '@/components/usuarios/RolBadge'
import { EstadoBadge } from '@/components/usuarios/EstadoBadge'
import { Loader2, Plus, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { ROLES, ROLES_LABELS, ROLES_GESTION_USUARIOS, ROLES_PUEDEN_CREAR } from '@/lib/validations/usuario'
import type { Usuario, RolUsuario } from '@/types'

interface UsuarioConTiendas {
  id: string
  codigo_asesor: string
  dni: string
  nombre_completo: string
  email: string | null
  rol: RolUsuario
  zona: string | null
  activo: boolean
  created_at: string
  tiendas: {
    id: string
    tienda_id: string
    es_principal: boolean
    tienda: { id: string; codigo: string; nombre: string }
  }[]
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function UsuariosPage() {
  const router = useRouter()
  const [user, setUser] = useState<Usuario | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioConTiendas[]>([])
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const usuario = getUsuarioFromLocalStorage()
    if (!usuario) {
      router.push('/login')
      return
    }
    if (!ROLES_GESTION_USUARIOS.includes(usuario.rol as RolUsuario)) {
      router.push('/dashboard')
      return
    }
    setUser(usuario)
  }, [router])

  const fetchUsuarios = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filtroRol) params.set('rol', filtroRol)
      if (filtroEstado) params.set('activo', filtroEstado)
      params.set('page', page.toString())
      params.set('limit', '10')

      const response = await fetch(`/api/usuarios?${params}`)
      const data = await response.json()

      if (response.ok) {
        setUsuarios(data.data)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error)
    } finally {
      setIsLoading(false)
    }
  }, [search, filtroRol, filtroEstado, page])

  useEffect(() => {
    if (user) fetchUsuarios()
  }, [user, fetchUsuarios])

  // Debounce search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
    if (searchTimeout) clearTimeout(searchTimeout)
    setSearchTimeout(setTimeout(() => {}, 300))
  }

  const puedeCrear = user && ROLES_PUEDEN_CREAR.includes(user.rol as RolUsuario)

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
        </div>
        {puedeCrear && (
          <Button onClick={() => router.push('/dashboard/usuarios/nuevo')}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Usuario
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Input
              placeholder="Buscar por código, nombre o DNI..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filtroRol} onValueChange={(v) => { setFiltroRol(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Rol: Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los roles</SelectItem>
                {ROLES.map(r => (
                  <SelectItem key={r} value={r}>{ROLES_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={(v) => { setFiltroEstado(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado: Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="true">Activos</SelectItem>
                <SelectItem value="false">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : usuarios.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron usuarios
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Tienda(s)</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((u) => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/usuarios/${u.id}`)}
                  >
                    <TableCell className="font-mono text-sm">{u.codigo_asesor}</TableCell>
                    <TableCell>{u.nombre_completo}</TableCell>
                    <TableCell><RolBadge rol={u.rol} /></TableCell>
                    <TableCell className="text-sm">
                      {u.tiendas.length === 0
                        ? <span className="text-muted-foreground">Sin tienda</span>
                        : u.tiendas.map(t => (
                            <span key={t.tienda_id}>
                              {t.tienda.nombre}
                              {t.es_principal && ' ⭐'}
                              {u.tiendas.indexOf(t) < u.tiendas.length - 1 && ', '}
                            </span>
                          ))
                      }
                    </TableCell>
                    <TableCell><EstadoBadge activo={u.activo} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((page - 1) * 10) + 1}-{Math.min(page * 10, pagination.total)} de {pagination.total} usuarios
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
