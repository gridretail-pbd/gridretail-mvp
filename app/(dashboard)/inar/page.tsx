'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'

interface Importacion {
  id: string
  fecha_importacion: string
  archivo_nombre: string
  periodo: number
  registros_en_archivo: number
  registros_nuevos: number
  registros_existentes: number
  registros_error: number
  estado: string
  usuario_id: string
}

interface Stats {
  totalImportaciones: number
  totalRegistros: number
  ultimaImportacion: string | null
}

export default function InarPage() {
  const router = useRouter()
  const [importaciones, setImportaciones] = useState<Importacion[]>([])
  const [stats, setStats] = useState<Stats>({
    totalImportaciones: 0,
    totalRegistros: 0,
    ultimaImportacion: null,
  })
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const user = getUsuarioFromLocalStorage()
    if (!user) {
      router.push('/login')
      return
    }

    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)

    try {
      // Cargar historial de importaciones
      const { data: importacionesData, error: importError } = await supabase
        .from('inar_importaciones')
        .select('*')
        .order('fecha_importacion', { ascending: false })
        .limit(20)

      if (importError) {
        console.error('Error cargando importaciones:', importError)
      } else {
        setImportaciones(importacionesData || [])
      }

      // Calcular estadísticas
      const { count: totalRegistros } = await supabase
        .from('lineas_inar')
        .select('*', { count: 'exact', head: true })

      // Obtener última importación
      const { data: ultimaData } = await supabase
        .from('inar_importaciones')
        .select('fecha_importacion')
        .order('fecha_importacion', { ascending: false })
        .limit(1)
        .single()

      setStats({
        totalImportaciones: importacionesData?.length || 0,
        totalRegistros: totalRegistros || 0,
        ultimaImportacion: ultimaData?.fecha_importacion || null,
      })
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'COMPLETADO':
        return <Badge className="bg-green-600">Completado</Badge>
      case 'PARCIAL':
        return <Badge className="bg-yellow-600">Parcial</Badge>
      case 'ERROR':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="secondary">{estado}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">INAR</h1>
          <p className="text-muted-foreground">
            Gestión de líneas activadas de Entel
          </p>
        </div>
        <Button onClick={() => router.push('/inar/importar')}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva importación
        </Button>
      </div>

      {/* Estadísticas generales */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de registros
            </CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalRegistros.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Líneas en la base</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Importaciones</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalImportaciones}</div>
            <p className="text-xs text-muted-foreground">Total realizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Última importación
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.ultimaImportacion
                ? format(new Date(stats.ultimaImportacion), 'dd MMM', {
                    locale: es,
                  })
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.ultimaImportacion
                ? format(new Date(stats.ultimaImportacion), 'yyyy HH:mm', {
                    locale: es,
                  })
                : 'Sin importaciones'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Historial de importaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de importaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {importaciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay importaciones registradas</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push('/inar/importar')}
              >
                Realizar primera importación
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Nuevos</TableHead>
                  <TableHead className="text-right">Existentes</TableHead>
                  <TableHead className="text-right">Errores</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importaciones.map((imp) => (
                  <TableRow key={imp.id}>
                    <TableCell>
                      {format(
                        new Date(imp.fecha_importacion),
                        "dd/MM/yyyy HH:mm",
                        { locale: es }
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">
                      {imp.archivo_nombre}
                    </TableCell>
                    <TableCell>{imp.periodo}</TableCell>
                    <TableCell className="text-right">
                      {imp.registros_en_archivo.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {imp.registros_nuevos.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-gray-500">
                      {imp.registros_existentes.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {imp.registros_error}
                    </TableCell>
                    <TableCell>{getEstadoBadge(imp.estado)}</TableCell>
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
