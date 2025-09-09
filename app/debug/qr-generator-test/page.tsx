'use client'

import { useState, useEffect } from 'react'
import { QrCode, Download, TestTube, CheckCircle, XCircle, Ticket, Eye } from 'lucide-react'
import { generateQRCode, encryptTicketData, decryptTicketData, TicketData } from '@/lib/qr-generator'

export default function QRGeneratorTestPage() {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [testData, setTestData] = useState('')
  const [encryptedData, setEncryptedData] = useState('')
  const [decryptedData, setDecryptedData] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const sampleTicketData: TicketData = {
    ticketId: 'test-ticket-' + Date.now(),
    eventId: 'test-event-456',
    bookingId: 'test-booking-789',
    userId: 'test-user-abc',
    ticketNumber: 'TEST-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    ticketType: 'General Admission',
    eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
  }

  const generateFullQRCode = async () => {
    try {
      setLoading(true)
      setError('')
      
      console.log('Generating QR code for:', sampleTicketData)
      
      // Generate QR code with sample data
      const qrDataUrl = await generateQRCode(sampleTicketData)
      setQrCodeDataUrl(qrDataUrl)
      
      // Also encrypt the data for testing
      const encrypted = await encryptTicketData(sampleTicketData)
      setEncryptedData(encrypted)
      setTestData(JSON.stringify(sampleTicketData, null, 2))
      
      console.log('QR code generated successfully')
    } catch (err) {
      console.error('QR generation error:', err)
      setError(`QR Generation failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const testEncryptionOnly = async () => {
    try {
      setLoading(true)
      setError('')
      
      const encrypted = await encryptTicketData(sampleTicketData)
      setEncryptedData(encrypted)
      setTestData(JSON.stringify(sampleTicketData, null, 2))
      
      console.log('Encryption successful')
    } catch (err) {
      console.error('Encryption error:', err)
      setError(`Encryption failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const testDecryption = async () => {
    if (!encryptedData) {
      setError('No encrypted data to decrypt')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const decrypted = await decryptTicketData(encryptedData)
      if (decrypted) {
        setDecryptedData(JSON.stringify(decrypted, null, 2))
        console.log('Decryption successful')
      } else {
        setError('Decryption returned null - invalid data or signature')
      }
    } catch (err) {
      console.error('Decryption error:', err)
      setError(`Decryption failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) {
      setError('No QR code to download')
      return
    }

    const link = document.createElement('a')
    link.href = qrCodeDataUrl
    link.download = `${sampleTicketData.ticketNumber}-qr-code.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const testCustomData = async () => {
    if (!testData.trim()) {
      setError('Please enter custom ticket data')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const customTicketData: TicketData = JSON.parse(testData)
      const encrypted = await encryptTicketData(customTicketData)
      const qrDataUrl = await generateQRCode(customTicketData)
      
      setEncryptedData(encrypted)
      setQrCodeDataUrl(qrDataUrl)
      
      console.log('Custom QR code generated successfully')
    } catch (err) {
      console.error('Custom generation error:', err)
      setError(`Custom generation failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TestTube className="h-7 w-7 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">QR Generator Test Suite</h1>
              <p className="text-gray-600">Test QR code generation, encryption, and decryption</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Control Panel */}
          <div className="space-y-6">
            {/* Quick Test Actions */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Tests</h2>
              <div className="space-y-3">
                <button
                  onClick={generateFullQRCode}
                  disabled={loading}
                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <QrCode className="h-4 w-4" />
                  {loading ? 'Generating...' : 'Generate Complete QR Code'}
                </button>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={testEncryptionOnly}
                    disabled={loading}
                    className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    Test Encryption Only
                  </button>
                  
                  <button
                    onClick={testDecryption}
                    disabled={loading || !encryptedData}
                    className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    Test Decryption
                  </button>
                </div>
              </div>
            </div>

            {/* Sample Data Display */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sample Ticket Data</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Ticket ID:</span>
                    <p className="text-gray-900 font-mono">{sampleTicketData.ticketId}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Ticket Number:</span>
                    <p className="text-gray-900 font-mono">{sampleTicketData.ticketNumber}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Event ID:</span>
                    <p className="text-gray-900 font-mono">{sampleTicketData.eventId}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Ticket Type:</span>
                    <p className="text-gray-900">{sampleTicketData.ticketType}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Data Testing */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Custom Ticket Data</h3>
              <div className="space-y-4">
                <textarea
                  value={testData}
                  onChange={(e) => setTestData(e.target.value)}
                  placeholder={JSON.stringify(sampleTicketData, null, 2)}
                  className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
                <button
                  onClick={testCustomData}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Generate QR from Custom Data
                </button>
              </div>
            </div>

            {/* Advanced Controls */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-left"
              >
                <h3 className="text-lg font-semibold text-gray-900">Advanced Testing</h3>
                <Eye className={`h-4 w-4 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>
              
              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Encrypted Data:
                    </label>
                    <textarea
                      value={encryptedData}
                      onChange={(e) => setEncryptedData(e.target.value)}
                      className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                      placeholder="Base64 encrypted data will appear here..."
                    />
                  </div>
                  
                  {decryptedData && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Decrypted Result:
                      </label>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-green-800 text-sm font-medium">Decryption Successful</span>
                      </div>
                      <textarea
                        value={decryptedData}
                        className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono bg-green-50"
                        readOnly
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* QR Code Display */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Generated QR Code</h2>
                {qrCodeDataUrl && (
                  <button
                    onClick={downloadQRCode}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                )}
              </div>
              
              <div className="flex items-center justify-center min-h-[300px] bg-gray-50 rounded-lg">
                {loading ? (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Generating QR code...</p>
                  </div>
                ) : qrCodeDataUrl ? (
                  <div className="text-center">
                    <img 
                      src={qrCodeDataUrl} 
                      alt="Generated QR Code" 
                      className="max-w-full max-h-80 rounded-lg shadow-md"
                    />
                    <p className="mt-2 text-sm text-gray-600">
                      QR Code for ticket: {sampleTicketData.ticketNumber}
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <QrCode className="h-16 w-16 text-gray-300 mx-auto" />
                    <p className="mt-2 text-gray-500">QR code will appear here</p>
                  </div>
                )}
              </div>
            </div>

            {/* Test Results */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Status</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {qrCodeDataUrl ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-gray-300 rounded-full"></div>
                  )}
                  <span className="text-sm font-medium">QR Code Generation</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {encryptedData ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-gray-300 rounded-full"></div>
                  )}
                  <span className="text-sm font-medium">Data Encryption</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {decryptedData ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-gray-300 rounded-full"></div>
                  )}
                  <span className="text-sm font-medium">Data Decryption</span>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Testing Instructions</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <p>1. Click "Generate Complete QR Code" to test the full process</p>
                <p>2. Use individual buttons to test encryption/decryption separately</p>
                <p>3. Modify the custom data to test different ticket scenarios</p>
                <p>4. Check browser console for detailed logs</p>
                <p>5. Download the QR code to test with a scanner app</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}