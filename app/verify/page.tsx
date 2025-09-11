'use client'

import { useState, useRef, useEffect } from 'react'
import { QrCode, CheckCircle, XCircle, AlertCircle, Camera, X, Info, Loader2, Zap, Focus, ZoomIn, Flashlight, FlashlightOff, Volume2 } from 'lucide-react'
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode'
import { SMALL_QR_CONFIG, getOptimalCamera } from '@/lib/small-qr-scanner'
import { StableQRScanner } from '@/lib/stable-qr-scanner'

export default function SimpleVerifyPage() {
  const [qrInput, setQrInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [scanAttempts, setScanAttempts] = useState(0)
  const [showTips, setShowTips] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [torchOn, setTorchOn] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [qrDetected, setQrDetected] = useState(false)
  const [autoZoomActive, setAutoZoomActive] = useState(false)
  const [scanSpeed, setScanSpeed] = useState<number | null>(null)
  const [scanningMode, setScanningMode] = useState<string>('Initializing...')
  const [result, setResult] = useState<{
    success: boolean
    message: string
    status?: string
  } | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const stableScannerRef = useRef<StableQRScanner | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scanStartTime = useRef<number>(0)
  const successSound = useRef<HTMLAudioElement | null>(null)
  const focusSound = useRef<HTMLAudioElement | null>(null)
  const autoZoomInterval = useRef<NodeJS.Timeout | null>(null)

  const verifyQRCode = async (qrData: string) => {
    if (!qrData.trim()) return

    // Calculate scan speed
    if (scanStartTime.current > 0) {
      const scanTime = Date.now() - scanStartTime.current
      setScanSpeed(scanTime)
    }

    setVerifying(true)
    setResult(null)
    stopScanner()

    // Play success sound and haptic feedback
    playSound('success')
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100])
    }

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
    setScanSpeed(null)
    scanStartTime.current = Date.now()
    setAutoZoomActive(true)
  }

  // Initialize audio
  useEffect(() => {
    successSound.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSiK0fPTgjMGHm7A7+OZURE')
    successSound.current.volume = 0.7
    focusSound.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSiK0fPTgjMGHm7A7+OZURE')
    focusSound.current.volume = 0.3
  }, [])

  const playSound = (type: 'success' | 'focus') => {
    if (!soundEnabled) return
    try {
      if (type === 'success') {
        successSound.current?.play().catch(() => {})
      } else {
        focusSound.current?.play().catch(() => {})
      }
    } catch (e) {}
  }

  // Stable QR Scanner with manual zoom control
  useEffect(() => {
    if (scannerActive && !stableScannerRef.current) {
      // Small delay to ensure div is rendered
      const timer = setTimeout(async () => {
        setIsInitializing(true)
        
        try {
          // Create stable scanner
          const scanner = new StableQRScanner({
            elementId: 'qr-reader',
            onSuccess: (decodedText) => {
              console.log('✅ QR Code detected:', decodedText)
              setQrDetected(true)
              playSound('focus')
              setScanAttempts(0)
              verifyQRCode(decodedText)
            },
            onError: (error) => {
              console.error('Scanner error:', error)
              setScannerActive(false)
              alert(`Scanner error: ${error}`)
            }
          })
          
          stableScannerRef.current = scanner
          
          // Start the scanner
          await scanner.start()
          
          console.log('✅ Enhanced QR scanner started')
          
          // Get video element for additional controls
          setTimeout(() => {
            const videos = document.getElementsByTagName('video')
            if (videos.length > 0) {
              videoRef.current = videos[0]
            }
          }, 500)
          
          // Show tips after 5 seconds
          setTimeout(() => {
            if (stableScannerRef.current) {
              setShowTips(true)
            }
          }, 5000)
          
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
  }, [scannerActive])

  const stopScanner = async () => {
    // Stop stable scanner if active
    if (stableScannerRef.current) {
      await stableScannerRef.current.stop()
      stableScannerRef.current = null
    }
    
    // Stop old scanner if active
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null
      }).catch((err) => {
        console.error('Failed to stop scanner:', err)
      })
    }
    
    setScannerActive(false)
    setAutoZoomActive(false)
    stopAutoZoom()
  }

  // Auto-zoom functionality
  const startAutoZoom = () => {
    if (autoZoomInterval.current) return
    
    autoZoomInterval.current = setInterval(() => {
      if (videoRef.current && autoZoomActive) {
        adjustZoomAutomatically()
      }
    }, 1000)
  }

  const stopAutoZoom = () => {
    if (autoZoomInterval.current) {
      clearInterval(autoZoomInterval.current)
      autoZoomInterval.current = null
    }
  }

  const adjustZoomAutomatically = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return
    
    const stream = videoRef.current.srcObject as MediaStream
    const track = stream.getVideoTracks()[0]
    
    if (track && 'getCapabilities' in track) {
      const capabilities = track.getCapabilities() as any
      
      if (capabilities.zoom) {
        const currentZoom = (track.getSettings() as any).zoom || 1
        
        // Auto-adjust based on scan attempts
        let targetZoom = currentZoom
        if (scanAttempts > 10 && currentZoom < 2) {
          targetZoom = Math.min(currentZoom * 1.2, capabilities.zoom.max || 3)
        } else if (qrDetected && currentZoom > 1.5) {
          targetZoom = Math.max(currentZoom * 0.9, 1)
        }
        
        if (targetZoom !== currentZoom) {
          await track.applyConstraints({
            advanced: [{ zoom: targetZoom } as any]
          })
          setZoomLevel(targetZoom)
        }
      }
    }
  }

  const toggleTorch = async () => {
    // Try stable scanner torch first
    if (stableScannerRef.current) {
      const newState = await stableScannerRef.current.toggleTorch()
      setTorchOn(newState)
      return
    }
    
    // Fallback to manual torch control
    if (!videoRef.current || !videoRef.current.srcObject) return
    
    const stream = videoRef.current.srcObject as MediaStream
    const track = stream.getVideoTracks()[0]
    
    if (track && 'getCapabilities' in track) {
      const capabilities = track.getCapabilities() as any
      
      if (capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn } as any]
        })
        setTorchOn(!torchOn)
      }
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
    setZoomLevel(1)
    setTorchOn(false)
    setQrDetected(false)
    setScanSpeed(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="relative inline-block">
              <QrCode className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <Zap className="h-6 w-6 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Enhanced Ticket Scanner
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Auto-zoom • Auto-detect • Lightning fast
            </p>
            {scanSpeed && (
              <div className="mt-2 inline-flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
                <Zap className="h-4 w-4 mr-1" />
                Last scan: {(scanSpeed / 1000).toFixed(2)}s
              </div>
            )}
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
                          {/* Animated scanning line */}
                          <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent" 
                               style={{
                                 animation: 'scan 2s ease-in-out infinite',
                                 boxShadow: '0 0 10px rgba(74, 222, 128, 0.7)'
                               }} />
                          {/* Corner brackets with glow effect */}
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400 animate-pulse"></div>
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400 animate-pulse"></div>
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400 animate-pulse"></div>
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400 animate-pulse"></div>
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={stopScanner}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full z-10"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    
                    {/* Status indicators */}
                    <div className="absolute top-2 left-2 space-y-2">
                      <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium flex items-center">
                        <Camera className="h-3 w-3 mr-1" />
                        Enhanced Scanner
                      </div>
                      {zoomLevel > 1 && (
                        <div className="bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">
                          Zoom: {zoomLevel.toFixed(1)}x
                        </div>
                      )}
                      {qrDetected && (
                        <div className="bg-yellow-600 text-white px-2 py-1 rounded text-xs font-medium flex items-center animate-pulse">
                          <Focus className="h-3 w-3 mr-1" />
                          QR Detected
                        </div>
                      )}
                    </div>
                    
                    {/* Control buttons */}
                    <div className="absolute top-2 right-2 flex space-x-2">
                      <button
                        onClick={toggleTorch}
                        className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full"
                        title="Toggle flashlight"
                      >
                        {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full"
                        title="Toggle sound"
                      >
                        <Volume2 className={`h-5 w-5 ${soundEnabled ? '' : 'opacity-50'}`} />
                      </button>
                      <button
                        onClick={stopScanner}
                        className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Manual Zoom Control */}
                  <div className="mt-4 bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Manual Zoom</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={async () => {
                            const newZoom = Math.max(1, zoomLevel - 0.5)
                            if (stableScannerRef.current) {
                              await stableScannerRef.current.setZoom(newZoom)
                              setZoomLevel(newZoom)
                            }
                          }}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                        >
                          -
                        </button>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 min-w-[3rem] text-center">
                          {zoomLevel.toFixed(1)}x
                        </span>
                        <button
                          onClick={async () => {
                            const newZoom = Math.min(5, zoomLevel + 0.5)
                            if (stableScannerRef.current) {
                              await stableScannerRef.current.setZoom(newZoom)
                              setZoomLevel(newZoom)
                            }
                          }}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Adjust zoom manually for better QR detection
                    </p>
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
                            <li>• Use manual zoom controls to adjust</li>
                            <li>• Hold camera 6-12 inches from QR code</li>
                            <li>• Use the torch button for low light</li>
                            <li>• Keep camera steady for better focus</li>
                            <li>• Try zoom 1.5x-2x for small QR codes</li>
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
      
      {/* Add CSS for scan animation */}
      <style jsx>{`
        @keyframes scan {
          0% {
            transform: translateY(-100px);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(100px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}