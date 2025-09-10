// Enhanced QR Scanner Utility for Small Printed QR Codes (80-100px)
// This module provides optimized settings and image processing for detecting tiny QR codes

import { Html5Qrcode, Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode'

// Optimal scanner configuration for small QR codes
export const SMALL_QR_CONFIG = {
  // Maximum FPS for rapid detection
  fps: 30,
  
  // QR box configuration - larger area to capture small QRs at various distances
  qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
    const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
    const qrboxSize = Math.floor(minEdgeSize * 0.7) // 70% of viewport
    return {
      width: qrboxSize,
      height: qrboxSize
    }
  },
  
  // Square aspect ratio optimal for QR codes
  aspectRatio: 1.0,
  
  // Focus only on QR codes for better performance
  formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
  
  // Experimental features for better detection
  experimentalFeatures: {
    useBarCodeDetectorIfSupported: true,
    decodingAnalyticsEnabled: true,
    multiCodeDetectionEnabled: false // Focus on single QR for speed
  },
  
  // Remember camera selection
  rememberLastUsedCamera: true,
  
  // Show torch button on mobile
  showTorchButtonIfSupported: true,
  
  // Disable verbose mode for production
  verbose: false,
  
  // Video constraints optimized for small QR detection
  videoConstraints: {
    facingMode: 'environment',
    
    // Ultra-high resolution for capturing tiny details
    width: { 
      min: 1920, 
      ideal: 2560, 
      max: 4096 
    },
    height: { 
      min: 1080, 
      ideal: 1440, 
      max: 2304 
    },
    
    // High frame rate for smooth scanning
    frameRate: { 
      min: 20, 
      ideal: 30, 
      max: 60 
    },
    
    // Advanced camera constraints
    advanced: [
      {
        // Macro focus for close-up scanning
        focusMode: 'continuous',
        focusDistance: { 
          min: 0.05,  // 5cm minimum
          ideal: 0.15, // 15cm ideal (typical scanning distance)
          max: 0.5    // 50cm maximum
        }
      },
      {
        // Digital zoom to magnify small QRs
        zoom: { 
          min: 1, 
          ideal: 2, 
          max: 3 
        }
      },
      {
        // Optimal exposure for printed materials
        exposureMode: 'continuous',
        exposureCompensation: { 
          min: -2, 
          ideal: 0, 
          max: 2 
        }
      },
      {
        // White balance for paper
        whiteBalanceMode: 'continuous'
      },
      {
        // ISO for various lighting conditions
        iso: { 
          min: 100, 
          ideal: 400, 
          max: 1600 
        }
      },
      {
        // Maximum sharpness for detail
        sharpness: { 
          min: 50, 
          ideal: 100, 
          max: 100 
        }
      },
      {
        // High contrast for QR definition
        contrast: { 
          min: 50, 
          ideal: 85, 
          max: 100 
        }
      },
      {
        // Moderate saturation
        saturation: { 
          min: 50, 
          ideal: 75, 
          max: 100 
        }
      },
      {
        // Noise reduction
        noiseSuppression: true,
        autoGainControl: true
      }
    ]
  }
}

// Ultra-high detail configuration for extremely small QRs
export const ULTRA_SMALL_QR_CONFIG = {
  ...SMALL_QR_CONFIG,
  fps: 60, // Maximum FPS
  
  qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
    const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
    const qrboxSize = Math.floor(minEdgeSize * 0.85) // 85% of viewport
    return {
      width: qrboxSize,
      height: qrboxSize
    }
  },
  
  experimentalFeatures: {
    useBarCodeDetectorIfSupported: true,
    decodingAnalyticsEnabled: true,
    multiCodeDetectionEnabled: true // Try to detect multiple QRs
  },
  
  videoConstraints: {
    ...SMALL_QR_CONFIG.videoConstraints,
    
    // Maximum possible resolution
    width: { 
      min: 2560, 
      ideal: 4096, 
      max: 7680 
    },
    height: { 
      min: 1440, 
      ideal: 2304, 
      max: 4320 
    },
    
    // Maximum frame rate
    frameRate: { 
      min: 30, 
      ideal: 60, 
      max: 120 
    },
    
    advanced: [
      {
        // Super close macro focus
        focusMode: 'continuous',
        focusDistance: { 
          min: 0.01,  // 1cm minimum
          ideal: 0.1,  // 10cm ideal
          max: 0.3     // 30cm maximum
        }
      },
      {
        // Maximum digital zoom
        zoom: { 
          min: 2, 
          ideal: 3, 
          max: 5 
        }
      },
      {
        // HDR if available
        hdr: true,
        exposureMode: 'continuous'
      },
      {
        // Maximum image enhancement
        sharpness: { ideal: 100 },
        contrast: { ideal: 100 },
        saturation: { ideal: 100 }
      },
      {
        // Advanced noise reduction
        noiseSuppression: true,
        autoGainControl: true,
        echoCancellation: false
      }
    ]
  }
}

// Helper function to create scanner with optimal settings
export function createSmallQRScanner(
  elementId: string,
  useUltraMode: boolean = false
): Html5Qrcode {
  const config = useUltraMode ? ULTRA_SMALL_QR_CONFIG : SMALL_QR_CONFIG
  
  return new Html5Qrcode(elementId, {
    verbose: false,
    experimentalFeatures: config.experimentalFeatures
  } as any)
}

// Helper to get optimal camera for QR scanning
export async function getOptimalCamera(): Promise<string | null> {
  try {
    const cameras = await Html5Qrcode.getCameras()
    
    if (!cameras || cameras.length === 0) {
      return null
    }
    
    // Prefer back/rear camera
    const backCamera = cameras.find(camera => {
      const label = camera.label.toLowerCase()
      return label.includes('back') || 
             label.includes('rear') || 
             label.includes('environment') ||
             label.includes('facing back')
    })
    
    // If no back camera, try to find main camera
    const mainCamera = backCamera || cameras.find(camera => {
      const label = camera.label.toLowerCase()
      return label.includes('main') || 
             label.includes('wide') ||
             !label.includes('front')
    })
    
    return mainCamera?.id || cameras[0].id
  } catch (error) {
    console.error('Error getting cameras:', error)
    return null
  }
}

// Scanning tips for small QR codes
export const SMALL_QR_TIPS = [
  'Hold camera 6-12 inches (15-30cm) from QR code',
  'Ensure QR code fills 30-50% of camera view',
  'Use good, even lighting - avoid shadows',
  'Keep camera steady for 2-3 seconds',
  'Try different angles if initial scan fails',
  'Clean camera lens if image appears blurry',
  'For very small QRs, try moving closer slowly',
  'Enable flashlight/torch in low light conditions'
]

// Error messages and solutions
export const SMALL_QR_ERROR_SOLUTIONS = {
  'NotFoundException': {
    message: 'QR code not detected',
    solutions: [
      'Move camera closer to QR code',
      'Ensure entire QR code is visible',
      'Improve lighting conditions',
      'Hold camera steady'
    ]
  },
  'NotAllowedError': {
    message: 'Camera permission denied',
    solutions: [
      'Allow camera access in browser settings',
      'Refresh page and grant permission',
      'Check site permissions in browser'
    ]
  },
  'NotReadableError': {
    message: 'Camera is busy or unavailable',
    solutions: [
      'Close other apps using camera',
      'Restart browser',
      'Check if camera is working in other apps'
    ]
  },
  'OverconstrainedError': {
    message: 'Camera settings not supported',
    solutions: [
      'Scanner will use default settings',
      'Try different browser',
      'Update browser to latest version'
    ]
  }
}

// Image preprocessing for file upload scanning
export async function preprocessImageForSmallQR(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        
        // Set canvas size (upscale if image is small)
        const minSize = 1500
        const scale = Math.max(minSize / img.width, minSize / img.height, 1)
        
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        
        // Apply image enhancements
        ctx.filter = 'contrast(1.3) brightness(1.1) saturate(0.8)'
        ctx.imageSmoothingEnabled = false // Preserve sharp edges
        ctx.imageSmoothingQuality = 'high'
        
        // Draw scaled image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], 'processed.png', { type: 'image/png' }))
          } else {
            reject(new Error('Could not create blob'))
          }
        }, 'image/png', 1.0)
      }
      
      img.onerror = () => reject(new Error('Could not load image'))
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

// Export all configurations and utilities
export default {
  SMALL_QR_CONFIG,
  ULTRA_SMALL_QR_CONFIG,
  createSmallQRScanner,
  getOptimalCamera,
  SMALL_QR_TIPS,
  SMALL_QR_ERROR_SOLUTIONS,
  preprocessImageForSmallQR
}