'use client'

import { useState, useEffect } from 'react'
import { QrCode, TestTube, CheckCircle, XCircle, Scan, Database, Clock } from 'lucide-react'

export default function QRScanTestPage() {
  const [qrData, setQrData] = useState('')
  const [generatedQR, setGeneratedQR] = useState('')
  const [scanResult, setScanResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scanHistory, setScanHistory] = useState<any[]>([])

  const generateTestQR = async () => {
    try {
      setLoading(true)
      setError('')
      
      const testData = `TEST-TICKET-${Date.now()}`
      setQrData(testData)
      
      const response = await fetch('/api/qr-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: testData,
          options: { width: 256 },
          storeInDb: true
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate QR code')
      }

      const result = await response.json()
      setGeneratedQR(result.qrCode)
      
      console.log('QR Code generated:', result.info)
    } catch (err) {
      setError(`Generation failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const testQRScan = async () => {
    if (!qrData) {
      setError('Please generate a QR code first')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/qr-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrData: qrData,
          deviceInfo: {
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            page: 'qr-scan-test'
          }
        }),
      })

      const result = await response.json()
      setScanResult(result)
      
      // Add to scan history
      setScanHistory(prev => [{
        ...result,
        timestamp: new Date().toISOString()
      }, ...prev.slice(0, 9)]) // Keep last 10 scans
      
      console.log('Scan result:', result)
    } catch (err) {
      setError(`Scan failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const scanCustomData = async () => {
    if (!qrData.trim()) {
      setError('Please enter QR data to scan')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/qr-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrData: qrData.trim(),
          deviceInfo: {
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            page: 'qr-scan-test'
          }
        }),
      })

      const result = await response.json()
      setScanResult(result)
      
      console.log('Custom scan result:', result)
    } catch (err) {
      setError(`Custom scan failed: ${err instanceof Error ? err.message : String(err)}`)
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
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TestTube className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">QR Scan Test Suite</h1>
              <p className="text-gray-600">Test QR code database storage and scan tracking</p>
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
            {/* QR Generation Test */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Step 1: Generate & Store QR Code
              </h2>
              
              <div className="space-y-4">
                <button
                  onClick={generateTestQR}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate Test QR Code'}
                </button>
                
                {generatedQR && (
                  <div className="text-center">
                    <img 
                      src={generatedQR} 
                      alt="Generated QR Code" 
                      className="w-32 h-32 mx-auto rounded-lg shadow-md"
                    />
                    <p className="mt-2 text-sm text-gray-600">QR Data: {qrData}</p>
                  </div>
                )}
              </div>
            </div>

            {/* QR Scanning Test */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Scan className="h-5 w-5" />
                Step 2: Test QR Code Scanning
              </h2>
              
              <div className="space-y-4">
                <button
                  onClick={testQRScan}
                  disabled={loading || !qrData}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Scanning...' : 'Scan Generated QR Code'}
                </button>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Or test custom QR data:
                  </label>
                  <textarea
                    value={qrData}
                    onChange={(e) => setQrData(e.target.value)}
                    placeholder="Paste QR code data here..."
                    className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={scanCustomData}
                    disabled={loading}
                    className="mt-2 w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Scanning...' : 'Scan Custom QR Data'}
                  </button>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Test Flow</h3>
              <div className="space-y-2 text-sm text-blue-800">
                <p>1. Generate a test QR code (stored in database)</p>
                <p>2. Scan the QR code for the first time (should succeed)</p>
                <p>3. Scan the same QR code again (should show "already scanned")</p>
                <p>4. Try scanning invalid QR data (should fail gracefully)</p>
                <p>5. Check scan history to see all attempts</p>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {/* Latest Scan Result */}
            {scanResult && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Latest Scan Result</h2>
                
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${
                    scanResult.success 
                      ? 'bg-green-50 border border-green-200' 
                      : scanResult.alreadyScanned
                      ? 'bg-yellow-50 border border-yellow-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {scanResult.success && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {scanResult.alreadyScanned && <Clock className="h-5 w-5 text-yellow-500" />}
                      {!scanResult.success && !scanResult.alreadyScanned && <XCircle className="h-5 w-5 text-red-500" />}
                      
                      <span className={`font-semibold ${
                        scanResult.success 
                          ? 'text-green-800' 
                          : scanResult.alreadyScanned
                          ? 'text-yellow-800'
                          : 'text-red-800'
                      }`}>
                        {scanResult.result || (scanResult.success ? 'Success' : 'Failed')}
                      </span>
                    </div>
                    
                    <p className={`text-sm whitespace-pre-line ${
                      scanResult.success 
                        ? 'text-green-800' 
                        : scanResult.alreadyScanned
                        ? 'text-yellow-800'
                        : 'text-red-800'
                    }`}>
                      {scanResult.message}
                    </p>
                  </div>
                  
                  {scanResult.scanDetails && (
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Scan Count:</strong> {scanResult.scanDetails.scanCount}</p>
                      <p><strong>Scanned At:</strong> {new Date(scanResult.scanDetails.scannedAt).toLocaleString()}</p>
                      {scanResult.scanId && <p><strong>Scan ID:</strong> {scanResult.scanId}</p>}
                    </div>
                  )}
                  
                  {scanResult.qrCode && (
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>QR Type:</strong> {scanResult.qrCode.type}</p>
                      <p><strong>QR ID:</strong> {scanResult.qrCode.id}</p>
                      {scanResult.qrCode.description && (
                        <p><strong>Description:</strong> {scanResult.qrCode.description}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scan History */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Database className="h-5 w-5" />
                Scan History
              </h2>
              
              {scanHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No scans performed yet</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {scanHistory.map((scan, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${
                          scan.success 
                            ? 'text-green-600' 
                            : scan.alreadyScanned
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {scan.result || (scan.success ? 'Success' : 'Failed')}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(scan.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {scan.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}