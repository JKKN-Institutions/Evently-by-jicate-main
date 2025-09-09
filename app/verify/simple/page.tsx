'use client'

import { useState, useRef, useEffect } from 'react'
import { QrCode, CheckCircle, XCircle, AlertCircle, Camera, X } from 'lucide-react'
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode'

export default function SimpleVerifyPage() {
  const [qrInput, setQrInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    status?: string
  } | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  const verifyQRCode = async (qrData: string) => {
    if (!qrData.trim()) return

    setVerifying(true)
    setResult(null)
    stopScanner()

    try {
      const response = await fetch('/api/tickets/verify-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData })
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        message: 'Verification failed',
        status: 'error'
      })
    } finally {
      setVerifying(false)
    }
  }

  const startScanner = () => {
    setScannerActive(true)
    setResult(null)
  }

  // Start the actual scanner after the div is rendered
  useEffect(() => {
    if (scannerActive && !scannerRef.current) {
      // Small delay to ensure div is rendered
      const timer = setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode('qr-reader')
          scannerRef.current = html5QrCode
          
          await html5QrCode.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            (decodedText) => {
              console.log('QR Code detected:', decodedText)
              verifyQRCode(decodedText)
            },
            (errorMessage) => {
              // Ignore scanning errors
            }
          )
        } catch (err) {
          console.error('Failed to start scanner:', err)
          setScannerActive(false)
          alert('Unable to access camera. Please check permissions.')
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [scannerActive])

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null
        setScannerActive(false)
      }).catch((err) => {
        console.error('Failed to stop scanner:', err)
      })
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const resetScanner = () => {
    setQrInput('')
    setResult(null)
    setScannerActive(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <QrCode className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Ticket Verification
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Scan or enter QR code data to verify ticket
            </p>
          </div>

          {!result ? (
            <div className="space-y-4">
              {/* Camera Scanner */}
              {scannerActive ? (
                <div className="relative">
                  <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />
                  <button
                    onClick={stopScanner}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={startScanner}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-4 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Scan QR Code with Camera
                </button>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">OR</span>
                </div>
              </div>

              {/* Manual Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Paste QR Code Data / URL
                </label>
                <textarea
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Paste QR code data or URL here..."
                  rows={3}
                />
              </div>

              <button
                onClick={() => verifyQRCode(qrInput)}
                disabled={!qrInput.trim() || verifying}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
              >
                {verifying ? 'Verifying...' : 'Verify Ticket'}
              </button>
            </div>
          ) : (
            <div className="text-center">
              {/* Result Display */}
              <div className={`p-6 rounded-lg ${
                result.success ? 'bg-green-50 dark:bg-green-900/20' :
                result.status === 'used' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                'bg-red-50 dark:bg-red-900/20'
              }`}>
                <div className="flex justify-center mb-4">
                  {result.success ? (
                    <CheckCircle className="h-20 w-20 text-green-500" />
                  ) : result.status === 'used' ? (
                    <AlertCircle className="h-20 w-20 text-yellow-500" />
                  ) : (
                    <XCircle className="h-20 w-20 text-red-500" />
                  )}
                </div>

                <h2 className={`text-2xl font-bold mb-2 ${
                  result.success ? 'text-green-700 dark:text-green-400' :
                  result.status === 'used' ? 'text-yellow-700 dark:text-yellow-400' :
                  'text-red-700 dark:text-red-400'
                }`}>
                  {result.message.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </h2>

                {result.success && (
                  <div className="mt-4 text-gray-600 dark:text-gray-400">
                    <p className="font-semibold">Ticket Number: {(result as any).ticket_number}</p>
                    <p>Type: {(result as any).ticket_type}</p>
                    <p>Verified at: {new Date((result as any).verified_at).toLocaleString()}</p>
                    <p>Scan #: {(result as any).scan_count}</p>
                  </div>
                )}

                {result.status === 'used' && (result as any).verified_at && (
                  <div className="mt-4 text-gray-600 dark:text-gray-400">
                    <p className="font-semibold text-yellow-600">⚠️ This ticket was already scanned!</p>
                    <p>First scanned: {new Date((result as any).verified_at).toLocaleString()}</p>
                    <p>Verified by: {(result as any).verified_by || 'Scanner'}</p>
                  </div>
                )}
              </div>

              <button
                onClick={resetScanner}
                className="mt-6 w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
              >
                Scan Another Ticket
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Scan QR code with camera or paste the QR data/URL above</p>
          <p className="mt-2">
            Valid tickets will show: <span className="text-green-600 font-medium">TICKET VERIFIED ✓</span>
          </p>
          <p>
            Invalid tickets will show: <span className="text-red-600 font-medium">TICKET NOT AVAILABLE</span>
          </p>
        </div>
      </div>
    </div>
  )
}