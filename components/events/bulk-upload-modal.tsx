'use client'

import { useState } from 'react'
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download, Info } from 'lucide-react'
import Papa from 'papaparse'

interface BulkUploadModalProps {
  isOpen: boolean
  onClose: () => void
  parentEventId: string
  organizerId: string
  onSuccess?: () => void
}

interface EventRow {
  title: string
  description: string
  date?: string
  time?: string
  venue?: string
  location?: string
  category?: string
  price?: number
  max_attendees?: number
  image_url?: string
}

export default function BulkUploadModal({
  isOpen,
  onClose,
  parentEventId,
  organizerId,
  onSuccess
}: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number } | null>(null)

  if (!isOpen) return null

  const downloadTemplate = () => {
    const template = [
      {
        title: 'Event Title (Required)',
        description: 'Event Description (Required)',
        date: '2025-01-15',
        time: '18:00',
        venue: 'Main Hall',
        location: 'Mumbai',
        category: 'conference',
        price: '500',
        max_attendees: '100',
        image_url: 'https://example.com/image.jpg'
      },
      {
        title: 'Sample Workshop',
        description: 'This is a sample workshop description. Only title and description are required fields.',
        date: '',
        time: '',
        venue: '',
        location: '',
        category: '',
        price: '',
        max_attendees: '',
        image_url: ''
      }
    ]

    const csv = Papa.unparse(template)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'event-upload-template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setErrors([])
    setUploadResults(null)

    // Parse CSV
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validEvents: EventRow[] = []
        const parseErrors: string[] = []

        results.data.forEach((row: any, index: number) => {
          // Check required fields
          if (!row.title || !row.description) {
            parseErrors.push(`Row ${index + 2}: Missing required fields (title and/or description)`)
            return
          }

          // Clean and validate the data
          const event: EventRow = {
            title: row.title.trim(),
            description: row.description.trim(),
            date: row.date?.trim() || undefined,
            time: row.time?.trim() || undefined,
            venue: row.venue?.trim() || undefined,
            location: row.location?.trim() || undefined,
            category: row.category?.trim()?.toLowerCase() || undefined,
            price: row.price ? parseFloat(row.price) : undefined,
            max_attendees: row.max_attendees ? parseInt(row.max_attendees) : undefined,
            image_url: row.image_url?.trim() || undefined
          }

          validEvents.push(event)
        })

        if (parseErrors.length > 0) {
          setErrors(parseErrors)
        }

        setEvents(validEvents)
      },
      error: (error) => {
        setErrors([`Failed to parse CSV: ${error.message}`])
      }
    })
  }

  const handleUpload = async () => {
    if (events.length === 0) {
      setErrors(['No valid events to upload'])
      return
    }

    setIsUploading(true)
    setErrors([])

    try {
      const response = await fetch('/api/events/bulk-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          events,
          parentEventId,
          organizerId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload events')
      }

      setUploadResults({
        success: result.success,
        failed: result.failed
      })

      if (result.success > 0 && onSuccess) {
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to upload events'])
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Bulk Upload Events</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Instructions */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-2">Instructions:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Only <strong>title</strong> and <strong>description</strong> are required fields</li>
                  <li>All other fields are optional and will use default values if not provided</li>
                  <li>Date format: YYYY-MM-DD (e.g., 2025-01-15)</li>
                  <li>Time format: HH:MM (24-hour format, e.g., 18:00)</li>
                  <li>Categories: conference, workshop, meetup, webinar, social, other</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Download Template */}
          <div className="mb-6">
            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg transition-colors"
            >
              <Download className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-700">Download CSV Template</span>
            </button>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload CSV File
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="w-full flex items-center justify-center gap-3 px-4 py-8 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition-colors"
              >
                <Upload className="h-8 w-8 text-gray-400" />
                <div className="text-center">
                  <p className="font-medium text-gray-700">
                    {file ? file.name : 'Click to upload CSV file'}
                  </p>
                  <p className="text-sm text-gray-500">CSV files only</p>
                </div>
              </label>
            </div>
          </div>

          {/* Preview */}
          {events.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Preview ({events.length} events)
              </h3>
              <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {events.slice(0, 5).map((event, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium">{index + 1}.</span> {event.title}
                      {event.date && <span className="text-gray-500 ml-2">• {event.date}</span>}
                    </div>
                  ))}
                  {events.length > 5 && (
                    <p className="text-sm text-gray-500">...and {events.length - 5} more</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div className="text-sm text-red-900">
                  <p className="font-semibold mb-1">Errors found:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {uploadResults && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="text-sm text-green-900">
                  <p className="font-semibold">Upload Complete!</p>
                  <p>Successfully created {uploadResults.success} events</p>
                  {uploadResults.failed > 0 && (
                    <p>Failed to create {uploadResults.failed} events</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={events.length === 0 || isUploading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isUploading ? 'Uploading...' : `Upload ${events.length} Events`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}