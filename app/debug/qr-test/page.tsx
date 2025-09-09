'use client'

import { useState } from 'react'
import { QrCode, TestTube, CheckCircle, XCircle } from 'lucide-react'

export default function QRTestPage() {
  const [testData, setTestData] = useState('')
  const [encryptedData, setEncryptedData] = useState('')
  const [decryptedData, setDecryptedData] = useState('')
  const [error, setError] = useState('')

  const testEncryption = async () => {
    try {
      setError('')
      const { encryptTicketData } = await import('@/lib/qr-generator')
      
      const sampleTicket = {
        ticketId: 'test-ticket-123',
        eventId: 'test-event-456',
        bookingId: 'test-booking-789',
        userId: 'test-user-abc',
        ticketNumber: 'TEST-001',
        ticketType: 'general',
        eventDate: new Date().toISOString()
      }
      
      const encrypted = await encryptTicketData(sampleTicket)
      setEncryptedData(encrypted)
      setTestData(JSON.stringify(sampleTicket, null, 2))
    } catch (err) {
      setError(`Encryption failed: ${err}`)
    }
  }

  const testDecryption = async () => {
    if (!encryptedData) {
      setError('No encrypted data to decrypt')
      return
    }

    try {
      setError('')
      const { decryptTicketData } = await import('@/lib/qr-generator')
      
      const decrypted = await decryptTicketData(encryptedData)
      if (decrypted) {
        setDecryptedData(JSON.stringify(decrypted, null, 2))
      } else {
        setError('Decryption returned null')
      }
    } catch (err) {
      setError(`Decryption failed: ${err}`)
    }
  }

  const testCustomData = async () => {
    if (!testData.trim()) {
      setError('Please enter test data')
      return
    }

    try {
      setError('')
      const { decryptTicketData } = await import('@/lib/qr-generator')
      
      const decrypted = await decryptTicketData(testData.trim())
      if (decrypted) {
        setDecryptedData(JSON.stringify(decrypted, null, 2))
      } else {
        setError('Failed to decrypt custom data')
      }
    } catch (err) {
      setError(`Custom decryption failed: ${err}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop-Only Header */}
      <div className="bg-white shadow-sm border-b hidden lg:block mb-6">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TestTube className="h-7 w-7 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">QR Code Test Page</h1>
              <p className="text-gray-600">Test QR code encryption and decryption</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          {/* Mobile header visible only on mobile */}
          <div className="flex items-center gap-3 mb-6 lg:hidden">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <TestTube className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">QR Test</h1>
              <p className="text-sm text-gray-600">Test encryption/decryption</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Encryption Test */}
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">1. Test Encryption</h2>
              <button
                onClick={testEncryption}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Generate Test QR Data
              </button>
              
              {testData && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Original Data:
                  </label>
                  <textarea
                    value={testData}
                    onChange={(e) => setTestData(e.target.value)}
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    readOnly
                  />
                </div>
              )}

              {encryptedData && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Encrypted QR Data:
                  </label>
                  <textarea
                    value={encryptedData}
                    className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    readOnly
                  />
                </div>
              )}
            </div>

            {/* Decryption Test */}
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">2. Test Decryption</h2>
              
              <div className="space-y-2">
                <button
                  onClick={testDecryption}
                  disabled={!encryptedData}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Decrypt Generated Data
                </button>
                
                <button
                  onClick={testCustomData}
                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Decrypt Custom Data
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom QR Data (paste here to test):
                </label>
                <textarea
                  value={testData}
                  onChange={(e) => setTestData(e.target.value)}
                  placeholder="Paste QR code data here to test decryption..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>

              {decryptedData && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Decrypted Data:
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-800 font-medium">Decryption Successful</span>
                  </div>
                  <textarea
                    value={decryptedData}
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    readOnly
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">How to use this page:</h3>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Click "Generate Test QR Data" to create sample encrypted data</li>
              <li>2. Click "Decrypt Generated Data" to verify the encryption/decryption works</li>
              <li>3. Paste actual QR code data in the custom field and click "Decrypt Custom Data" to debug real issues</li>
              <li>4. Check the browser console for detailed error messages</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
