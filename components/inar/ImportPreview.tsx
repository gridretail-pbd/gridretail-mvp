'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

interface InarRecord {
  vchc_contratofs: string
  vchtelefono: string
  vchdocumento: string
  vchrazonsocial: string
  vchn_plan: string
  vchmodeloequipo: string
  fecfechaproceso: string
  isNew: boolean
  [key: string]: string | boolean | number | null | undefined
}

interface ImportPreviewProps {
  records: InarRecord[]
  totalRecords: number
}

export function ImportPreview({ records, totalRecords }: ImportPreviewProps) {
  if (records.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Vista previa ({records.length} de {totalRecords} registros)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Estado</TableHead>
                <TableHead>Contrato FS</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Razón Social</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Modelo Equipo</TableHead>
                <TableHead>Fecha Proceso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {record.isNew ? (
                      <Badge variant="default" className="bg-green-600">
                        Nuevo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Existente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {record.vchc_contratofs}
                  </TableCell>
                  <TableCell>{record.vchtelefono}</TableCell>
                  <TableCell>{record.vchdocumento}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {record.vchrazonsocial}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {record.vchn_plan}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {record.vchmodeloequipo}
                  </TableCell>
                  <TableCell>{record.fecfechaproceso}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
