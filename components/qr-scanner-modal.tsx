'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera, AlertCircle, Upload, Loader2, QrCode, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import QRFileScanner from './qr-file-scanner'
import { validateQRSize } from '@/lib/qr-generator'

interface QRScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (result: string) => void
}

export default function QRScannerModal({ isOpen, onClose, onScan }: QRScannerModalProps) {
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [hasCameraDevice, setHasCameraDevice] = useState<boolean | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanAttempts, setScanAttempts] = useState(0)
  const [scanStartTime, setScanStartTime] = useState<number | null>(null)
  const [diagnostics, setDiagnostics] = useState<string[]>([])
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(1)
  const [supportedZoomLevels, setSupportedZoomLevels] = useState<number[]>([1])
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Check camera permission first
  const checkCameraPermission = useCallback(async () => {
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API not available')
        setHasPermission(false)
        setError('Camera API not supported in this browser. Please use the upload option.')
        return false
      }

      // Try to enumerate devices but don't block if it fails
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        
        if (videoDevices.length === 0) {
          console.warn('No camera devices found during enumeration, but will still try to access')
        }
      } catch (enumErr) {
        console.warn('Could not enumerate devices:', enumErr)
      }

      // Try to get camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment'
        } 
      })
      
      // Stop the stream immediately - we just wanted to check permission
      stream.getTracks().forEach(track => track.stop())
      setHasPermission(true)
      return true
    } catch (err) {
      console.error('Camera permission check failed:', err)
      setHasPermission(false)
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission denied. Please allow camera access in your browser settings.')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera found. Try connecting a camera or use the upload option.')
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is busy. Close other apps using the camera and retry.')
        } else {
          setError('Camera issue: ' + err.message + '. You can retry or use upload.')
        }
      }
      return false
    }
  }, [])

  // Add diagnostic message
  const addDiagnostic = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDiagnostics(prev => [...prev, `${timestamp}: ${message}`])
    console.log(`QR Scanner Diagnostic: ${message}`)
  }

  // Diagnose QR size issues
  const diagnoseQRSizeIssues = () => {
    addDiagnostic('🔍 Small QR Code Scanning Tips:')
    addDiagnostic('• Move camera 6-12 inches from QR code')
    addDiagnostic('• Ensure QR code fills 30-50% of camera view')
    addDiagnostic('• Use good lighting - avoid shadows')
    addDiagnostic('• Keep camera steady for 2-3 seconds')
    addDiagnostic('• Try different angles if scanning fails')
  }

  // Try alternative scanning configuration for small QRs
  const tryAlternativeScanning = async () => {
    if (!scannerRef.current) return
    
    addDiagnostic('🔄 Trying alternative scan configuration for small QR codes...')
    
    try {
      await scannerRef.current.stop()
      await scannerRef.current.clear()
      
      // Create fresh scanner instance
      const html5QrCode = new Html5Qrcode('qr-reader-container')
      scannerRef.current = html5QrCode
      
      const cameras = await Html5Qrcode.getCameras()
      const cameraId = cameras[0]?.id
      
      if (cameraId) {
        // Alternative configuration with larger scan area and different settings
        await html5QrCode.start(
          cameraId,
          {
            fps: 20, // Even higher FPS
            qrbox: function(viewfinderWidth, viewfinderHeight) {
              // Try larger scan area
              let minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
              let qrboxSize = Math.floor(minEdgeSize * 0.8) // Larger scan area
              return {
                width: qrboxSize,
                height: qrboxSize
              }
            },
            aspectRatio: 1.777778,
            disableFlip: true, // Disable flip for better performance
            videoConstraints: {
              facingMode: 'environment',
              // Ultra high resolution for tiny details
              width: { ideal: 3840, max: 4096 },
              height: { ideal: 2160, max: 2304 }
            }
          },
          (decodedText) => {
            const scanDuration = scanStartTime ? (Date.now() - scanStartTime) / 1000 : 0
            addDiagnostic(`✅ Small QR detected with alternative config in ${scanDuration.toFixed(1)}s`)
            onScan(decodedText)
            html5QrCode.stop().then(() => html5QrCode.clear())
            onClose()
          },
          (errorMessage) => {
            if (!errorMessage.includes('NotFoundException')) {
              addDiagnostic(`Alternative scan error: ${errorMessage}`)
            }
          }
        )
        
        addDiagnostic('🔍 Alternative scanner active - try positioning QR closer')
      }
    } catch (error) {
      addDiagnostic(`❌ Alternative scan failed: ${error}`)
    }
  }

  // Check for scanning timeout
  const checkScanningTimeout = useCallback(() => {
    if (scanStartTime && isScanning) {
      const scanDuration = (Date.now() - scanStartTime) / 1000
      
      if (scanDuration > 15) { // 15 second timeout - try alternative first
        addDiagnostic('⚠️ Final timeout - No QR code detected after 15 seconds')
        diagnoseQRSizeIssues() // Add size diagnostics
        
        setError(`QR scanning timeout after ${Math.round(scanDuration)} seconds. 

For small QR codes (80-100px):
• Move camera 6-12 inches from QR code
• Fill 30-50% of camera view with QR
• Use good lighting - avoid shadows
• Keep steady for 2-3 seconds
• Try different angles

Alternative: Use the upload option for guaranteed scanning.

Check 'Show Scan Details' for more tips.`)
        setShowDiagnostics(true)
        return true
      } else if (scanDuration > 8) { // 8 second - try alternative scanning
        if (scanAttempts === 1) { // Only try alternative once
          addDiagnostic('🔄 Switching to alternative scanning for small QR codes...')
          tryAlternativeScanning()
          setScanAttempts(2) // Mark as second attempt
        }
      } else if (scanDuration > 5) { // 5 second warning
        addDiagnostic('⏳ Still scanning... Position QR code closer to camera')
        if (scanDuration > 6) {
          addDiagnostic('💡 For small QR codes: Move camera 6-12 inches away')
        }
      }
    }
    return false
  }, [scanStartTime, isScanning])

  // Timeout checker effect
  useEffect(() => {
    if (isScanning && scanStartTime) {
      const timeoutInterval = setInterval(() => {
        checkScanningTimeout()
      }, 1000) // Check every second

      return () => clearInterval(timeoutInterval)
    }
  }, [isScanning, scanStartTime, checkScanningTimeout])

  // Enhanced scanner optimized for small QR codes
  const initializeScanner = useCallback(async () => {
    if (isInitializing || isScanning) return
    
    try {
      setIsInitializing(true)
      setError(null)

      // First check camera permission
      const hasAccess = await checkCameraPermission()
      if (!hasAccess) {
        console.log('Camera access denied, showing error to user')
        setIsInitializing(false)
        return
      }

      // Stop any existing scanner
      if (scannerRef.current) {
        try {
          const state = (scannerRef.current as any).getState?.()
          if (state === 2) { // SCANNING state
            await scannerRef.current.stop()
          }
          await scannerRef.current.clear()
        } catch (e) {
          console.log('Clear error:', e)
        }
      }

      // Create new Html5Qrcode instance
      const html5QrCode = new Html5Qrcode('qr-reader-container')
      scannerRef.current = html5QrCode

      // Get available cameras
      const cameras = await Html5Qrcode.getCameras()
      
      if (!cameras || cameras.length === 0) {
        setError('No cameras found on this device')
        setIsInitializing(false)
        return
      }

      // Prefer back camera if available
      const backCamera = cameras.find(camera => 
        camera.label.toLowerCase().includes('back') || 
        camera.label.toLowerCase().includes('rear') ||
        camera.label.toLowerCase().includes('environment')
      )
      const cameraId = backCamera?.id || cameras[0].id

      console.log('Starting QR scanner optimized for small QR codes...')
      addDiagnostic('🎥 Camera initialized for small QR code scanning')
      addDiagnostic(`📱 Using camera: ${backCamera?.label || cameras[0].label || 'Unknown'}`)
      addDiagnostic('🔍 Optimized for QR codes as small as 80-100px')
      
      setScanStartTime(Date.now())
      setScanAttempts(prev => prev + 1)

      // Enhanced scanning configuration for small QR codes
      await html5QrCode.start(
        cameraId,
        {
          fps: 15,  // Higher FPS for small QR detection
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            // Multiple scan areas for small QR codes
            let minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
            // Use smaller scan box initially to focus on small QRs
            let qrboxSize = Math.floor(minEdgeSize * 0.4) // Reduced from 0.7 to 0.4 for small QRs
            return {
              width: qrboxSize,
              height: qrboxSize
            }
          },
          aspectRatio: 1.0, // Square for better small QR detection
          disableFlip: false,
          videoConstraints: {
            facingMode: 'environment',
            focusMode: 'continuous',
            // Higher resolution for small QR detail capture
            width: { min: 1280, ideal: 1920, max: 3840 },
            height: { min: 720, ideal: 1080, max: 2160 },
            // Enhanced constraints for close-up scanning
            advanced: [
              { focusMode: 'continuous' },
              { focusDistance: { min: 0.1, max: 10 } }, // Close focus range
              { exposureMode: 'continuous' },
              { whiteBalanceMode: 'continuous' },
              { zoom: { min: 1, max: 3 } } // Allow digital zoom
            ]
          }
        },
        (decodedText) => {
          // Success callback
          const scanDuration = scanStartTime ? (Date.now() - scanStartTime) / 1000 : 0
          console.log('QR Code scanned successfully:', decodedText)
          addDiagnostic(`✅ QR code detected successfully in ${scanDuration.toFixed(1)}s`)
          addDiagnostic(`📋 QR data: ${decodedText.substring(0, 50)}${decodedText.length > 50 ? '...' : ''}`)
          
          onScan(decodedText)
          html5QrCode.stop().then(() => {
            html5QrCode.clear()
          }).catch(e => console.log('Stop error:', e))
          onClose()
        },
        (errorMessage) => {
          // Error callback - track scanning attempts and issues
          if (errorMessage.includes('NotFoundException')) {
            // This is normal - just means no QR in view
            return
          }
          
          if (!errorMessage.includes('No MultiFormat Readers')) {
            console.log('QR scan error:', errorMessage)
            addDiagnostic(`❌ Scan error: ${errorMessage}`)
            
            // Specific error diagnostics
            if (errorMessage.includes('NotReadableError')) {
              addDiagnostic('📷 Camera quality issue detected - try better lighting')
            } else if (errorMessage.includes('decode')) {
              addDiagnostic('🔍 QR decode failed - check QR code quality')
            }
          }
        }
      )

      setIsScanning(true)
      addDiagnostic('🔍 Scanner active - Looking for QR codes')
      console.log('QR Scanner started successfully')
    } catch (err) {
      console.error('Failed to initialize scanner:', err)
      addDiagnostic(`❌ Scanner initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setShowDiagnostics(true)
      
      if (err instanceof Error) {
        if (err.message.includes('NotAllowedError')) {
          addDiagnostic('🚫 Camera permission denied')
          setError('Camera permission denied. Please allow camera access and refresh.')
        } else if (err.message.includes('NotFoundError')) {
          addDiagnostic('📷 No camera device found')
          setError('No camera found. Please connect a camera or use the upload option.')
        } else if (err.message.includes('NotReadableError')) {
          addDiagnostic('⚠️ Camera is busy or in use by another app')
          setError('Camera is busy. Close other apps using the camera and try again.')
        } else {
          addDiagnostic(`🔧 Technical issue: ${err.message}`)
          setError('Failed to start camera: ' + err.message)
        }
      } else {
        addDiagnostic('🔧 Unknown scanner error')
        setError('Failed to start camera. You can retry or use the upload option.')
      }
    } finally {
      setIsInitializing(false)
    }
  }, [isInitializing, isScanning, onScan, onClose, checkCameraPermission])

  // Check for camera devices on mount
  useEffect(() => {
    const checkForCameras = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const videoDevices = devices.filter(device => device.kind === 'videoinput')
          const hasCamera = videoDevices.length > 0
          setHasCameraDevice(hasCamera)
          
          if (!hasCamera && isOpen) {
            console.log('No camera detected initially, but user can still try')
            setError('No camera detected. You can try the camera option or use the upload option.')
          }
        } else {
          setHasCameraDevice(true)
          console.log('Cannot enumerate devices, assuming camera exists')
        }
      } catch (err) {
        console.error('Error checking for cameras:', err)
        setHasCameraDevice(true)
      }
    }

    if (isOpen) {
      checkForCameras()
    }
  }, [isOpen])

  // Effect to manage scanner lifecycle
  useEffect(() => {
    if (isOpen && activeTab === 'camera' && hasCameraDevice) {
      const timer = setTimeout(() => {
        initializeScanner()
      }, 100)
      return () => clearTimeout(timer)
    }

    return () => {
      if (scannerRef.current) {
        try {
          const state = (scannerRef.current as any).getState?.()
          if (state === 2) { // SCANNING state
            scannerRef.current.stop().then(() => {
              scannerRef.current?.clear()
              scannerRef.current = null
            }).catch(e => console.log('Stop error:', e))
          } else {
            scannerRef.current.clear()
            scannerRef.current = null
          }
        } catch (e) {
          console.log('Cleanup error:', e)
        }
      }
      setIsScanning(false)
    }
  }, [isOpen, activeTab, initializeScanner, hasCameraDevice])

  const handleClose = async () => {
    if (scannerRef.current) {
      try {
        const state = (scannerRef.current as any).getState?.()
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop()
        }
        await scannerRef.current.clear()
      } catch (e) {
        console.log('Clear error on close:', e)
      }
    }
    setIsScanning(false)
    setScanStartTime(null)
    setScanAttempts(0)
    setDiagnostics([])
    setShowDiagnostics(false)
    setError(null)
    onClose()
  }

  const handleTabChange = async (tab: 'camera' | 'upload') => {
    if (tab !== activeTab) {
      if (scannerRef.current && activeTab === 'camera') {
        try {
          const state = (scannerRef.current as any).getState?.()
          if (state === 2) { // SCANNING state
            await scannerRef.current.stop()
          }
          await scannerRef.current.clear()
          scannerRef.current = null
        } catch (e) {
          console.log('Clear error on tab change:', e)
        }
      }
      setIsScanning(false)
      setError(null)
      setActiveTab(tab)
    }
  }


  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Scan QR Code</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b">
          <button
            onClick={() => handleTabChange('camera')}
            disabled={isInitializing}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'camera'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800'
            } ${isInitializing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-center gap-2">
              {isInitializing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              <span>Camera Scan</span>
            </div>
          </button>
          <button
            onClick={() => handleTabChange('upload')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Upload className="h-4 w-4" />
              <span>Upload File</span>
            </div>
          </button>
        </div>

        {/* Scanner Area */}
        <div className="p-4">
          {activeTab === 'camera' ? (
            <div className="space-y-4">
              {/* QR Scanner Container */}
              <div id="qr-reader-container" ref={containerRef} className="w-full" />

              {/* Status Messages */}
              {isInitializing && (
                <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                  <span className="text-blue-700">Initializing camera...</span>
                </div>
              )}
              
              {/* Scanning Status */}
              {isScanning && !error && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center p-4 bg-green-50 rounded-lg">
                    <QrCode className="h-5 w-5 text-green-600 mr-2 animate-pulse" />
                    <div className="text-center">
                      <span className="text-green-700 font-medium">Small QR Scanner Active</span>
                      {scanStartTime && (
                        <p className="text-sm text-green-600 mt-1">
                          Scanning for {Math.floor((Date.now() - scanStartTime) / 1000)}s 
                          {scanAttempts > 1 && ` (Enhanced Mode)`}
                        </p>
                      )}
                      <p className="text-xs text-green-600 mt-1">
                        📏 Optimized for 80-100px QR codes
                      </p>
                    </div>
                  </div>
                  
                  {/* Small QR Tips */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-center">
                      <p className="text-sm font-medium text-blue-700 mb-2">💡 For Small QR Codes:</p>
                      <div className="text-xs text-blue-600 space-y-1">
                        <p>• Hold camera 6-12 inches from QR code</p>
                        <p>• QR should fill 30-50% of camera view</p>
                        <p>• Keep steady for 2-3 seconds</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Diagnostics Toggle */}
                  {diagnostics.length > 0 && (
                    <div className="text-center">
                      <button
                        onClick={() => setShowDiagnostics(!showDiagnostics)}
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        {showDiagnostics ? 'Hide' : 'Show'} Scan Details ({diagnostics.length})
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Diagnostics Panel */}
              {showDiagnostics && diagnostics.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-blue-800">Scan Diagnostics</h4>
                    <button
                      onClick={() => {
                        setDiagnostics([])
                        setShowDiagnostics(false)
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {diagnostics.map((diagnostic, index) => (
                      <div key={index} className="text-xs text-blue-700 py-1 border-b border-blue-100 last:border-0">
                        {diagnostic}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-blue-600">
                    <p>💡 This information helps identify scanning issues</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">Camera Error</p>
                    <p className="mt-1">{error}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          setError(null)
                          setIsScanning(false)
                          setScanStartTime(null)
                          setShowDiagnostics(false)
                          addDiagnostic('🔄 Retrying scanner initialization...')
                          initializeScanner()
                        }}
                        className="text-red-700 underline hover:no-underline"
                      >
                        Retry camera
                      </button>
                      <span className="text-red-600">or</span>
                      <button
                        onClick={() => handleTabChange('upload')}
                        className="text-red-700 underline hover:no-underline"
                      >
                        Switch to file upload
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Instructions */}
              {!error && !isInitializing && !isScanning && (
                <div className="text-center text-sm text-gray-600">
                  <p>QR scanner will start shortly...</p>
                  <p className="mt-1">Position QR code within the camera view</p>
                </div>
              )}
            </div>
          ) : (
            <QRFileScanner
              onScan={(result) => {
                onScan(result)
                onClose()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}