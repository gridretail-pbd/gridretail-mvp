'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  CheckCircle2, AlertTriangle, XCircle, Search,
  CheckSquare, Square, MinusSquare,
} from 'lucide-react'
import {
  NIVEL_COMPLETITUD_LABELS, NIVEL_COMPLETITUD_COLORS, CAMPOS_DESTINO,
  ESTADO_VERIFICACION_IDENTIDAD_LABELS, ESTADO_VERIFICACION_IDENTIDAD_COLORS,
} from '@/lib/rrhh/types'
import type { DetalleFilaImportacion } from '@/lib/rrhh/interfaces'
import { cn } from '@/lib/utils'

interface StepRevisionProps {
  detalleFilas: DetalleFilaImportacion[]
  filasIncluidas: number[]
  onToggleFila: (fila: number) => void
  onSetFilasIncluidas: (filas: number[]) => void
  onPrev: () => void
  onNext: () => void
  loading: boolean
}

const ESTADO_ICON = {
  VALIDO: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  WARNING: <AlertTriangle className="w-4 h-4 text-yellow-600" />,
  ERROR: <XCircle className="w-4 h-4 text-red-600" />,
  SALTADO: <MinusSquare className="w-4 h-4 text-gray-400" />,
}

const ROWS_PER_PAGE = 25

export function StepRevision({
  detalleFilas,
  filasIncluidas,
  onToggleFila,
  onSetFilasIncluidas,
  onPrev,
  onNext,
  loading,
}: StepRevisionProps) {
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('all')
  const [filtroCompletitud, setFiltroCompletitud] = useState<string>('all')
  const [filtroTipo, setFiltroTipo] = useState<string>('all')
  const [filtroIdentidad, setFiltroIdentidad] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const filasIncSet = useMemo(() => new Set(filasIncluidas), [filasIncluidas])

  const filteredFilas = useMemo(() => {
    let result = detalleFilas

    if (search) {
      const term = search.toLowerCase()
      result = result.filter(f =>
        f.nombre.toLowerCase().includes(term) ||
        f.dni.includes(term) ||
        String(f.fila_excel).includes(term),
      )
    }

    if (filtroEstado !== 'all') {
      result = result.filter(f => f.estado === filtroEstado)
    }

    if (filtroCompletitud !== 'all') {
      result = result.filter(f => f.nivel_completitud === filtroCompletitud)
    }

    if (filtroTipo !== 'all') {
      result = result.filter(f => filtroTipo === 'cesado' ? f.es_cesado : !f.es_cesado)
    }

    if (filtroIdentidad !== 'all') {
      result = result.filter(f => f.verificacion_identidad?.estado === filtroIdentidad)
    }

    return result
  }, [detalleFilas, search, filtroEstado, filtroCompletitud, filtroTipo, filtroIdentidad])

  const totalPages = Math.ceil(filteredFilas.length / ROWS_PER_PAGE)
  const pagedFilas = filteredFilas.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)

  const seleccionados = filteredFilas.filter(f => filasIncSet.has(f.fila_excel)).length
  const allSelected = seleccionados === filteredFilas.length && filteredFilas.length > 0
  const someSelected = seleccionados > 0 && !allSelected

  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all filtered
      const filteredSet = new Set(filteredFilas.map(f => f.fila_excel))
      onSetFilasIncluidas(filasIncluidas.filter(f => !filteredSet.has(f)))
    } else {
      // Select all filtered (non-error)
      const eligibleFilas = filteredFilas.filter(f => f.estado !== 'ERROR').map(f => f.fila_excel)
      const currentSet = new Set(filasIncluidas)
      for (const f of eligibleFilas) currentSet.add(f)
      onSetFilasIncluidas([...currentSet])
    }
  }

  const totalIncluidos = filasIncluidas.length
  const importables = detalleFilas.filter(f => f.estado !== 'ERROR')

  const campoLabel = (campo: string): string => {
    const def = CAMPOS_DESTINO.find(c => c.campo === campo)
    return def?.label || campo.split('.').pop() || campo
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Revisión y Confirmación</h2>
        <p className="text-sm text-gray-500">
          Revisa cada colaborador, incluye o excluye filas, y confirma la importación.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalIncluidos}</p>
            <p className="text-xs text-gray-500">Incluidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-gray-400">
              {importables.length - totalIncluidos}
            </p>
            <p className="text-xs text-gray-500">Excluidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-red-500">
              {detalleFilas.length - importables.length}
            </p>
            <p className="text-xs text-gray-500">Con errores</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, DNI o fila..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-9"
          />
        </div>
        <Select value={filtroEstado} onValueChange={(v) => { setFiltroEstado(v); setPage(0) }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="VALIDO">Válidos</SelectItem>
            <SelectItem value="WARNING">Advertencias</SelectItem>
            <SelectItem value="ERROR">Errores</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCompletitud} onValueChange={(v) => { setFiltroCompletitud(v); setPage(0) }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Completitud" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="COMPLETO">Completo</SelectItem>
            <SelectItem value="PARCIAL">Parcial</SelectItem>
            <SelectItem value="MINIMO">Mínimo</SelectItem>
            <SelectItem value="INSUFICIENTE">Insuficiente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={(v) => { setFiltroTipo(v); setPage(0) }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="cesado">Cesados</SelectItem>
          </SelectContent>
        </Select>
        {detalleFilas.some(f => f.verificacion_identidad) && (
          <Select value={filtroIdentidad} onValueChange={(v) => { setFiltroIdentidad(v); setPage(0) }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Identidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Identidad: Todos</SelectItem>
              <SelectItem value="VERIFICADO">Verificado</SelectItem>
              <SelectItem value="NOMBRE_REVISAR">Revisar</SelectItem>
              <SelectItem value="NOMBRE_NO_COINCIDE">No coincide</SelectItem>
              <SelectItem value="NO_ENCONTRADO">No encontrado</SelectItem>
              <SelectItem value="ERROR_API">Error API</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <button onClick={handleSelectAll} className="p-1">
                      {allSelected
                        ? <CheckSquare className="w-4 h-4 text-blue-600" />
                        : someSelected
                          ? <MinusSquare className="w-4 h-4 text-blue-400" />
                          : <Square className="w-4 h-4 text-gray-400" />
                      }
                    </button>
                  </TableHead>
                  <TableHead className="w-14">Fila</TableHead>
                  <TableHead className="w-10">Est.</TableHead>
                  <TableHead className="w-24">DNI</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-20">Tipo</TableHead>
                  <TableHead className="w-28">Completitud</TableHead>
                  <TableHead className="w-28">Identidad</TableHead>
                  <TableHead className="w-16 text-center">Obs.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedFilas.map(fila => {
                  const included = filasIncSet.has(fila.fila_excel)
                  const isError = fila.estado === 'ERROR'
                  const isExpanded = expandedRow === fila.fila_excel

                  return (
                    <>
                      <TableRow
                        key={fila.fila_excel}
                        className={cn(
                          'cursor-pointer',
                          isError && 'bg-red-50 opacity-60',
                          !included && !isError && 'opacity-50',
                        )}
                        onClick={() => setExpandedRow(isExpanded ? null : fila.fila_excel)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {!isError && (
                            <button
                              onClick={() => onToggleFila(fila.fila_excel)}
                              className="p-1"
                            >
                              {included
                                ? <CheckSquare className="w-4 h-4 text-blue-600" />
                                : <Square className="w-4 h-4 text-gray-400" />
                              }
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">{fila.fila_excel}</TableCell>
                        <TableCell>{ESTADO_ICON[fila.estado]}</TableCell>
                        <TableCell className="font-mono text-xs">{fila.dni || '—'}</TableCell>
                        <TableCell className="font-medium text-sm">{fila.nombre || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', fila.es_cesado ? 'text-gray-500' : 'text-green-700')}>
                            {fila.es_cesado ? 'Cesado' : 'Activo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', NIVEL_COMPLETITUD_COLORS[fila.nivel_completitud])}>
                            {NIVEL_COMPLETITUD_LABELS[fila.nivel_completitud]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {fila.verificacion_identidad ? (
                            <Badge className={cn('text-xs', ESTADO_VERIFICACION_IDENTIDAD_COLORS[fila.verificacion_identidad.estado])}>
                              {fila.verificacion_identidad.confirmado_manualmente
                                ? 'Manual'
                                : ESTADO_VERIFICACION_IDENTIDAD_LABELS[fila.verificacion_identidad.estado]}
                              {fila.verificacion_identidad.confianza_nombre !== null && (
                                <span className="ml-1 opacity-75">
                                  {Math.round(fila.verificacion_identidad.confianza_nombre * 100)}%
                                </span>
                              )}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {fila.errores.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {fila.errores.length}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <TableRow key={`${fila.fila_excel}-detail`}>
                          <TableCell colSpan={9} className="bg-gray-50 p-4">
                            <div className="space-y-3">
                              {fila.errores.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-gray-600 mb-1">Observaciones:</p>
                                  <div className="space-y-1">
                                    {fila.errores.map((e, i) => (
                                      <div key={i} className={cn(
                                        'text-xs p-1.5 rounded',
                                        e.tipo === 'ERROR' ? 'bg-red-100 text-red-700' :
                                          e.tipo === 'WARNING' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-blue-50 text-blue-700',
                                      )}>
                                        <span className="font-medium">{campoLabel(e.campo)}:</span> {e.mensaje}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {fila.verificacion_identidad && (
                                <div>
                                  <p className="text-xs font-medium text-gray-600 mb-1">Verificacion RENIEC:</p>
                                  <div className="text-xs space-y-0.5">
                                    <p>Estado: <strong>{ESTADO_VERIFICACION_IDENTIDAD_LABELS[fila.verificacion_identidad.estado]}</strong></p>
                                    {fila.verificacion_identidad.nombre_oficial && (
                                      <p>Nombre oficial: <strong>{fila.verificacion_identidad.nombre_oficial}</strong></p>
                                    )}
                                    {fila.verificacion_identidad.confianza_nombre !== null && (
                                      <p>Confianza: {Math.round(fila.verificacion_identidad.confianza_nombre * 100)}%</p>
                                    )}
                                    {fila.verificacion_identidad.confirmado_manualmente && (
                                      <p className="text-blue-700">
                                        Confirmado manualmente: {fila.verificacion_identidad.justificacion_manual}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-medium text-gray-600 mb-1">Datos mapeados:</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                                  {Object.entries(fila.datos_mapeados)
                                    .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                    .map(([campo, valor]) => (
                                      <div key={campo} className="text-xs">
                                        <span className="text-gray-500">{campoLabel(campo)}:</span>{' '}
                                        <span className="font-medium">{String(valor)}</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-gray-500">
                Mostrando {page * ROWS_PER_PAGE + 1}-{Math.min((page + 1) * ROWS_PER_PAGE, filteredFilas.length)} de {filteredFilas.length}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation */}
      <div className={cn(
        'p-4 rounded-lg text-sm',
        totalIncluidos > 0
          ? 'bg-blue-50 border border-blue-200 text-blue-800'
          : 'bg-gray-50 border border-gray-200 text-gray-600',
      )}>
        {totalIncluidos > 0 ? (
          <p>
            Se importarán <strong>{totalIncluidos}</strong> colaboradores.
            Esta acción creará registros en la base de datos y no puede deshacerse fácilmente.
          </p>
        ) : (
          <p>No hay filas seleccionadas para importar. Selecciona al menos una fila.</p>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev}>Anterior</Button>
        <Button
          onClick={onNext}
          disabled={loading || totalIncluidos === 0}
          variant={totalIncluidos > 0 ? 'default' : 'secondary'}
        >
          {loading ? 'Importando...' : `Importar ${totalIncluidos} colaboradores`}
        </Button>
      </div>
    </div>
  )
}
