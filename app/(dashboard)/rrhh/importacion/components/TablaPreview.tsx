'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TablaPreviewProps {
  columnas: string[]
  datos: Record<string, unknown>[]
  maxFilas?: number
  maxColumnas?: number
}

export function TablaPreview({ columnas, datos, maxFilas = 10, maxColumnas = 12 }: TablaPreviewProps) {
  const colsVisibles = columnas.slice(0, maxColumnas)
  const filasVisibles = datos.slice(0, maxFilas)
  const colsTruncadas = columnas.length > maxColumnas

  return (
    <div className="border rounded-lg overflow-auto max-h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center sticky left-0 bg-gray-50 z-10">#</TableHead>
            {colsVisibles.map((col) => (
              <TableHead key={col} className="min-w-[140px] text-xs font-medium whitespace-nowrap">
                {col}
              </TableHead>
            ))}
            {colsTruncadas && (
              <TableHead className="text-xs text-gray-400">
                +{columnas.length - maxColumnas} más
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filasVisibles.map((fila, i) => (
            <TableRow key={i}>
              <TableCell className="text-center text-xs text-gray-500 sticky left-0 bg-white z-10">
                {i + 1}
              </TableCell>
              {colsVisibles.map((col) => (
                <TableCell key={col} className="text-xs max-w-[200px] truncate">
                  {fila[col] != null ? String(fila[col]) : ''}
                </TableCell>
              ))}
              {colsTruncadas && <TableCell />}
            </TableRow>
          ))}
          {datos.length > maxFilas && (
            <TableRow>
              <TableCell colSpan={colsVisibles.length + 1 + (colsTruncadas ? 1 : 0)} className="text-center text-xs text-gray-400 py-2">
                Mostrando {maxFilas} de {datos.length} filas
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
