'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const loginSchema = z.object({
  codigo_asesor: z.string().min(1, 'El código de asesor es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      codigo_asesor: '',
      password: '',
    },
  })

  async function onSubmit(values: LoginFormValues) {
    console.log('1. Iniciando login...')
    setIsLoading(true)
    setError(null)

    try {
      console.log('2. Enviando petición...')
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo_asesor: values.codigo_asesor,
          password: values.password,
        }),
      })

      console.log('3. Respuesta recibida, status:', response.status)

      const data = await response.json()
      console.log('4. Data parseada:', data)

      if (!response.ok) {
        console.log('5a. Error en respuesta')
        setError(data.error || 'Error al iniciar sesión')
        return
      }

      console.log('5b. Login exitoso, guardando sesión...')

      // Guardar usuario en localStorage
      if (data.usuario) {
        localStorage.setItem('user', JSON.stringify(data.usuario))
        console.log('Usuario guardado en localStorage')
      }

      console.log('6. Redirigiendo a /seleccionar-tienda...')
      router.push('/seleccionar-tienda')
      router.refresh()

    } catch (err) {
      console.error('ERROR CATCH:', err)
      setError('Error al conectar con el servidor')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">GridRetail</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="codigo_asesor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código de Asesor</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ingresa tu código"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
