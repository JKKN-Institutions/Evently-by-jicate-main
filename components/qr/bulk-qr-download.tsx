'use client'

import { useState } from 'react'
import { Download, Package, Settings, CheckCircle } from 'lucide-react'

interface BulkQRDownloadProps {
  eventId: string
  eventTitle: string
  totalTickets: number
}

export default function BulkQRDownload({ eventId, eventTitle, totalTickets }: BulkQRDownloadProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [format, setFormat] = useState<'png' | 'svg'>('png')
  const [size, setSize] = useState(512)
  const [includeDetails, setIncludeDetails] = useState(true)

  const handleBulkDownload = async () => {
    if (totalTickets === 0) {
      alert('No tickets available for download')
      return
    }

    setIsDownloading(true)
    try {
      const params = new URLSearchParams({
        format,
        size: size.toString(),
        details: includeDetails.toString()
      })

      const response = await fetch(`/api/events/${eventId}/qr-bulk-download?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to download QR codes')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${eventTitle.replace(/[^a-zA-Z0-9]/g, '-')}-qr-codes.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setShowOptions(false)
    } catch (error) {
      console.error('Error downloading QR codes:', error)
      alert('Failed to download QR codes. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Package className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Bulk QR Download</h3>
            <p className="text-sm text-gray-600">Download all QR codes for printing</p>
          </div>
        </div>
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          <span className="font-medium">{totalTickets}</span> tickets available for download
        </div>
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          Ready for printing
        </div>
      </div>

      {showOptions && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
          <h4 className="font-medium text-gray-900">Download Options</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'png' | 'svg')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="png">PNG (Recommended)</option>
                <option value="svg">SVG (Vector)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Size (pixels)
              </label>
              <select
                value={size}
                onChange={(e) => setSize(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="256">256px (Small)</option>
                <option value="512">512px (Standard)</option>
                <option value="1024">1024px (High Quality)</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeDetails}
                  onChange={(e) => setIncludeDetails(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-700">Include ticket details</span>
              </label>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            <p>• QR codes will be saved as individual files in a ZIP archive</p>
            <p>• Each QR code is named with the ticket number for easy identification</p>
            {includeDetails && <p>• Ticket details will be included as JSON files</p>}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleBulkDownload}
          disabled={isDownloading || totalTickets === 0}
          className="flex-1 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
        >
          {isDownloading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Preparing Download...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download All QR Codes ({totalTickets})
            </>
          )}
        </button>

        {!showOptions && (
          <button
            onClick={() => setShowOptions(true)}
            className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Options
          </button>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <p>💡 <strong>Tip:</strong> Download QR codes in PNG format for best printing quality. Each QR code can be scanned at the venue to validate tickets.</p>
      </div>
    </div>
  )
}
