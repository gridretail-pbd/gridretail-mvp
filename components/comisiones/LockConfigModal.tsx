'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { lockFormSchema, type LockFormValues } from '@/lib/comisiones/validations'
import { CommissionItemType, CommissionItemLock, LOCK_TYPE_LABELS } from '@/lib/comisiones'
import { useState } from 'react'

interface LockConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  itemTypes: CommissionItemType[]
  existingLocks: CommissionItemLock[]
  onAddLock: (values: LockFormValues) => Promise<void>
  onDeleteLock: (lockId: string) => Promise<void>
  isLoading?: boolean
}

export function LockConfigModal({
  open,
  onOpenChange,
  itemName,
  itemTypes,
  existingLocks,
  onAddLock,
  onDeleteLock,
  isLoading,
}: LockConfigModalProps) {
  const [addingNew, setAddingNew] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const form = useForm<LockFormValues>({
    resolver: zodResolver(lockFormSchema),
    defaultValues: {
      lock_type: 'min_quantity',
      required_item_type_id: null,
      required_value: 0,
      description: '',
      is_active: true,
    },
  })

  const lockType = form.watch('lock_type')

  const handleSubmit = async (values: LockFormValues) => {
    await onAddLock(values)
    form.reset()
    setAddingNew(false)
  }

  const handleDelete = async (lockId: string) => {
    setDeletingId(lockId)
    await onDeleteLock(lockId)
    setDeletingId(null)
  }

  const getLockDescription = (lock: CommissionItemLock) => {
    const typeName = lock.required_item_type?.name || lock.required_item_type?.code || ''
    switch (lock.lock_type) {
      case 'min_quantity':
        return `Mínimo ${lock.required_value} unidades de ${typeName}`
      case 'min_amount':
        return `Mínimo S/. ${lock.required_value} en ${typeName}`
      case 'min_percentage':
        return `Mínimo ${lock.required_value}% de ${typeName}`
      case 'min_fulfillment':
        return `Cumplimiento mínimo global de ${lock.required_value}%`
      default:
        return lock.description || 'Condición configurada'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Candados para: {itemName}</DialogTitle>
          <DialogDescription>
            Configura las condiciones que deben cumplirse para que esta partida comisione
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Candados existentes */}
          {existingLocks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Candados configurados</h4>
              {existingLocks.map((lock) => (
                <div
                  key={lock.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{LOCK_TYPE_LABELS[lock.lock_type]}</p>
                    <p className="text-xs text-muted-foreground">
                      {getLockDescription(lock)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(lock.id)}
                    disabled={deletingId === lock.id}
                  >
                    {deletingId === lock.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Formulario para nuevo candado */}
          {addingNew ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 p-4 border rounded-lg">
                <h4 className="text-sm font-medium">Nuevo candado</h4>

                <FormField
                  control={form.control}
                  name="lock_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de condición</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(LOCK_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {lockType !== 'min_fulfillment' && (
                  <FormField
                    control={form.control}
                    name="required_item_type_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Producto requerido</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar producto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {itemTypes.map(type => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name} ({type.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Producto que debe venderse para desbloquear esta partida
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="required_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {lockType === 'min_quantity'
                          ? 'Cantidad mínima'
                          : lockType === 'min_amount'
                          ? 'Monto mínimo (S/.)'
                          : 'Porcentaje mínimo (%)'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step={lockType === 'min_amount' ? '0.01' : '1'}
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: Vender al menos 2 seguros MEP"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>Candado activo</FormLabel>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setAddingNew(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Candado
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setAddingNew(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar Candado
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
