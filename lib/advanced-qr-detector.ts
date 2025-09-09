// Advanced QR code detector with multiple strategies
import { Html5Qrcode } from 'html5-qrcode'

// Try to extract QR code data using canvas manipulation
export async function extractQRFromCanvas(imageFile: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      const img = new Image()
      img.onload = async () => {
        // Create multiple canvases with different sizes
        const sizes = [
          { width: img.width, height: img.height, scale: 1 },
          { width: img.width * 2, height: img.height * 2, scale: 2 },
          { width: 1000, height: 1000 * (img.height / img.width), scale: 0 },
          { width: 2000, height: 2000 * (img.height / img.width), scale: 0 },
        ]
        
        for (const size of sizes) {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) continue
          
          canvas.width = size.width
          canvas.height = size.height
          
          // Try different rendering modes
          const modes = [
            { smoothing: false, filter: 'none' },
            { smoothing: true, filter: 'contrast(2) brightness(1.2)' },
            { smoothing: false, filter: 'contrast(3) brightness(1)' },
            { smoothing: true, filter: 'saturate(0) contrast(2)' },
          ]
          
          for (const mode of modes) {
            ctx.imageSmoothingEnabled = mode.smoothing
            ctx.filter = mode.filter
            
            // Clear and redraw
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            
            // Convert to blob and try scanning
            const blob = await new Promise<Blob | null>((res) => {
              canvas.toBlob(res, 'image/png', 1.0)
            })
            
            if (blob) {
              const file = new File([blob], 'processed.png', { type: 'image/png' })
              
              try {
                const scanner = new Html5Qrcode('qr-file-scanner-advanced')
                // Try with show image = false to avoid format detection issues
                const result = await scanner.scanFile(file, false)
                console.log(`QR found with size ${size.width}x${size.height}, mode: ${JSON.stringify(mode)}`)
                canvas.remove()
                resolve(result)
                return
              } catch (err) {
                // Continue trying
              }
            }
          }
          
          canvas.remove()
        }
        
        resolve(null)
      }
      
      img.onerror = () => resolve(null)
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(imageFile)
  })
}

// Extract QR by focusing on high-contrast areas
export async function extractQRByContrast(imageFile: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      const img = new Image()
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          resolve(null)
          return
        }
        
        // Use original size first
        canvas.width = img.width
        canvas.height = img.height
        
        ctx.drawImage(img, 0, 0)
        
        // Get image data and find high contrast areas
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        
        // Convert to grayscale and increase contrast
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          
          // Apply threshold for high contrast
          const threshold = 128
          const value = gray > threshold ? 255 : 0
          
          data[i] = value
          data[i + 1] = value
          data[i + 2] = value
        }
        
        ctx.putImageData(imageData, 0, 0)
        
        // Try scanning the processed image
        const blob = await new Promise<Blob | null>((res) => {
          canvas.toBlob(res, 'image/png', 1.0)
        })
        
        if (blob) {
          const file = new File([blob], 'contrast.png', { type: 'image/png' })
          
          try {
            const scanner = new Html5Qrcode('qr-file-scanner-contrast')
            const result = await scanner.scanFile(file, false)
            console.log('QR found with contrast enhancement')
            canvas.remove()
            resolve(result)
            return
          } catch (err) {
            console.log('Contrast scan failed')
          }
        }
        
        canvas.remove()
        resolve(null)
      }
      
      img.onerror = () => resolve(null)
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(imageFile)
  })
}

// Try to detect QR code boundaries and crop
export async function detectAndCropQR(imageFile: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      const img = new Image()
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          resolve(null)
          return
        }
        
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        
        // Find areas with QR-like patterns (alternating black/white)
        const regions = []
        const blockSize = Math.min(50, Math.floor(Math.min(img.width, img.height) / 20))
        
        for (let y = 0; y < img.height - blockSize; y += blockSize / 2) {
          for (let x = 0; x < img.width - blockSize; x += blockSize / 2) {
            let blackCount = 0
            let whiteCount = 0
            
            // Sample the block
            for (let dy = 0; dy < blockSize; dy += 5) {
              for (let dx = 0; dx < blockSize; dx += 5) {
                const idx = ((y + dy) * img.width + (x + dx)) * 4
                const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
                
                if (gray < 128) blackCount++
                else whiteCount++
              }
            }
            
            // QR codes have roughly equal black/white distribution
            const ratio = blackCount / (blackCount + whiteCount)
            if (ratio > 0.3 && ratio < 0.7) {
              regions.push({ x, y, size: blockSize * 3 })
            }
          }
        }
        
        // Try scanning each potential QR region
        for (const region of regions) {
          const cropCanvas = document.createElement('canvas')
          const cropCtx = cropCanvas.getContext('2d')
          
          if (!cropCtx) continue
          
          const size = Math.min(region.size, img.width - region.x, img.height - region.y)
          cropCanvas.width = size
          cropCanvas.height = size
          
          cropCtx.drawImage(
            img,
            region.x, region.y, size, size,
            0, 0, size, size
          )
          
          const blob = await new Promise<Blob | null>((res) => {
            cropCanvas.toBlob(res, 'image/png', 1.0)
          })
          
          if (blob) {
            const file = new File([blob], 'cropped.png', { type: 'image/png' })
            
            try {
              const scanner = new Html5Qrcode('qr-file-scanner-crop')
              const result = await scanner.scanFile(file, false)
              console.log(`QR found in region at ${region.x},${region.y}`)
              cropCanvas.remove()
              canvas.remove()
              resolve(result)
              return
            } catch (err) {
              // Continue
            }
          }
          
          cropCanvas.remove()
        }
        
        canvas.remove()
        resolve(null)
      }
      
      img.onerror = () => resolve(null)
      img.src = e.target?.result as string
    }
    
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(imageFile)
  })
}

// Main advanced QR detection function
export async function advancedQRDetection(imageFile: File): Promise<string | null> {
  console.log('Starting advanced QR detection...')
  
  // Try multiple detection strategies in parallel
  const strategies = [
    { name: 'Canvas Processing', fn: () => extractQRFromCanvas(imageFile) },
    { name: 'Contrast Enhancement', fn: () => extractQRByContrast(imageFile) },
    { name: 'Auto Crop Detection', fn: () => detectAndCropQR(imageFile) },
  ]
  
  // Run all strategies in parallel
  const results = await Promise.allSettled(
    strategies.map(async (strategy) => {
      console.log(`Trying strategy: ${strategy.name}`)
      const result = await strategy.fn()
      if (result) {
        console.log(`Success with strategy: ${strategy.name}`)
        return result
      }
      return null
    })
  )
  
  // Return the first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return result.value
    }
  }
  
  console.log('All advanced detection strategies failed')
  return null
}