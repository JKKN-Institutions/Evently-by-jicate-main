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
  Zap,
  Volume2,
  Flashlight,
  FlashlightOff,
  Smartphone
} from 'lucide-react'
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode'

export default function ProScannerPage() {
  const [qrInput, setQrInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [scanAttempts, setScanAttempts] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showAdvancedMode, setShowAdvancedMode] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [lastScanTime, setLastScanTime] = useState<number | null>(null)
  const [scanSpeed, setScanSpeed] = useState<number | null>(null)
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
  
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scanStartTime = useRef<number>(0)
  const successAudioRef = useRef<HTMLAudioElement | null>(null)
  const focusAudioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio on mount
  useEffect(() => {
    // Create audio elements for feedback
    successAudioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSiK0fPTgjMGHm7A7+OZURE')
    successAudioRef.current.volume = 0.7
    
    focusAudioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSiK0fPTgjMGHm7A7+OZURE')
    focusAudioRef.current.volume = 0.3
  }, [])

  const playSound = (type: 'success' | 'focus') => {
    if (!soundEnabled) return
    
    try {
      if (type === 'success') {
        successAudioRef.current?.play().catch(() => {})
      } else {
        focusAudioRef.current?.play().catch(() => {})
      }
    } catch (e) {
      console.log('Audio playback failed:', e)
    }
  }

  const verifyQRCode = async (qrData: string) => {
    if (!qrData.trim()) return

    // Calculate scan speed
    if (scanStartTime.current > 0) {
      const scanTime = Date.now() - scanStartTime.current
      setScanSpeed(scanTime)
      setLastScanTime(scanTime)
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
      
      // Additional feedback based on result
      if (!data.success && 'vibrate' in navigator) {
        navigator.vibrate([300]) // Longer vibration for error
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

  const startScanner = () => {
    setScannerActive(true)
    setResult(null)
    setScanSpeed(null)
    scanStartTime.current = Date.now()
  }

  // Enhanced scanner with pro features
  useEffect(() => {
    if (scannerActive && !scannerRef.current) {
      const timer = setTimeout(async () => {
        setIsInitializing(true)
        try {
          const html5QrCode = new Html5Qrcode('pro-qr-reader', {
            verbose: false,
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true
            }
          } as any)
          scannerRef.current = html5QrCode
          
          // Get cameras
          const cameras = await Html5Qrcode.getCameras()
          if (cameras && cameras.length > 0) {
            // Prefer back camera
            const backCamera = cameras.find(camera => 
              camera.label.toLowerCase().includes('back') ||
              camera.label.toLowerCase().includes('rear') ||
              camera.label.toLowerCase().includes('environment')
            )
            
            const cameraId = backCamera ? backCamera.id : cameras[0].id
            
            // Pro configuration with higher performance
            const config = {
              fps: 30, // Higher FPS for faster scanning
              qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
                const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
                const qrboxSize = Math.floor(minEdgeSize * 0.75)
                return {
                  width: qrboxSize,
                  height: qrboxSize
                }
              },
              aspectRatio: 1.0,
              // Advanced video constraints for better quality
              videoConstraints: {
                facingMode: 'environment',
                advanced: [{
                  torch: torchEnabled,
                  zoom: zoomLevel
                } as any]
              }
            }
            
            await html5QrCode.start(
              cameraId,
              config,
              (decodedText) => {
                console.log('QR Code detected:', decodedText)
                playSound('focus')
                setScanAttempts(0)
                verifyQRCode(decodedText)
              },
              (errorMessage) => {
                // Count scan attempts for feedback
                if (!errorMessage.includes('NotFoundException')) {
                  console.log('Scan error:', errorMessage)
                }
                setScanAttempts(prev => prev + 1)
              }
            )
            
            console.log('Pro scanner started successfully')
            setShowAdvancedMode(true)
          } else {
            throw new Error('No cameras found')
          }
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
  }, [scannerActive, torchEnabled, zoomLevel])

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null
        setScannerActive(false)
        setShowAdvancedMode(false)
      }).catch((err) => {
        console.error('Failed to stop scanner:', err)
      })
    }
  }

  const toggleTorch = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.applyVideoConstraints({
          advanced: [{
            torch: !torchEnabled
          } as any]
        })
        setTorchEnabled(!torchEnabled)
      } catch (err) {
        console.log('Torch not supported:', err)
      }
    }
  }

  const adjustZoom = async (newZoom: number) => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.applyVideoConstraints({
          advanced: [{
            zoom: newZoom
          } as any]
        })
        setZoomLevel(newZoom)
      } catch (err) {
        console.log('Zoom not supported:', err)
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
    setScanAttempts(0)
    setScanSpeed(null)
    setTorchEnabled(false)
    setZoomLevel(1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950">
      {/* Header */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="relative">
                <QrCode className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                <Zap className="h-4 w-4 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <h1 className="ml-3 text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Pro Scanner
              </h1>
              <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold rounded-full animate-pulse">
                ULTRA FAST
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
              >
                <Volume2 className={`h-5 w-5 ${soundEnabled ? 'text-indigo-600' : 'text-gray-400'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {(lastScanTime || scanSpeed) && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-center space-x-6 text-sm">
            {scanSpeed && (
              <div className="flex items-center">
                <Zap className="h-4 w-4 mr-1" />
                <span>Last scan: {(scanSpeed / 1000).toFixed(2)}s</span>
              </div>
            )}
            {scanAttempts > 10 && (
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span>Adjusting focus...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-4 mt-8">
        {!result ? (
          <div className="space-y-6">
            {/* Scanner Area */}
            {scannerActive ? (
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* Scanner Controls */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Camera className="h-5 w-5" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      </div>
                      <span className="font-medium">
                        {isInitializing ? 'Initializing Pro Mode...' : 'Scanning...'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Torch Toggle */}
                      {showAdvancedMode && (
                        <button
                          onClick={toggleTorch}
                          className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                          title="Toggle flashlight"
                        >
                          {torchEnabled ? (
                            <Flashlight className="h-5 w-5" />
                          ) : (
                            <FlashlightOff className="h-5 w-5" />
                          )}
                        </button>
                      )}
                      
                      {/* Close Button */}
                      <button
                        onClick={stopScanner}
                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Zoom Controls */}
                  {showAdvancedMode && (
                    <div className="mt-3 flex items-center space-x-2">
                      <span className="text-white/80 text-sm">Zoom:</span>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="0.5"
                        value={zoomLevel}
                        onChange={(e) => adjustZoom(parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-white/30 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-white text-sm font-medium">{zoomLevel}x</span>
                    </div>
                  )}
                </div>
                
                {/* Scanner View */}
                <div className="relative bg-black">
                  <div id="pro-qr-reader" className="w-full" />
                  
                  {/* Loading overlay */}
                  {isInitializing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-white mb-4 mx-auto" />
                        <p className="text-white font-medium">Activating Pro Mode</p>
                        <p className="text-white/70 text-sm mt-1">Enhanced scanning capabilities</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Pro Mode Indicator */}
                  {!isInitializing && (
                    <div className="absolute top-4 left-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center">
                      <Zap className="h-3 w-3 mr-1" />
                      PRO MODE ACTIVE
                    </div>
                  )}
                  
                  {/* Scan attempts indicator */}
                  {scanAttempts > 5 && !isInitializing && (
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <p className="text-white/80 text-sm">
                        Move closer to QR code for better detection
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                {/* Welcome Screen */}
                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-6 shadow-lg">
                    <QrCode className="h-12 w-12 text-white" />
                    <Zap className="h-6 w-6 text-yellow-400 absolute -top-2 -right-2 animate-bounce" />
                  </div>
                  
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    Pro Scanner Ready
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Lightning-fast verification with advanced features
                  </p>
                  
                  <button
                    onClick={startScanner}
                    className="group relative inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
                  >
                    <Camera className="h-5 w-5 mr-3" />
                    <span>Start Pro Scanning</span>
                    <div className="absolute inset-0 rounded-2xl bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  </button>
                  
                  {/* Features */}
                  <div className="mt-12 grid grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-xl p-4">
                      <Zap className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Ultra Fast</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">30 FPS scanning</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-4">
                      <Flashlight className="h-8 w-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Torch Control</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Low light support</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-4">
                      <Smartphone className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Haptic Feedback</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Touch response</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Input Section */}
            {!scannerActive && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-white dark:bg-gray-800 text-gray-500">Or enter manually</span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <textarea
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Paste QR code data here..."
                    rows={3}
                  />
                  <button
                    onClick={() => verifyQRCode(qrInput)}
                    disabled={!qrInput.trim() || verifying}
                    className="mt-3 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium py-3 px-4 rounded-xl transition-all"
                  >
                    {verifying ? 'Verifying...' : 'Verify Ticket'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
            {/* Result Display */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-2xl mb-6 ${
                result.success ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
                result.status === 'used' ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                'bg-gradient-to-br from-red-400 to-pink-500'
              }`}>
                {result.success ? (
                  <CheckCircle className="h-12 w-12 text-white" />
                ) : result.status === 'used' ? (
                  <AlertCircle className="h-12 w-12 text-white" />
                ) : (
                  <XCircle className="h-12 w-12 text-white" />
                )}
              </div>

              <h2 className={`text-2xl font-bold mb-4 ${
                result.success ? 'text-green-700 dark:text-green-400' :
                result.status === 'used' ? 'text-yellow-700 dark:text-yellow-400' :
                'text-red-700 dark:text-red-400'
              }`}>
                {result.message}
              </h2>

              {/* Scan Speed Display */}
              {scanSpeed && result.success && (
                <div className="mb-4 inline-flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
                  <Zap className="h-4 w-4 mr-1" />
                  Scanned in {(scanSpeed / 1000).toFixed(2)} seconds
                </div>
              )}

              {result.success && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
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
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 mb-6">
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
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-medium rounded-xl transition-all"
              >
                Scan Another Ticket
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}