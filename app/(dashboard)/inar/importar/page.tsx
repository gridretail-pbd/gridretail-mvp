'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FileUploader } from '@/components/inar/FileUploader'
import { ImportPreview } from '@/components/inar/ImportPreview'
import { ImportStats } from '@/components/inar/ImportStats'
import { getUsuarioFromLocalStorage } from '@/lib/auth-client'

interface ImportStats {
  totalInFile: number
  newRecords: number
  existingRecords: number
}

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

interface ImportResult {
  totalProcessed: number
  inserted: number
  errors: number
  errorDetails: string[]
}

export default function ImportarInarPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [preview, setPreview] = useState<InarRecord[]>([])
  const [newRecords, setNewRecords] = useState<InarRecord[]>([])
  const [fileName, setFileName] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = async (file: File) => {
    setIsLoading(true)
    setError(null)
    setStats(null)
    setPreview([])
    setNewRecords([])
    setImportResult(null)
    setFileName(file.name)
    setProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', file)

      setProgress(30)

      const response = await fetch('/api/inar/import', {
        method: 'POST',
        body: formData,
      })

      setProgress(70)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar el archivo')
      }

      setStats(data.stats)
      setPreview(data.preview)
      setNewRecords(data.allNewRecords)
      setProgress(100)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmImport = async () => {
    if (newRecords.length === 0) {
      setError('No hay registros nuevos para importar')
      return
    }

    setIsConfirming(true)
    setError(null)
    setProgress(0)

    try {
      const user = getUsuarioFromLocalStorage()

      // Simular progreso durante la importación
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90))
      }, 200)

      const response = await fetch('/api/inar/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: newRecords,
          fileName: fileName,
          userId: user?.id,
        }),
      })

      clearInterval(progressInterval)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al confirmar la importación')
      }

      setProgress(100)
      setImportResult(data.summary)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsConfirming(false)
    }
  }

  const handleNewImport = () => {
    setStats(null)
    setPreview([])
    setNewRecords([])
    setImportResult(null)
    setError(null)
    setProgress(0)
    setFileName('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/inar')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importar INAR</h1>
          <p className="text-muted-foreground">
            Importa el archivo Excel de líneas activadas de Entel
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {importResult ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              Importación completada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{importResult.totalProcessed}</p>
                <p className="text-sm text-muted-foreground">Total procesados</p>
              </div>
              <div className="text-center p-4 bg-green-100 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {importResult.inserted}
                </p>
                <p className="text-sm text-green-600">Insertados</p>
              </div>
              <div className="text-center p-4 bg-red-100 rounded-lg">
                <p className="text-2xl font-bold text-red-600">
                  {importResult.errors}
                </p>
                <p className="text-sm text-red-600">Errores</p>
              </div>
            </div>

            {importResult.errorDetails.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Errores durante la importación</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {importResult.errorDetails.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4">
              <Button onClick={handleNewImport}>Nueva importación</Button>
              <Button variant="outline" onClick={() => router.push('/inar')}>
                Ver historial
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {!stats && (
            <FileUploader onFileSelect={handleFileSelect} isLoading={isLoading} />
          )}

          {(isLoading || isConfirming) && (
            <Card>
              <CardContent className="py-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>
                      {isLoading ? 'Procesando archivo...' : 'Importando registros...'}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              </CardContent>
            </Card>
          )}

          {stats && !isLoading && (
            <>
              <ImportStats
                totalInFile={stats.totalInFile}
                newRecords={stats.newRecords}
                existingRecords={stats.existingRecords}
              />

              <ImportPreview records={preview} totalRecords={stats.totalInFile} />

              <Card>
                <CardContent className="py-6">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div>
                      <p className="font-medium">
                        {stats.newRecords > 0
                          ? `Se importarán ${stats.newRecords} registros nuevos`
                          : 'No hay registros nuevos para importar'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {stats.existingRecords} registros ya existen y serán omitidos
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleNewImport}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleConfirmImport}
                        disabled={stats.newRecords === 0 || isConfirming}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Confirmar importación
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
