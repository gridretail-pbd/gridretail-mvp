'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Loader2 } from 'lucide-react'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations/usuario'

interface ResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  usuarioId: string
  usuarioNombre: string
}

export function ResetPasswordDialog({ open, onOpenChange, usuarioId, usuarioNombre }: ResetPasswordDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { new_password: '', confirm_password: '' },
  })

  async function onSubmit(values: ResetPasswordFormData) {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/usuarios/${usuarioId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: values.new_password }),
      })

      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Error al cambiar contraseña')
        return
      }

      alert('Contraseña actualizada correctamente')
      form.reset()
      onOpenChange(false)
    } catch {
      alert('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Contraseña</DialogTitle>
          <DialogDescription>
            Cambiar contraseña de {usuarioNombre}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mínimo 8 caracteres" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Repetir contraseña" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres, incluir al menos 1 número
            </p>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cambiar Contraseña
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
