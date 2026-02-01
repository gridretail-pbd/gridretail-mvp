'use client'

import { FileSpreadsheet, Plus, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ImportStatsProps {
  totalInFile: number
  newRecords: number
  existingRecords: number
  errors?: number
}

export function ImportStats({
  totalInFile,
  newRecords,
  existingRecords,
  errors = 0,
}: ImportStatsProps) {
  const stats = [
    {
      title: 'Total en archivo',
      value: totalInFile,
      icon: FileSpreadsheet,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Registros nuevos',
      value: newRecords,
      icon: Plus,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Ya existentes',
      value: existingRecords,
      icon: CheckCircle2,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    },
    {
      title: 'Errores',
      value: errors,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      hidden: errors === 0,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats
        .filter((stat) => !stat.hidden)
        .map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.color}`}>
                {stat.value.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  )
}
