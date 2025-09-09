'use client'

import React, { useState, useEffect } from 'react'
import { 
  QRDisplayMode, 
  generateReadableQR, 
  parseReadableQR,
  ReadableTicket 
} from '@/lib/qr-readable-mode'
import { TicketData } from '@/lib/qr-generator'

interface QRReadableDisplayProps {
  ticketData?: TicketData
  qrContent?: string
  mode?: QRDisplayMode
  showControls?: boolean
  theme?: 'light' | 'dark'
}

export default function QRReadableDisplay({
  ticketData,
  qrContent,
  mode = QRDisplayMode.HYBRID,
  showControls = true,
  theme = 'light'
}: QRReadableDisplayProps) {
  const [displayMode, setDisplayMode] = useState<QRDisplayMode>(mode)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [readableInfo, setReadableInfo] = useState<ReadableTicket | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    if (ticketData) {
      generateQR()
    } else if (qrContent) {
      parseExistingQR()
    }
  }, [ticketData, qrContent, displayMode])

  const generateQR = async () => {
    if (!ticketData) return
    
    setIsLoading(true)
    setError('')
    
    try {
      const result = await generateReadableQR(ticketData, displayMode)
      setQrDataUrl(result.qrDataUrl)
      setReadableInfo(result.readableInfo)
    } catch (err) {
      setError(`Failed to generate QR: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  const parseExistingQR = () => {
    if (!qrContent) return
    
    const parsed = parseReadableQR(qrContent)
    if (parsed.isValid && parsed.data) {
      // Convert parsed data to readable format
      setReadableInfo({
        displayId: parsed.data.id || 'N/A',
        ticketNumber: parsed.data.ticketNumber || parsed.data.num || 'N/A',
        ticketType: parsed.data.ticketType || parsed.data.type || 'N/A',
        eventDate: parsed.data.eventDate || parsed.data.date || 'N/A',
        validationCode: parsed.data.ticketId?.substring(0, 8).toUpperCase() || 'N/A'
      })
    } else {
      setError(parsed.error || 'Invalid QR code')
    }
  }

  const downloadQR = () => {
    if (!qrDataUrl) return
    
    const link = document.createElement('a')
    link.download = `ticket-${readableInfo?.displayId || 'qr'}.png`
    link.href = qrDataUrl
    link.click()
  }

  const copyReadableCode = () => {
    if (!readableInfo?.displayId) return
    
    navigator.clipboard.writeText(readableInfo.displayId)
      .then(() => alert('Code copied to clipboard!'))
      .catch(() => alert('Failed to copy code'))
  }

  const isDark = theme === 'dark'
  const bgColor = isDark ? 'bg-gray-900' : 'bg-white'
  const textColor = isDark ? 'text-white' : 'text-gray-900'
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200'

  return (
    <div className={`${bgColor} ${textColor} rounded-lg shadow-lg p-6 max-w-md mx-auto`}>
      {/* Mode Selector */}
      {showControls && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Display Mode</label>
          <select
            value={displayMode}
            onChange={(e) => setDisplayMode(e.target.value as QRDisplayMode)}
            className={`w-full px-3 py-2 rounded-md ${borderColor} border ${bgColor} ${textColor}`}
          >
            <option value={QRDisplayMode.ENCRYPTED}>Encrypted (Standard)</option>
            <option value={QRDisplayMode.READABLE}>Human Readable</option>
            <option value={QRDisplayMode.HYBRID}>Hybrid (Both)</option>
            <option value={QRDisplayMode.DEBUG}>Debug Mode</option>
          </select>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4">Generating QR Code...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* QR Code Display */}
      {qrDataUrl && !isLoading && (
        <div className="space-y-4">
          {/* QR Code Image */}
          <div className="bg-white p-4 rounded-lg text-center">
            <img 
              src={qrDataUrl} 
              alt="QR Code" 
              className="mx-auto max-w-full"
              style={{ maxWidth: '300px' }}
            />
          </div>

          {/* Readable Information */}
          {readableInfo && (
            <div className={`border-t-2 border-green-600 pt-4`}>
              <h3 className="text-lg font-semibold text-green-600 mb-3">
                Ticket Information
              </h3>
              
              {/* Display ID */}
              <div className={`${isDark ? 'bg-gray-800' : 'bg-gray-100'} p-3 rounded-md mb-3`}>
                <div className="flex justify-between items-center">
                  <code className="text-lg font-bold font-mono tracking-wider">
                    {readableInfo.displayId}
                  </code>
                  <button
                    onClick={copyReadableCode}
                    className="text-sm text-green-600 hover:text-green-700"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Ticket Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Ticket #:</span>
                  <span className="font-mono">{readableInfo.ticketNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Type:</span>
                  <span>{readableInfo.ticketType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Date:</span>
                  <span>{readableInfo.eventDate}</span>
                </div>
                {readableInfo.validationCode && (
                  <div className="flex justify-between">
                    <span className="font-medium">Validation:</span>
                    <span className="font-mono text-green-600">
                      {readableInfo.validationCode}
                    </span>
                  </div>
                )}
              </div>

              {/* Seat Information */}
              {readableInfo.seatInfo && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <div className="text-sm space-y-1">
                    {readableInfo.seatInfo.section && (
                      <div>Section: {readableInfo.seatInfo.section}</div>
                    )}
                    {readableInfo.seatInfo.row && (
                      <div>Row: {readableInfo.seatInfo.row}</div>
                    )}
                    {readableInfo.seatInfo.seat && (
                      <div>Seat: {readableInfo.seatInfo.seat}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {showControls && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={downloadQR}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Download QR
              </button>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                {showDebug ? 'Hide' : 'Show'} Debug
              </button>
            </div>
          )}

          {/* Debug Information */}
          {showDebug && (
            <div className={`mt-4 p-4 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-md`}>
              <h4 className="font-semibold mb-2">Debug Information</h4>
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify({
                  mode: displayMode,
                  readableInfo,
                  qrContentLength: qrContent?.length,
                  hasTicketData: !!ticketData
                }, null, 2)}
              </pre>
            </div>
          )}

          {/* Mode Information */}
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-4`}>
            <p className="font-semibold mb-1">Current Mode: {displayMode}</p>
            <ul className="list-disc list-inside space-y-1">
              {displayMode === QRDisplayMode.ENCRYPTED && (
                <li>Standard encrypted format for maximum security</li>
              )}
              {displayMode === QRDisplayMode.READABLE && (
                <li>Human-readable JSON format (less secure)</li>
              )}
              {displayMode === QRDisplayMode.HYBRID && (
                <li>Contains both encrypted and readable data</li>
              )}
              {displayMode === QRDisplayMode.DEBUG && (
                <li>Full unencrypted data for debugging</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}