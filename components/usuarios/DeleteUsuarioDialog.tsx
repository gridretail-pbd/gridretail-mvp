'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

interface DeleteUsuarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  usuarioId: string
  usuarioNombre: string
  onSuccess: () => void
}

export function DeleteUsuarioDialog({ open, onOpenChange, usuarioId, usuarioNombre, onSuccess }: DeleteUsuarioDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleDelete() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/usuarios/${usuarioId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) {
        alert(data.error || 'Error al desactivar usuario')
        return
      }

      onOpenChange(false)
      onSuccess()
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
          <DialogTitle>Desactivar Usuario</DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que deseas desactivar a <strong>{usuarioNombre}</strong>?
            El usuario no podrá acceder al sistema pero sus datos se conservarán.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Desactivar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
