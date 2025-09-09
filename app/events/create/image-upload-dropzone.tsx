'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, CheckCircle, Image as ImageIcon, AlertTriangle } from 'lucide-react'

interface ImageUploadDropzoneProps {
  onImageSelect: (file: File) => void
  imagePreview?: string
  onImageRemove: () => void
  isUploading: boolean
  uploadProgress: number
  maxSize?: number // in MB
  acceptedTypes?: string[]
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

export default function ImageUploadDropzone({
  onImageSelect,
  imagePreview,
  onImageRemove,
  isUploading,
  uploadProgress,
  maxSize = 5,
  acceptedTypes = ACCEPTED_TYPES
}: ImageUploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      return `Please upload a valid image file. Accepted formats: ${acceptedTypes.map(type => type.split('/')[1]).join(', ')}`
    }

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `File size must be less than ${maxSize}MB`
    }

    return null
  }, [acceptedTypes, maxSize])

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    const validationError = validateFile(file)

    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    onImageSelect(file)
  }, [validateFile, onImageSelect])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
  }, [handleFileSelect])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      {!imagePreview ? (
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
            ${isDragOver 
              ? 'border-[#0b6d41] bg-[#0b6d41]/5 scale-105' 
              : error 
                ? 'border-red-300 bg-red-50 hover:border-red-400' 
                : 'border-gray-300 bg-gray-50 hover:border-[#0b6d41] hover:bg-[#0b6d41]/5'
            }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          <div className="space-y-4">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-colors
              ${isDragOver ? 'bg-[#0b6d41] text-white' : error ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}
            >
              {error ? (
                <AlertTriangle className="h-8 w-8" />
              ) : (
                <Upload className="h-8 w-8" />
              )}
            </div>
            
            <div>
              <h3 className={`text-lg font-semibold mb-2 ${error ? 'text-red-900' : 'text-gray-900'}`}>
                {isDragOver ? 'Drop your image here' : 'Upload Event Banner'}
              </h3>
              <p className={`text-sm mb-4 ${error ? 'text-red-600' : 'text-gray-600'}`}>
                {error || 'Drag and drop your image here, or click to browse'}
              </p>
              
              {!error && (
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Supported formats: JPEG, PNG, WebP, SVG</p>
                  <p>Maximum size: {maxSize}MB</p>
                  <p>Recommended: 1200x600px or 16:9 aspect ratio</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative group">
          <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
            <div className="aspect-video relative">
              <img
                src={imagePreview}
                alt="Event banner preview"
                className="w-full h-full object-cover"
              />
              
              {/* Upload Progress Overlay */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                  <div className="w-32 bg-white/20 rounded-full h-2 mb-4">
                    <div 
                      className="h-2 bg-[#0b6d41] rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm font-medium">Uploading... {uploadProgress}%</p>
                </div>
              )}
              
              {/* Success Indicator */}
              {!isUploading && uploadProgress === 100 && (
                <div className="absolute top-4 left-4 bg-green-500 text-white p-2 rounded-full">
                  <CheckCircle className="h-5 w-5" />
                </div>
              )}
            </div>
            
            {/* Remove Button */}
            <button
              type="button"
              onClick={onImageRemove}
              disabled={isUploading}
              className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Remove image"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Image Details */}
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              <span>Event banner ready</span>
            </div>
            <button
              type="button"
              onClick={handleClick}
              disabled={isUploading}
              className="text-[#0b6d41] hover:text-[#0a5d37] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Change image
            </button>
          </div>
        </div>
      )}
    </div>
  )
}