'use client'

import { useCallback, useState } from 'react'
import { Upload, FileSpreadsheet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface FileUploaderProps {
  onFileSelect: (file: File) => void
  isLoading?: boolean
  acceptedFormats?: string
}

export function FileUploader({
  onFileSelect,
  isLoading = false,
  acceptedFormats = '.xlsx,.xls',
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        if (
          file.name.endsWith('.xlsx') ||
          file.name.endsWith('.xls')
        ) {
          setSelectedFile(file)
          onFileSelect(file)
        } else {
          alert('Por favor selecciona un archivo Excel (.xlsx o .xls)')
        }
      }
    },
    [onFileSelect]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        setSelectedFile(files[0])
        onFileSelect(files[0])
      }
    },
    [onFileSelect]
  )

  const clearFile = useCallback(() => {
    setSelectedFile(null)
  }, [])

  return (
    <Card>
      <CardContent className="p-6">
        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              Arrastra y suelta tu archivo Excel aquí
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              o haz clic para seleccionar
            </p>
            <input
              type="file"
              accept={acceptedFormats}
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
              disabled={isLoading}
            />
            <Button asChild variant="outline" disabled={isLoading}>
              <label htmlFor="file-upload" className="cursor-pointer">
                Seleccionar archivo
              </label>
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-10 w-10 text-green-600" />
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFile}
              disabled={isLoading}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
