'use client'

import { useState, useRef, useEffect } from 'react'
import { QrCode, CheckCircle, XCircle, AlertCircle, Camera, X, Info, Loader2 } from 'lucide-react'
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode'
import { SMALL_QR_CONFIG, getOptimalCamera } from '@/lib/small-qr-scanner'

export default function SimpleVerifyPage() {
  const [qrInput, setQrInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [scanAttempts, setScanAttempts] = useState(0)
  const [showTips, setShowTips] = useState(false)
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

  // Enhanced scanner for small QR codes
  useEffect(() => {
    if (scannerActive && !scannerRef.current) {
      // Small delay to ensure div is rendered
      const timer = setTimeout(async () => {
        setIsInitializing(true)
        try {
          const html5QrCode = new Html5Qrcode('qr-reader', {
            verbose: false,
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true
            }
          } as any)
          scannerRef.current = html5QrCode
          
          // Get optimal camera for scanning
          const cameraId = await getOptimalCamera()
          
          if (!cameraId) {
            throw new Error('No camera found')
          }
          
          // Use enhanced configuration for small QR codes
          const config = {
            ...SMALL_QR_CONFIG,
            fps: 30, // High FPS for small QR detection
            qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
              const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
              const qrboxSize = Math.floor(minEdgeSize * 0.7) // 70% scan area
              return {
                width: qrboxSize,
                height: qrboxSize
              }
            }
          }
          
          await html5QrCode.start(
            cameraId,
            config,
            (decodedText) => {
              console.log('Small QR Code detected:', decodedText)
              setScanAttempts(0)
              verifyQRCode(decodedText)
            },
            (errorMessage) => {
              // Track scan attempts for small QRs
              if (!errorMessage.includes('NotFoundException')) {
                console.log('Scan error:', errorMessage)
              }
              // Show tips after 5 seconds of scanning
              if (scanAttempts === 0) {
                setScanAttempts(1)
                setTimeout(() => {
                  if (scannerRef.current) {
                    setShowTips(true)
                  }
                }, 5000)
              }
            }
          )
          
          console.log('Enhanced QR scanner started for small QR codes')
        } catch (err) {
          console.error('Failed to start scanner:', err)
          setScannerActive(false)
          alert('Unable to access camera. Please check permissions.')
        } finally {
          setIsInitializing(false)
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [scannerActive, scanAttempts])

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
    setShowTips(false)
    setScanAttempts(0)
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
              {/* Enhanced Camera Scanner for Small QR Codes */}
              {scannerActive ? (
                <div className="space-y-4">
                  <div className="relative">
                    <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />
                    
                    {/* Loading overlay */}
                    {isInitializing && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                        <div className="text-white text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                          <p className="text-sm">Initializing enhanced scanner...</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Scanner overlay with guidelines */}
                    {!isInitializing && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-8 border-2 border-white rounded-lg opacity-50">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400"></div>
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400"></div>
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400"></div>
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400"></div>
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={stopScanner}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full z-10"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    
                    {/* Small QR indicator */}
                    <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                      Optimized for Small QR
                    </div>
                  </div>
                  
                  {/* Small QR Scanning Tips */}
                  {showTips && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                            Tips for Small Printed QR Codes:
                          </p>
                          <ul className="space-y-1 text-blue-700 dark:text-blue-400">
                            <li>• Hold camera 6-12 inches (15-30cm) from QR</li>
                            <li>• Ensure QR fills 30-50% of the frame</li>
                            <li>• Use good lighting, avoid shadows</li>
                            <li>• Keep camera steady for 2-3 seconds</li>
                            <li>• Try different angles if needed</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
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