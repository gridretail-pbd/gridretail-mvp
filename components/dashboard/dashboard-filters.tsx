'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tienda, Usuario } from '@/types'
import { RefreshCw } from 'lucide-react'
import { canSeeAllTiendas } from '@/lib/auth-client'

interface DashboardFiltersProps {
  tiendas: Tienda[]
  selectedTiendaId: string
  selectedDate: string
  onTiendaChange: (tiendaId: string) => void
  onDateChange: (date: string) => void
  onRefresh: () => void
  user: Usuario
}

export function DashboardFilters({
  tiendas,
  selectedTiendaId,
  selectedDate,
  onTiendaChange,
  onDateChange,
  onRefresh,
  user,
}: DashboardFiltersProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const showTiendaFilter = canSeeAllTiendas(user)

  const handleRefresh = () => {
    setIsRefreshing(true)
    onRefresh()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="date-filter" className="text-sm font-medium">
            Fecha:
          </label>
          <input
            id="date-filter"
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Tienda Filter (only for users who can see all tiendas) */}
        {showTiendaFilter && tiendas.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="tienda-filter" className="text-sm font-medium">
              Tienda:
            </label>
            <Select value={selectedTiendaId} onValueChange={onTiendaChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Seleccionar tienda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las tiendas</SelectItem>
                {tiendas.map((tienda) => (
                  <SelectItem key={tienda.id} value={tienda.id}>
                    {tienda.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
      >
        <RefreshCw
          className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
        />
        Refrescar
      </Button>
    </div>
  )
}
