'use client'

import { useState } from 'react'
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2, FileText } from 'lucide-react'

interface BulkUploadResult {
  success: boolean | 'partial'
  message: string
  count?: number
  successCount?: number
  failureCount?: number
  skippedCount?: number
  events?: any[]
  uploadedEvents?: any[]
  validationErrors?: string[]
  errors?: any[]
  failedEvents?: Array<{
    event: any
    error: string
    row?: number
  }>
  skippedRows?: Array<{
    row: number
    reason: string
  }>
}

export function BulkEventUpload({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<BulkUploadResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]
    
    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setResult({
        success: false,
        message: 'Please upload an Excel (.xlsx, .xls) or CSV (.csv) file'
      })
      return
    }
    
    setFile(selectedFile)
    setResult(null)
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/events/bulk-upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      
      if (response.ok || response.status === 207) {
        setResult(data)
        // Refresh page if any events were uploaded successfully
        if ((data.success === true || data.success === 'partial') && data.successCount > 0 && onUploadSuccess) {
          onUploadSuccess()
        }
      } else {
        setResult({
          success: false,
          message: data.error || 'Upload failed',
          validationErrors: data.validationErrors
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to upload file. Please try again.'
      })
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/events/bulk-upload', {
        method: 'GET'
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'bulk-events-template.xlsx'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to download template:', error)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        <Upload className="w-4 h-4" />
        Bulk Upload
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Bulk Event Upload</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Upload multiple events at once using Excel or CSV
                </p>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false)
                  reset()
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Download Template */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-blue-900">Download Template</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Start with our Excel template that includes all required fields
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download Template
                    </button>
                  </div>
                </div>
              </div>

              {/* File Upload Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                    className="hidden"
                    id="file-upload"
                  />
                  
                  {file ? (
                    <div className="space-y-2">
                      <FileText className="w-12 h-12 text-green-600 mx-auto" />
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-600">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                      <button
                        onClick={reset}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer"
                      >
                        <span className="text-blue-600 hover:text-blue-700 font-medium">
                          Click to upload
                        </span>
                        <span className="text-gray-600"> or drag and drop</span>
                      </label>
                      <p className="text-sm text-gray-500 mt-2">
                        Excel (.xlsx, .xls) or CSV files only
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Required Fields:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>title:</strong> Event name</li>
                  <li>• <strong>date:</strong> Format: YYYY-MM-DD (e.g., 2024-12-25)</li>
                  <li>• <strong>time:</strong> Format: HH:MM (e.g., 18:00)</li>
                  <li>• <strong>venue:</strong> Venue name</li>
                  <li>• <strong>location:</strong> Full address</li>
                </ul>
                <h4 className="font-medium text-gray-900 mt-3 mb-2">Optional Fields:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>description:</strong> Event details</li>
                  <li>• <strong>category:</strong> Technology, Music, Business, etc.</li>
                  <li>• <strong>price:</strong> Ticket price (default: 0)</li>
                  <li>• <strong>max_attendees:</strong> Maximum capacity (default: 100)</li>
                  <li>• <strong>status:</strong> draft or published (default: draft)</li>
                </ul>
              </div>

              {/* Result Messages */}
              {result && (
                <div className={`rounded-lg p-4 ${
                  result.success === true ? 'bg-green-50 border border-green-200' : 
                  result.success === 'partial' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {result.success === true ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : result.success === 'partial' ? (
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        result.success === true ? 'text-green-900' : 
                        result.success === 'partial' ? 'text-yellow-900' :
                        'text-red-900'
                      }`}>
                        {result.message}
                      </p>
                      
                      {/* Success/Failure Stats */}
                      {(result.successCount !== undefined || result.failureCount !== undefined) && (
                        <div className="mt-2 space-y-1">
                          {result.successCount !== undefined && result.successCount > 0 && (
                            <p className="text-sm text-green-700">
                              ✓ {result.successCount} events uploaded successfully
                            </p>
                          )}
                          {result.failureCount !== undefined && result.failureCount > 0 && (
                            <p className="text-sm text-red-700">
                              ✗ {result.failureCount} events failed to upload
                            </p>
                          )}
                          {result.skippedCount !== undefined && result.skippedCount > 0 && (
                            <p className="text-sm text-orange-700">
                              ⚠ {result.skippedCount} rows skipped due to validation errors
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Failed Events Details */}
                      {result.failedEvents && result.failedEvents.length > 0 && (
                        <div className="mt-3 bg-white rounded p-3 border border-red-200">
                          <p className="text-sm font-medium text-red-900 mb-2">Failed Events:</p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {result.failedEvents.slice(0, 10).map((failed, index) => (
                              <div key={index} className="text-sm border-l-2 border-red-400 pl-2">
                                <p className="font-medium text-gray-900">
                                  {failed.row ? `Row ${failed.row}: ` : ''}{failed.event.title || 'Unknown'}
                                </p>
                                <p className="text-red-600 text-xs">{failed.error}</p>
                              </div>
                            ))}
                            {result.failedEvents.length > 10 && (
                              <p className="text-sm text-gray-600">
                                ... and {result.failedEvents.length - 10} more failures
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Skipped Rows */}
                      {result.skippedRows && result.skippedRows.length > 0 && (
                        <div className="mt-3 bg-white rounded p-3 border border-yellow-200">
                          <p className="text-sm font-medium text-yellow-900 mb-2">Skipped Rows:</p>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {result.skippedRows.slice(0, 5).map((skipped, index) => (
                              <p key={index} className="text-sm text-yellow-700">
                                • Row {skipped.row}: {skipped.reason}
                              </p>
                            ))}
                            {result.skippedRows.length > 5 && (
                              <p className="text-sm text-gray-600">
                                ... and {result.skippedRows.length - 5} more skipped rows
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Validation Errors */}
                      {result.validationErrors && result.validationErrors.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-red-900">Validation Errors:</p>
                          <ul className="text-sm text-red-700 mt-1 space-y-1">
                            {result.validationErrors.slice(0, 5).map((error, index) => (
                              <li key={index}>• {error}</li>
                            ))}
                            {result.validationErrors.length > 5 && (
                              <li>... and {result.validationErrors.length - 5} more errors</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    reset()
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Events
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}