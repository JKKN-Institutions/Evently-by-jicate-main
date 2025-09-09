'use client'

import { useState, useRef, useEffect } from 'react'

// Dynamic import for html5-qrcode to reduce initial bundle size
const getHtml5QrCode = async () => {
  const { Html5Qrcode } = await import('html5-qrcode')
  return Html5Qrcode
}
import { 
  QrCode, 
  Camera, 
  CameraOff, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Flashlight,
  FlashlightOff,
  RotateCcw,
  Smartphone
} from 'lucide-react'

interface ScanResult {
  success: boolean
  message: string
  scan_result: 'success' | 'already_used' | 'invalid' | 'expired' | 'wrong_event' | 'cancelled'
  ticket_info?: {
    ticket_number: string
    customer_name: string
    customer_email?: string
    event_title?: string
    checked_in_at?: string
  }
}

interface MobileQRScannerProps {
  eventId: string
  eventTitle: string
  onScanResult: (result: ScanResult) => void
}

export default function MobileQRScanner({ eventId, eventTitle, onScanResult }: MobileQRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  const [flashlightOn, setFlashlightOn] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null)
  const [scanCount, setScanCount] = useState(0)
  const scannerRef = useRef<any>(null)

  useEffect(() => {
    // Check camera availability
    const checkCameras = async () => {
      try {
        const Html5Qrcode = await getHtml5QrCode()
        const cameras = await Html5Qrcode.getCameras()
        setHasCamera(cameras.length > 0)
      } catch (error) {
        setHasCamera(false)
      }
    }
    
    checkCameras()

    return () => {
      stopScanning()
    }
  }, [])

  const startScanning = async () => {
    try {
      const Html5Qrcode = await getHtml5QrCode()
      const html5QrCode = new Html5Qrcode("mobile-qr-reader")
      scannerRef.current = html5QrCode

      const config = {
        fps: 10,
        qrbox: { 
          width: Math.min(350, window.innerWidth * 0.85), // Increased from 300 for better detection
          height: Math.min(350, window.innerWidth * 0.85) 
        },
        aspectRatio: 1.0,
        supportedScanTypes: [0, 1] // QR Code and Data Matrix for broader compatibility
      }

      await html5QrCode.start(
        { facingMode },
        config,
        async (decodedText) => {
          await handleScan(decodedText)
          // Don't stop scanning automatically - let user control it
        },
        (errorMessage) => {
          // Ignore common scanning errors
          if (!errorMessage.includes('No QR code found')) {
            console.log('QR scan error:', errorMessage)
          }
        }
      )
      
      setIsScanning(true)
    } catch (error) {
      console.error("Error starting scanner:", error)
      alert("Unable to access camera. Please ensure you've granted camera permissions.")
      setHasCamera(false)
    }
  }

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop()
        .then(() => {
          setIsScanning(false)
          scannerRef.current = null
        })
        .catch(console.error)
    }
  }

  const toggleFlashlight = async () => {
    if (scannerRef.current && isScanning) {
      try {
        const track = scannerRef.current.getRunningTrackCameraCapabilities()
        if (track && 'torch' in track) {
          await (track as any).applyConstraints({
            advanced: [{ torch: !flashlightOn }]
          })
          setFlashlightOn(!flashlightOn)
        }
      } catch (error) {
        console.error('Flashlight not supported:', error)
      }
    }
  }

  const switchCamera = async () => {
    if (isScanning) {
      stopScanning()
      setTimeout(() => {
        setFacingMode(facingMode === 'user' ? 'environment' : 'user')
      }, 500)
    } else {
      setFacingMode(facingMode === 'user' ? 'environment' : 'user')
    }
  }

  const handleScan = async (qrCode: string) => {
    try {
      // Support both encrypted QR codes and simple URL formats
      let apiEndpoint = '/api/tickets/validate'
      let requestBody: any = { qrCode, eventId }

      // Check if it's a simple URL format (like /verify/ticket/TICKET_NUMBER)
      if (qrCode.includes('/verify/ticket/') || qrCode.includes('verify/ticket/')) {
        // Extract ticket number from URL and use verify-simple API
        const ticketNumberMatch = qrCode.match(/verify\/ticket\/([^?&]+)/)
        if (ticketNumberMatch) {
          apiEndpoint = '/api/tickets/verify-simple'
          requestBody = { qrData: qrCode }
        }
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result: ScanResult = await response.json()
      setLastScanResult(result)
      setScanCount(prev => prev + 1)
      onScanResult(result)

      // Provide haptic feedback if available
      if ('vibrate' in navigator) {
        if (result.success) {
          navigator.vibrate([100, 50, 100]) // Success pattern
        } else {
          navigator.vibrate([200, 100, 200, 100, 200]) // Error pattern
        }
      }

    } catch (error) {
      console.error('Error validating ticket:', error)
      const errorResult: ScanResult = {
        success: false,
        message: 'Failed to validate ticket. Please try again.',
        scan_result: 'invalid'
      }
      setLastScanResult(errorResult)
      onScanResult(errorResult)
    }
  }

  const getScanResultIcon = (result: ScanResult) => {
    switch (result.scan_result) {
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case 'already_used':
        return <AlertCircle className="h-8 w-8 text-yellow-500" />
      default:
        return <XCircle className="h-8 w-8 text-red-500" />
    }
  }

  const getScanResultColor = (result: ScanResult) => {
    switch (result.scan_result) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'already_used':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default:
        return 'bg-red-50 border-red-200 text-red-800'
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center gap-3">
          <QrCode className="h-6 w-6" />
          <div>
            <h2 className="font-semibold">QR Scanner</h2>
            <p className="text-sm opacity-90">{eventTitle}</p>
          </div>
        </div>
        {scanCount > 0 && (
          <div className="mt-2 text-sm opacity-90">
            Scanned: {scanCount} tickets
          </div>
        )}
      </div>

      {/* Scanner Area */}
      <div className="relative">
        {hasCamera ? (
          <div className="relative bg-black">
            <div id="mobile-qr-reader" className="w-full"></div>
            
            {/* Scanner Overlay */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-4 border-2 border-white rounded-lg">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded">
                  Position QR code in the frame
                </div>
              </div>
            )}

            {/* Camera Controls */}
            {isScanning && (
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button
                  onClick={toggleFlashlight}
                  className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70"
                >
                  {flashlightOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
                </button>
                <button
                  onClick={switchCamera}
                  className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center">
            <CameraOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Camera not available</p>
            <p className="text-sm text-gray-500">Please ensure camera permissions are granted</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4">
        {hasCamera && (
          <div className="flex gap-3 mb-4">
            {!isScanning ? (
              <button
                onClick={startScanning}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium"
              >
                <Camera className="h-5 w-5" />
                Start Scanning
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 font-medium"
              >
                <CameraOff className="h-5 w-5" />
                Stop Scanning
              </button>
            )}
          </div>
        )}

        {/* Last Scan Result */}
        {lastScanResult && (
          <div className={`p-4 rounded-lg border ${getScanResultColor(lastScanResult)}`}>
            <div className="flex items-start gap-3">
              {getScanResultIcon(lastScanResult)}
              <div className="flex-1 min-w-0">
                <p className="font-medium">{lastScanResult.message}</p>
                {lastScanResult.ticket_info && (
                  <div className="mt-2 text-sm space-y-1">
                    <p><strong>Ticket:</strong> {lastScanResult.ticket_info.ticket_number}</p>
                    <p><strong>Customer:</strong> {lastScanResult.ticket_info.customer_name}</p>
                    {lastScanResult.ticket_info.checked_in_at && (
                      <p><strong>Checked in:</strong> {new Date(lastScanResult.ticket_info.checked_in_at).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <Smartphone className="h-4 w-4" />
            <span>Hold steady and align QR code in frame</span>
          </div>
        </div>
      </div>
    </div>
  )
}
