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
  RefreshCw,
  Smartphone,
  Volume2,
  AlertTriangle,
  Settings,
  WifiOff
} from 'lucide-react'
import { EnhancedQRScannerV2 } from '@/lib/enhanced-qr-scanner-v2'

export default function GPayV2ScannerPage() {
  const [verifying, setVerifying] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [scannerState, setScannerState] = useState<string>('idle')
  const [error, setError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showPermissionHelp, setShowPermissionHelp] = useState(false)
  const [cameraList, setCameraList] = useState<{id: string, label: string}[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
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
  
  const scannerRef = useRef<EnhancedQRScannerV2 | null>(null)
  const successSoundRef = useRef<HTMLAudioElement | null>(null)
  const errorSoundRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Initialize audio elements
    successSoundRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSiK0fPTgjMGHm7A7+OZURE')
    successSoundRef.current.volume = 0.5
    
    errorSoundRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSiK0fPTgjMGHm7A7+OZURE')
    errorSoundRef.current.volume = 0.3
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop()
      }
    }
  }, [])

  const playSound = (type: 'success' | 'error') => {
    if (!soundEnabled) return
    
    try {
      if (type === 'success') {
        successSoundRef.current?.play().catch(() => {})
      } else {
        errorSoundRef.current?.play().catch(() => {})
      }
    } catch (e) {
      console.log('Sound play failed:', e)
    }
  }

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
      
      // Play sound and vibration feedback
      if (data.success) {
        playSound('success')
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100])
        }
      } else {
        playSound('error')
        if ('vibrate' in navigator) {
          navigator.vibrate([300])
        }
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Verification failed - Network error',
        status: 'error'
      })
      playSound('error')
    } finally {
      setVerifying(false)
    }
  }

  const startScanner = async () => {
    setScannerActive(true)
    setResult(null)
    setError(null)
    setIsInitializing(true)
    setScannerState('initializing')
    setShowPermissionHelp(false)

    // Wait for div to be rendered
    setTimeout(async () => {
      try {
        const scanner = new EnhancedQRScannerV2('enhanced-qr-reader')
        scannerRef.current = scanner
        
        // Try to get camera list first
        try {
          const cameras = await scanner.getCameras()
          setCameraList(cameras)
          console.log('Available cameras:', cameras)
        } catch (cameraError) {
          console.error('Camera detection error:', cameraError)
          setError('Camera not accessible. Please check permissions.')
          setShowPermissionHelp(true)
          setScannerActive(false)
          setIsInitializing(false)
          return
        }
        
        await scanner.start(
          (decodedText) => {
            console.log('QR Code detected:', decodedText)
            setScannerState('success')
            verifyQRCode(decodedText)
          },
          (error) => {
            console.error('Scanner error:', error)
            setError(error)
            setScannerState('error')
            
            if (error.includes('permission')) {
              setShowPermissionHelp(true)
            }
          }
        )
        
        setIsInitializing(false)
        setScannerState('scanning')
        setSelectedCamera(scanner.getCurrentCamera())
      } catch (err) {
        console.error('Failed to start scanner:', err)
        setError(err instanceof Error ? err.message : 'Failed to start scanner')
        setScannerActive(false)
        setIsInitializing(false)
        setScannerState('error')
        setShowPermissionHelp(true)
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
    setError(null)
  }

  const retryScanner = async () => {
    setError(null)
    setShowPermissionHelp(false)
    await startScanner()
  }

  const resetScanner = () => {
    setResult(null)
    setScannerActive(false)
    setScannerState('idle')
    setError(null)
    setShowPermissionHelp(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-indigo-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <QrCode className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Pro Scanner V2
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Volume2 className={`h-5 w-5 ${soundEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
              </button>
            </div>
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
                {/* Scanner Status Bar */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center space-x-2">
                      <Camera className="h-5 w-5" />
                      <span className="font-medium">
                        {isInitializing ? 'Initializing Camera...' :
                         scannerState === 'scanning' ? 'Scanning for QR Code...' :
                         scannerState === 'success' ? 'QR Code Detected!' :
                         scannerState === 'error' ? 'Camera Error' :
                         'Ready'}
                      </span>
                    </div>
                    <button
                      onClick={stopScanner}
                      className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  {/* Camera info */}
                  {selectedCamera && cameraList.length > 0 && (
                    <div className="mt-2 text-white/80 text-xs">
                      Using: {cameraList.find(c => c.id === selectedCamera)?.label || 'Camera'}
                    </div>
                  )}
                </div>
                
                {/* Scanner View */}
                <div className="relative bg-black">
                  <div 
                    id="enhanced-qr-reader" 
                    className="w-full"
                    style={{ minHeight: '400px' }}
                  />
                  
                  {/* Loading Overlay */}
                  {isInitializing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-white mb-4 mx-auto" />
                        <p className="text-white font-medium">Accessing camera...</p>
                        <p className="text-white/70 text-sm mt-2">Please allow camera access when prompted</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Error Overlay */}
                  {error && !isInitializing && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
                        <div className="flex items-center mb-4">
                          <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Camera Issue
                          </h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          {error}
                        </p>
                        <div className="flex space-x-2">
                          <button
                            onClick={retryScanner}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                          </button>
                          <button
                            onClick={stopScanner}
                            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Permission Help */}
                {showPermissionHelp && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-start">
                      <Settings className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                          Camera Permission Required
                        </h4>
                        <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
                          <p>To enable camera access:</p>
                          <ol className="list-decimal list-inside space-y-1">
                            <li>Click the camera icon in your browser's address bar</li>
                            <li>Select "Allow" for camera permissions</li>
                            <li>Refresh the page if needed</li>
                          </ol>
                          <p className="mt-2">
                            <strong>Note:</strong> HTTPS connection is required for camera access.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
                    Enhanced QR code scanner with better compatibility
                  </p>
                  
                  <button
                    onClick={startScanner}
                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg"
                  >
                    <Camera className="h-5 w-5 mr-3" />
                    Start Scanning
                  </button>
                  
                  {/* Troubleshooting Tips */}
                  <div className="mt-12 text-left bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Tips for Best Results
                    </h3>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• Ensure good lighting on the QR code</li>
                      <li>• Hold device steady 6-12 inches from QR code</li>
                      <li>• Allow camera permissions when prompted</li>
                      <li>• Use Chrome, Safari, or Edge for best compatibility</li>
                      <li>• Close other apps using the camera</li>
                    </ul>
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
    </div>
  )
}