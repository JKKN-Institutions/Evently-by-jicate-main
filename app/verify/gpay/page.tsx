'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  QrCode, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Camera, 
  X, 
  Loader2,
  Flashlight,
  FlashlightOff,
  ZoomIn,
  Focus,
  Smartphone,
  Volume2
} from 'lucide-react'
import { GPayStyleScanner } from '@/lib/gpay-style-scanner'

export default function GPayStyleVerifyPage() {
  const [verifying, setVerifying] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [scannerState, setScannerState] = useState<string>('idle')
  const [zoomLevel, setZoomLevel] = useState(100)
  const [torchOn, setTorchOn] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    status?: string
    ticket_number?: string
    ticket_type?: string
    verified_at?: string
    scan_count?: number
    verified_by?: string
  } | null>(null)
  
  const scannerRef = useRef<GPayStyleScanner | null>(null)
  const scannerDivRef = useRef<HTMLDivElement>(null)

  const verifyQRCode = async (qrData: string) => {
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
      
      // Additional haptic feedback for result
      if ('vibrate' in navigator) {
        if (data.success) {
          navigator.vibrate([100, 50, 100]) // Double vibration for success
        } else {
          navigator.vibrate([300]) // Long vibration for error
        }
      }
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

  const startScanner = async () => {
    setScannerActive(true)
    setResult(null)
    setIsInitializing(true)
    setScannerState('initializing')

    // Wait for div to be rendered
    setTimeout(async () => {
      try {
        const scanner = new GPayStyleScanner('gpay-qr-reader')
        scannerRef.current = scanner
        
        await scanner.start(
          (decodedText) => {
            console.log('QR Code detected:', decodedText)
            verifyQRCode(decodedText)
          },
          (error) => {
            console.error('Scanner error:', error)
            setScannerActive(false)
            alert('Unable to access camera. Please check permissions.')
          },
          (state) => {
            setScannerState(state)
            
            // Parse zoom level from state
            if (state.startsWith('zoom_')) {
              const zoom = parseInt(state.replace('zoom_', ''))
              setZoomLevel(zoom)
            }
            
            // Parse torch state
            if (state.startsWith('torch_')) {
              setTorchOn(state === 'torch_on')
            }
          }
        )
        
        setIsInitializing(false)
      } catch (err) {
        console.error('Failed to start scanner:', err)
        setScannerActive(false)
        setIsInitializing(false)
      }
    }, 100)
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop()
      scannerRef.current = null
    }
    setScannerActive(false)
    setScannerState('idle')
  }

  const toggleTorch = async () => {
    if (scannerRef.current) {
      await scannerRef.current.toggleTorch()
    }
  }

  const resetScanner = () => {
    setResult(null)
    setScannerActive(false)
    setScannerState('idle')
    setZoomLevel(100)
    setTorchOn(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop()
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-indigo-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <QrCode className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Ticket Scanner Pro
              </h1>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Volume2 className={`h-5 w-5 ${soundEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-4 mt-8">
        {!result ? (
          <div className="space-y-6">
            {/* Scanner Area */}
            {scannerActive ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
                {/* Scanner Controls */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center space-x-2">
                      <Camera className="h-5 w-5" />
                      <span className="font-medium">
                        {scannerState === 'focusing' ? 'Focusing...' :
                         scannerState === 'scanning' ? 'Scanning...' :
                         scannerState === 'success' ? 'Success!' :
                         'Initializing...'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Torch Toggle */}
                      <button
                        onClick={toggleTorch}
                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                        title="Toggle flashlight"
                      >
                        {torchOn ? (
                          <Flashlight className="h-5 w-5" />
                        ) : (
                          <FlashlightOff className="h-5 w-5" />
                        )}
                      </button>
                      
                      {/* Close Button */}
                      <button
                        onClick={stopScanner}
                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Zoom Indicator */}
                  {zoomLevel !== 100 && (
                    <div className="mt-2 flex items-center text-white/80 text-sm">
                      <ZoomIn className="h-4 w-4 mr-1" />
                      <span>Zoom: {zoomLevel}%</span>
                    </div>
                  )}
                </div>
                
                {/* Scanner View */}
                <div className="relative bg-black">
                  <div 
                    id="gpay-qr-reader" 
                    ref={scannerDivRef}
                    className="w-full"
                    style={{ minHeight: '400px' }}
                  />
                  
                  {/* Loading Overlay */}
                  {isInitializing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-white mb-4 mx-auto" />
                        <p className="text-white font-medium">Starting camera...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Scanning Overlay */}
                  {!isInitializing && scannerActive && (
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Center Focus Area */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                          {/* Animated scanning line */}
                          <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan" />
                          
                          {/* Corner brackets */}
                          <svg
                            className="w-64 h-64"
                            viewBox="0 0 256 256"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            {/* Top-left corner */}
                            <path
                              d="M20 20 L20 60 M20 20 L60 20"
                              stroke="white"
                              strokeWidth="4"
                              strokeLinecap="round"
                              className="animate-pulse"
                            />
                            {/* Top-right corner */}
                            <path
                              d="M236 20 L196 20 M236 20 L236 60"
                              stroke="white"
                              strokeWidth="4"
                              strokeLinecap="round"
                              className="animate-pulse"
                            />
                            {/* Bottom-left corner */}
                            <path
                              d="M20 236 L20 196 M20 236 L60 236"
                              stroke="white"
                              strokeWidth="4"
                              strokeLinecap="round"
                              className="animate-pulse"
                            />
                            {/* Bottom-right corner */}
                            <path
                              d="M236 236 L236 196 M236 236 L196 236"
                              stroke="white"
                              strokeWidth="4"
                              strokeLinecap="round"
                              className="animate-pulse"
                            />
                          </svg>
                          
                          {/* Status indicator */}
                          {scannerState === 'focusing' && (
                            <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2">
                              <div className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                                <Focus className="h-4 w-4 animate-pulse" />
                                <span>QR Detected</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Instructions */}
                      <div className="absolute bottom-4 left-0 right-0 text-center">
                        <p className="text-white text-sm font-medium">
                          Point camera at QR code
                        </p>
                        <p className="text-white/70 text-xs mt-1">
                          Auto-zoom will adjust for best scanning
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                {/* Welcome Screen */}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-6">
                    <QrCode className="h-10 w-10 text-white" />
                  </div>
                  
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Ready to Scan
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Fast and accurate ticket verification
                  </p>
                  
                  <button
                    onClick={startScanner}
                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg"
                  >
                    <Camera className="h-5 w-5 mr-3" />
                    Start Scanning
                  </button>
                  
                  {/* Features */}
                  <div className="mt-12 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg mb-2">
                        <ZoomIn className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Auto Zoom</p>
                    </div>
                    <div>
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg mb-2">
                        <Focus className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Auto Focus</p>
                    </div>
                    <div>
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg mb-2">
                        <Smartphone className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Haptic Feedback</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            {/* Result Display */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 ${
                result.success ? 'bg-green-100 dark:bg-green-900/30' :
                result.status === 'used' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                'bg-red-100 dark:bg-red-900/30'
              }`}>
                {result.success ? (
                  <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                ) : result.status === 'used' ? (
                  <AlertCircle className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
                ) : (
                  <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
                )}
              </div>

              <h2 className={`text-2xl font-bold mb-4 ${
                result.success ? 'text-green-700 dark:text-green-400' :
                result.status === 'used' ? 'text-yellow-700 dark:text-yellow-400' :
                'text-red-700 dark:text-red-400'
              }`}>
                {result.message}
              </h2>

              {result.success && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                  <div className="space-y-2 text-left">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Ticket Number:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{result.ticket_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Type:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{result.ticket_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Verified At:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {new Date(result.verified_at!).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Scan Count:</span>
                      <span className="font-medium text-gray-900 dark:text-white">#{result.scan_count}</span>
                    </div>
                  </div>
                </div>
              )}

              {result.status === 'used' && result.verified_at && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mb-6">
                  <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                    ⚠️ This ticket was already scanned
                  </p>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    <p>First scanned: {new Date(result.verified_at).toLocaleString()}</p>
                    <p>Verified by: {result.verified_by || 'Scanner'}</p>
                  </div>
                </div>
              )}

              <button
                onClick={resetScanner}
                className="inline-flex items-center px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
              >
                Scan Another Ticket
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add custom styles for animations */}
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
        
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}