// Enhanced QR scanner for detecting small QR codes in corners
import { Html5Qrcode, Html5QrcodeResult } from 'html5-qrcode'
import { advancedQRDetection } from './advanced-qr-detector'
import { extractQRFromAllPositions } from './pdf-qr-extractor'

interface ScanRegion {
  x: number
  y: number
  width: number
  height: number
  name: string
}

// Enhanced scanning with image preprocessing
export const enhancedQRScan = async (imageFile: File): Promise<string | null> => {
  try {
    // First attempt: scan the full image with enhanced settings
    console.log('Starting enhanced QR scan...')
    
    // Try with verbose mode first
    try {
      const scanner = new Html5Qrcode('qr-file-scanner', {
        verbose: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      } as any)
      
      const result = await scanner.scanFile(imageFile, true)
      console.log('QR code found in full scan:', result)
      return result
    } catch (fullScanError: any) {
      console.log('Full scan failed:', fullScanError?.message || fullScanError)
      
      // Check if it's a "No MultiFormat Readers" error
      if (fullScanError?.message?.includes('No MultiFormat Readers')) {
        console.log('QR code format not recognized, trying with different settings...')
      }
    }
    
    // If full scan fails, try scanning specific regions
    const regions = await scanRegions(imageFile)
    if (regions) {
      return regions
    }
    
    // Try with image enhancement
    const enhancedResult = await scanWithEnhancement(imageFile)
    if (enhancedResult) {
      return enhancedResult
    }
    
    // Try advanced detection methods as last resort
    console.log('Trying advanced QR detection methods...')
    const advancedResult = await advancedQRDetection(imageFile)
    if (advancedResult) {
      return advancedResult
    }
    
    return null
  } catch (error) {
    console.error('Enhanced QR scan error:', error)
    return null
  }
}

// Scan specific regions where QR codes are commonly placed
async function scanRegions(imageFile: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const reader = new FileReader()
    
    reader.onload = (e) => {
      img.onload = async () => {
        const regions: ScanRegion[] = [
          // Top-left corner
          { x: 0, y: 0, width: img.width * 0.3, height: img.height * 0.3, name: 'top-left' },
          // Top-right corner
          { x: img.width * 0.7, y: 0, width: img.width * 0.3, height: img.height * 0.3, name: 'top-right' },
          // Bottom-left corner
          { x: 0, y: img.height * 0.7, width: img.width * 0.3, height: img.height * 0.3, name: 'bottom-left' },
          // Bottom-right corner
          { x: img.width * 0.7, y: img.height * 0.7, width: img.width * 0.3, height: img.height * 0.3, name: 'bottom-right' },
          // Center
          { x: img.width * 0.35, y: img.height * 0.35, width: img.width * 0.3, height: img.height * 0.3, name: 'center' },
          // Full top section
          { x: 0, y: 0, width: img.width, height: img.height * 0.4, name: 'top-section' },
          // Full bottom section
          { x: 0, y: img.height * 0.6, width: img.width, height: img.height * 0.4, name: 'bottom-section' }
        ]
        
        for (const region of regions) {
          console.log(`Scanning region: ${region.name}`)
          const croppedImage = await cropImageRegion(img, region)
          
          if (croppedImage) {
            try {
              const scanner = new Html5Qrcode('qr-file-scanner')
              const result = await scanner.scanFile(croppedImage, false)
              console.log(`QR code found in ${region.name}:`, result)
              resolve(result)
              return
            } catch (regionError) {
              console.log(`No QR in ${region.name}`)
            }
          }
        }
        
        resolve(null)
      }
      
      img.src = e.target?.result as string
    }
    
    reader.readAsDataURL(imageFile)
  })
}

// Crop a specific region from an image
async function cropImageRegion(img: HTMLImageElement, region: ScanRegion): Promise<File | null> {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return null
    
    canvas.width = region.width
    canvas.height = region.height
    
    ctx.drawImage(
      img,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    )
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], 'region.png', { type: 'image/png' }))
        } else {
          resolve(null)
        }
      }, 'image/png', 1.0)
    })
  } catch (error) {
    console.error('Error cropping region:', error)
    return null
  }
}

// Apply image enhancement techniques
async function scanWithEnhancement(imageFile: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const reader = new FileReader()
    
    reader.onload = (e) => {
      img.onload = async () => {
        // Try different enhancement techniques
        const enhancements = [
          { contrast: 1.5, brightness: 1.2, name: 'high-contrast' },
          { contrast: 2.0, brightness: 1.0, name: 'extra-contrast' },
          { contrast: 1.0, brightness: 1.5, name: 'bright' },
          { contrast: 1.2, brightness: 0.8, name: 'dark-adjusted' },
          { invert: true, name: 'inverted' },
          { sharpen: true, name: 'sharpened' }
        ]
        
        for (const enhancement of enhancements) {
          console.log(`Trying enhancement: ${enhancement.name}`)
          const enhancedImage = await applyEnhancement(img, enhancement)
          
          if (enhancedImage) {
            try {
              const scanner = new Html5Qrcode('qr-file-scanner')
              const result = await scanner.scanFile(enhancedImage, false)
              console.log(`QR code found with ${enhancement.name}:`, result)
              resolve(result)
              return
            } catch (enhanceError) {
              console.log(`No QR with ${enhancement.name}`)
            }
          }
        }
        
        resolve(null)
      }
      
      img.src = e.target?.result as string
    }
    
    reader.readAsDataURL(imageFile)
  })
}

// Apply image enhancement
async function applyEnhancement(img: HTMLImageElement, options: any): Promise<File | null> {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return null
    
    canvas.width = img.width
    canvas.height = img.height
    
    // Apply filters
    if (options.invert) {
      ctx.filter = 'invert(1)'
    } else if (options.contrast || options.brightness) {
      const contrast = options.contrast || 1
      const brightness = options.brightness || 1
      ctx.filter = `contrast(${contrast}) brightness(${brightness})`
    } else if (options.sharpen) {
      ctx.filter = 'contrast(1.3) brightness(1.1)'
    }
    
    ctx.drawImage(img, 0, 0)
    
    // Additional sharpening if requested
    if (options.sharpen) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const sharpened = sharpenImage(imageData)
      ctx.putImageData(sharpened, 0, 0)
    }
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], 'enhanced.png', { type: 'image/png' }))
        } else {
          resolve(null)
        }
      }, 'image/png', 1.0)
    })
  } catch (error) {
    console.error('Error applying enhancement:', error)
    return null
  }
}

// Sharpen image data
function sharpenImage(imageData: ImageData): ImageData {
  const weights = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ]
  
  const side = Math.round(Math.sqrt(weights.length))
  const halfSide = Math.floor(side / 2)
  
  const src = imageData.data
  const sw = imageData.width
  const sh = imageData.height
  const w = sw
  const h = sh
  const output = new ImageData(w, h)
  const dst = output.data
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sy = y
      const sx = x
      const dstOff = (y * w + x) * 4
      let r = 0, g = 0, b = 0
      
      for (let cy = 0; cy < side; cy++) {
        for (let cx = 0; cx < side; cx++) {
          const scy = sy + cy - halfSide
          const scx = sx + cx - halfSide
          
          if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
            const srcOff = (scy * sw + scx) * 4
            const wt = weights[cy * side + cx]
            
            r += src[srcOff] * wt
            g += src[srcOff + 1] * wt
            b += src[srcOff + 2] * wt
          }
        }
      }
      
      dst[dstOff] = Math.min(255, Math.max(0, r))
      dst[dstOff + 1] = Math.min(255, Math.max(0, g))
      dst[dstOff + 2] = Math.min(255, Math.max(0, b))
      dst[dstOff + 3] = 255
    }
  }
  
  return output
}