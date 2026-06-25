'use client'

import { useCallback, useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, X, Download, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepSubidaProps {
  onFileSelect: (file: File | null) => void
  selectedFile: File | null
  loading: boolean
  error: string | null
  onNext: () => void
}

const ACCEPTED_EXTENSIONS = ['xlsx', 'xls', 'csv']
const MAX_SIZE_MB = 10

export function StepSubida({ onFileSelect, selectedFile, loading, error, onNext }: StepSubidaProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !ACCEPTED_EXTENSIONS.includes(ext)) {
      return 'Formato no soportado. Use .xlsx, .xls o .csv'
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `El archivo excede el límite de ${MAX_SIZE_MB}MB`
    }
    return null
  }, [])

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      alert(validationError)
      return
    }
    onFileSelect(file)
  }, [validateFile, onFileSelect])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleRemove = useCallback(() => {
    onFileSelect(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [onFileSelect])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Subida del Archivo</h2>
        <p className="text-sm text-gray-500">
          Puedes usar nuestro template o subir tu propio archivo. El sistema analizará las columnas automáticamente.
        </p>
      </div>

      {/* Download template link */}
      <div className="flex justify-center">
        <Button variant="outline" size="sm" asChild>
          <a href="/api/rrhh/importacion/template" download>
            <Download className="w-4 h-4 mr-2" />
            Descargar template de ejemplo
          </a>
        </Button>
      </div>

      {/* Dropzone */}
      {!selectedFile ? (
        <Card
          className={cn(
            'border-2 border-dashed cursor-pointer transition-colors',
            isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className={cn('w-12 h-12 mb-4', isDragging ? 'text-blue-500' : 'text-gray-400')} />
            <p className="text-sm font-medium text-gray-700">
              Arrastra tu archivo aquí o haz clic para seleccionar
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Excel (.xlsx, .xls) o CSV — Máximo {MAX_SIZE_MB}MB
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleInputChange}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatSize(selectedFile.size)}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRemove} disabled={loading}>
              <X className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!selectedFile || loading}>
          {loading ? 'Analizando...' : 'Analizar Archivo'}
        </Button>
      </div>
    </div>
  )
}
