'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Camera, AlertCircle, Upload, Loader2, QrCode, ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react'
import QRFileScanner from './qr-file-scanner'
import { validateQRSize } from '@/lib/qr-generator'
import { SMALL_QR_CONFIG, ULTRA_SMALL_QR_CONFIG, getOptimalCamera, SMALL_QR_TIPS } from '@/lib/small-qr-scanner'

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
        // Alternative ULTRA-HIGH DETAIL configuration for extremely small QR codes
        await html5QrCode.start(
          cameraId,
          {
            fps: 60, // Maximum FPS for real-time detection
            qrbox: function(viewfinderWidth, viewfinderHeight) {
              // Full screen scan area for maximum coverage
              let minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
              let qrboxSize = Math.floor(minEdgeSize * 0.9) // Nearly full screen
              return {
                width: qrboxSize,
                height: qrboxSize
              }
            },
            aspectRatio: 1.0,
            disableFlip: false,
            formatsToSupport: [0], // QR codes only
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true,
              // Additional experimental features for better detection
              decodingAnalyticsEnabled: true,
              multiCodeDetectionEnabled: true // Detect multiple QRs simultaneously
            },
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
            videoConstraints: {
              facingMode: 'environment',
              // Maximum possible resolution for microscopic detail
              width: { min: 2560, ideal: 4096, max: 7680 },
              height: { min: 1440, ideal: 2304, max: 4320 },
              frameRate: { min: 30, ideal: 60, max: 120 },
              // Ultra-aggressive camera settings for tiny QRs
              advanced: [
                {
                  // Super close macro focus
                  focusMode: 'continuous',
                  focusDistance: { min: 0.01, ideal: 0.1, max: 0.5 }
                },
                {
                  // Maximum digital zoom
                  zoom: { min: 2, ideal: 3, max: 5 }
                },
                {
                  // HDR mode if available
                  exposureMode: 'continuous',
                  hdr: true
                },
                {
                  // Maximum sharpness and detail
                  sharpness: { ideal: 100 },
                  saturation: { ideal: 100 },
                  contrast: { ideal: 100 }
                },
                {
                  // Noise reduction for cleaner image
                  noiseSuppression: true,
                  autoGainControl: true
                }
              ]
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

      // Enhanced scanning configuration optimized for SMALL printed QR codes (80-100px)
      await html5QrCode.start(
        cameraId,
        {
          fps: 30,  // Maximum FPS for rapid detection of small QRs
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            // Dynamic scan box that's optimal for small QR codes
            let minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
            // Larger scan area (60-70%) to capture small QRs from various distances
            let qrboxSize = Math.floor(minEdgeSize * 0.65) // Increased for better small QR coverage
            return {
              width: qrboxSize,
              height: qrboxSize
            }
          },
          aspectRatio: 1.0, // Square aspect for QR codes
          disableFlip: false,
          formatsToSupport: [0], // Focus only on QR codes for better performance
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true // Use native API if available
          },
          videoConstraints: {
            facingMode: 'environment',
            // Ultra-high resolution for capturing small QR details
            width: { min: 1920, ideal: 2560, max: 4096 },
            height: { min: 1080, ideal: 1440, max: 2304 },
            frameRate: { min: 15, ideal: 30, max: 60 },
            // Advanced camera constraints for small QR detection
            advanced: [
              { 
                // Macro focus for close-up scanning
                focusMode: 'continuous',
                focusDistance: { ideal: 0.15, min: 0.05, max: 1.0 } // Very close focus
              },
              { 
                // High zoom for small QRs
                zoom: { min: 1, ideal: 2, max: 4 } 
              },
              {
                // Optimal exposure for printed QRs
                exposureMode: 'continuous',
                exposureCompensation: { min: -2, ideal: 0, max: 2 }
              },
              {
                // Better white balance for printed materials
                whiteBalanceMode: 'continuous'
              },
              {
                // ISO settings for better low-light performance
                iso: { min: 100, ideal: 400, max: 1600 }
              },
              {
                // Sharpness for small details
                sharpness: { min: 0, ideal: 100, max: 100 }
              },
              {
                // Contrast for better QR definition
                contrast: { min: 0, ideal: 80, max: 100 }
              }
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
                  
                  {/* Enhanced Small QR Tips with visual guide */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="h-5 w-5 text-blue-600" />
                      <p className="text-sm font-semibold text-blue-800">Optimized for Small Printed QR Codes</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">📏</span>
                          <div>
                            <p className="font-medium text-blue-700">Distance</p>
                            <p className="text-blue-600">6-12 inches (15-30cm)</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">🎯</span>
                          <div>
                            <p className="font-medium text-blue-700">Positioning</p>
                            <p className="text-blue-600">Center QR in frame</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">💡</span>
                          <div>
                            <p className="font-medium text-blue-700">Lighting</p>
                            <p className="text-blue-600">Bright, even light</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">⏱️</span>
                          <div>
                            <p className="font-medium text-blue-700">Hold Time</p>
                            <p className="text-blue-600">2-3 seconds steady</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Visual size guide */}
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-center">
                          <div className="w-12 h-12 border-2 border-red-400 rounded flex items-center justify-center">
                            <div className="w-3 h-3 bg-black"></div>
                          </div>
                          <p className="text-xs text-red-600 mt-1">Too Small</p>
                        </div>
                        <div className="text-center">
                          <div className="w-12 h-12 border-2 border-green-400 rounded flex items-center justify-center">
                            <div className="w-6 h-6 bg-black"></div>
                          </div>
                          <p className="text-xs text-green-600 mt-1">Perfect</p>
                        </div>
                        <div className="text-center">
                          <div className="w-12 h-12 border-2 border-red-400 rounded flex items-center justify-center">
                            <div className="w-10 h-10 bg-black"></div>
                          </div>
                          <p className="text-xs text-red-600 mt-1">Too Large</p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 text-center mt-2">QR should fill 30-50% of camera view</p>
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