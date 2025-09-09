'use client'

import { useState, useRef, useEffect } from 'react'
import { QrCode, Download, RefreshCw, Copy, Settings, Palette, Eye } from 'lucide-react'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
import TicketTemplate, { TicketData } from '@/components/tickets/TicketTemplate'

export default function QRGeneratorPage() {
  const [inputText, setInputText] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [existingQRCodes, setExistingQRCodes] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Fix hydration mismatch by only rendering date on client
  useEffect(() => {
    setMounted(true)
    fetchQRHistory()
  }, [])

  const fetchQRHistory = async () => {
    try {
      setLoadingHistory(true)
      const response = await fetch('/api/qr-generator/history')
      if (response.ok) {
        const data = await response.json()
        setExistingQRCodes(data.qrCodes || [])
      }
    } catch (error) {
      console.error('Failed to fetch QR history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const generateTicketData = (qrText: string): TicketData => {
    const uniqueId = generateUniqueId()
    return {
      // Event Information
      eventName: 'QR Generated Event',
      eventDate: new Date().toLocaleDateString(),
      eventTime: new Date().toLocaleTimeString(),
      venue: 'Digital Venue',
      
      // Ticket Information
      ticketNumber: `QR-${uniqueId}`,
      ticketType: 'General',
      
      // Attendee Information
      attendeeName: 'QR Code Holder',
      registrationId: `REG-${uniqueId}`,
      
      // Pricing Information
      price: 'Free',
      paymentStatus: 'Complimentary',
      
      // Organization Information
      organizerName: 'Evently Platform',
      organizerContact: 'support@evently.com',
      
      // Security
      qrData: qrText,
      
      // Terms & Conditions
      nonTransferable: false,
      idRequired: false
    }
  }

  // QR Code settings
  const [settings, setSettings] = useState({
    size: 512,
    margin: 4,
    darkColor: '#000000',
    lightColor: '#FFFFFF',
    errorCorrectionLevel: 'H' as const,
    quality: 0.92
  })

  const generateUniqueId = () => {
    const timestamp = Date.now().toString(36)
    const randomStr = Math.random().toString(36).substring(2, 8)
    return `${timestamp}-${randomStr}`.toUpperCase()
  }

  const generateRandomText = () => {
    const templates = [
      `TICKET-${generateUniqueId()}`,
      `EVENT-${generateUniqueId()}`,
      `USER-${generateUniqueId()}`,
      `ID-${generateUniqueId()}`,
      `CODE-${generateUniqueId()}`,
      `REF-${generateUniqueId()}`,
    ]
    
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)]
    setInputText(randomTemplate)
  }

  const generateQRCode = async (text?: string) => {
    const textToGenerate = text || inputText
    
    if (!textToGenerate.trim()) {
      setError('Please enter text to generate QR code')
      return
    }

    try {
      setLoading(true)
      setError('')

      // Use the API to generate and store QR code
      const response = await fetch('/api/qr-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToGenerate,
          options: {
            errorCorrectionLevel: settings.errorCorrectionLevel,
            quality: settings.quality,
            margin: settings.margin,
            color: {
              dark: settings.darkColor,
              light: settings.lightColor
            },
            width: settings.size
          },
          storeInDb: true // Store in database for verification
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate QR code')
      }

      const result = await response.json()
      setQrCodeDataUrl(result.qrCode)
      
      // Generate ticket data for preview with the actual QR text
      const ticket = generateTicketData(textToGenerate)
      setTicketData(ticket)
      
      console.log('QR Code generated and stored:', {
        text: textToGenerate,
        qrCodeId: result.qrCodeId,
        storedInDb: result.info.storedInDb,
        qrHash: result.info.qrHash
      })

      // Show success message if stored in database
      if (result.info.storedInDb) {
        console.log('✅ QR code stored in database for verification tracking')
        // Refresh QR history to show the new QR code
        fetchQRHistory()
      }
      
    } catch (err) {
      console.error('QR generation error:', err)
      setError(`Failed to generate QR code: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const generateUniqueQR = async () => {
    const uniqueText = `UNIQUE-${generateUniqueId()}`
    setInputText(uniqueText)
    await generateQRCode(uniqueText)
  }

  const downloadQRCode = async () => {
    if (!ticketData) {
      setError('No ticket data to download')
      return
    }

    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default

      const ticketElement = document.getElementById('qr-ticket-preview')
      if (!ticketElement) {
        setError('Ticket preview not found')
        return
      }

      // Generate canvas from ticket element
      const canvas = await html2canvas(ticketElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true
      })

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [200, 100] // Ticket size
      })

      const imgData = canvas.toDataURL('image/png')
      pdf.addImage(imgData, 'PNG', 0, 0, 200, 100)
      
      // Save the PDF
      pdf.save(`qr-ticket-${ticketData.ticketNumber}.pdf`)
    } catch (err) {
      console.error('Error generating PDF:', err)
      setError('Failed to generate PDF. Please try again.')
    }
  }

  const copyToClipboard = async () => {
    if (!inputText) return
    
    try {
      await navigator.clipboard.writeText(inputText)
      // Show success feedback
      const originalText = inputText
      setInputText('✓ Copied to clipboard!')
      setTimeout(() => setInputText(originalText), 1000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      generateQRCode()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <QrCode className="h-7 w-7 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">QR Ticket Generator</h1>
                <p className="text-gray-600">Generate professional tickets with embedded QR codes in PDF format</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Input Text</h2>
              
              <div className="space-y-4">
                <div className="relative">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter text, URL, or data to generate QR code..."
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  />
                  {inputText && (
                    <button
                      onClick={copyToClipboard}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded"
                      title="Copy to clipboard"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => generateQRCode()}
                    disabled={loading || !inputText.trim()}
                    className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4 w-4" />
                        Generate QR Code
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={generateRandomText}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    title="Generate random text"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={generateUniqueQR}
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <QrCode className="h-4 w-4" />
                  Generate Unique QR Code
                </button>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Templates</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Website URL', value: 'https://example.com' },
                  { label: 'Email', value: 'mailto:contact@example.com' },
                  { label: 'Phone', value: 'tel:+1234567890' },
                  { label: 'WiFi', value: 'WIFI:T:WPA;S:NetworkName;P:Password;;' },
                  { label: 'Text Message', value: 'sms:+1234567890' },
                  { label: 'Location', value: 'geo:37.7749,-122.4194' },
                ].map((template) => (
                  <button
                    key={template.label}
                    onClick={() => setInputText(template.value)}
                    className="p-2 text-sm text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  QR Code Settings
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Size: {settings.size}px
                    </label>
                    <input
                      type="range"
                      min="128"
                      max="1024"
                      step="64"
                      value={settings.size}
                      onChange={(e) => setSettings({...settings, size: parseInt(e.target.value)})}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Margin: {settings.margin}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={settings.margin}
                      onChange={(e) => setSettings({...settings, margin: parseInt(e.target.value)})}
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dark Color
                      </label>
                      <input
                        type="color"
                        value={settings.darkColor}
                        onChange={(e) => setSettings({...settings, darkColor: e.target.value})}
                        className="w-full h-10 rounded border"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Light Color
                      </label>
                      <input
                        type="color"
                        value={settings.lightColor}
                        onChange={(e) => setSettings({...settings, lightColor: e.target.value})}
                        className="w-full h-10 rounded border"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Error Correction Level
                    </label>
                    <select
                      value={settings.errorCorrectionLevel}
                      onChange={(e) => setSettings({...settings, errorCorrectionLevel: e.target.value as 'L' | 'M' | 'Q' | 'H'})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="L">Low (7%)</option>
                      <option value="M">Medium (15%)</option>
                      <option value="Q">Quartile (25%)</option>
                      <option value="H">High (30%)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            {/* Professional Ticket with Embedded QR Code */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {qrCodeDataUrl ? '🎟️ Professional Ticket with QR Code' : 'Generated QR Ticket'}
                </h2>
                {qrCodeDataUrl && (
                  <div className="flex gap-2">
                    <button
                      onClick={downloadQRCode}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                  </div>
                )}
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center min-h-[320px]">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Generating QR ticket...</p>
                  </div>
                </div>
              ) : ticketData && qrCodeDataUrl ? (
                <div id="qr-ticket-preview" className="max-w-2xl mx-auto">
                  <TicketTemplate data={ticketData} size="full" />
                  <p className="text-sm text-gray-600 mt-4 text-center">
                    QR code is embedded within the ticket for verification
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center min-h-[320px] bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <QrCode className="h-16 w-16 text-gray-300 mx-auto" />
                    <p className="mt-2 text-gray-500">Your QR ticket will appear here</p>
                    <p className="mt-1 text-sm text-gray-400">Enter text and click "Generate QR Code"</p>
                  </div>
                </div>
              )}
            </div>


            {/* QR Code Info */}
            {qrCodeDataUrl && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">QR Code Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Format:</span>
                    <span className="font-medium">Professional Ticket PDF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Size:</span>
                    <span className="font-medium">{settings.size}×{settings.size}px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Error Correction:</span>
                    <span className="font-medium">{settings.errorCorrectionLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Characters:</span>
                    <span className="font-medium">{inputText.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">How It Works</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <p>✅ Enter any text, URL, or data in the input field</p>
                <p>✅ Click "Generate QR Code" to create a professional ticket</p>
                <p>✅ QR code is automatically embedded in the ticket design</p>
                <p>✅ Use "Generate Unique QR Code" for random ticket codes</p>
                <p>✅ Customize QR appearance in settings panel</p>
                <p>✅ Download as professional ticket PDF with embedded QR</p>
                <p>✅ QR codes work with any standard scanner app</p>
              </div>
            </div>

            {/* QR Code History */}
            {mounted && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Recent QR Codes</h3>
                  <button
                    onClick={fetchQRHistory}
                    disabled={loadingHistory}
                    className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
                
                {loadingHistory ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Loading QR history...</p>
                  </div>
                ) : existingQRCodes.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {existingQRCodes.slice(0, 5).map((qr, index) => (
                      <div
                        key={qr.id || index}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                        onClick={() => setInputText(qr.qr_data)}
                      >
                        <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center flex-shrink-0">
                          <QrCode className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {qr.qr_data}
                          </p>
                          <p className="text-xs text-gray-500">
                            {qr.created_at ? new Date(qr.created_at).toLocaleDateString() : 'Unknown date'}
                          </p>
                        </div>
                        <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <QrCode className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No QR codes generated yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}