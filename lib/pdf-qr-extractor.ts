// Specialized PDF QR extractor for specific positions
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { Html5Qrcode } from 'html5-qrcode'

interface QRPosition {
  x: number
  y: number
  size: number
}

// Known QR code positions in PDFs (in PDF coordinates)
const KNOWN_QR_POSITIONS: QRPosition[] = [
  { x: 40, y: 275, size: 50 },  // Your specific QR position
  { x: 40, y: 40, size: 100 },   // Top-left corner
  { x: 500, y: 40, size: 100 },  // Top-right corner (assuming ~600px width)
  { x: 40, y: 750, size: 100 },  // Bottom-left corner (assuming ~850px height)
  { x: 500, y: 750, size: 100 }, // Bottom-right corner
]

// Extract QR from specific position with high precision
export async function extractQRFromPosition(
  pdfFile: File, 
  position: QRPosition = KNOWN_QR_POSITIONS[0]
): Promise<string | null> {
  try {
    console.log(`Extracting QR from position: X:${position.x}, Y:${position.y}, Size:${position.size}`)
    
    // Convert file to array buffer
    const arrayBuffer = await pdfFile.arrayBuffer()
    
    // Load PDF document
    const loadingTask = getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      disableRange: true,
      disableStream: true,
      disableWorker: !GlobalWorkerOptions.workerSrc
    })
    
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(1)
    
    // Get page dimensions
    const viewport = page.getViewport({ scale: 1.0 })
    const pageWidth = viewport.width
    const pageHeight = viewport.height
    
    console.log(`PDF Page dimensions: ${pageWidth}x${pageHeight}`)
    
    // Calculate scale to ensure QR code is at least 300px for good scanning
    // Since the QR is 50 units, we want it to be at least 300px
    const minQRPixelSize = 300
    const requiredScale = Math.max(minQRPixelSize / position.size, 6.0)
    
    console.log(`Using scale: ${requiredScale} to render QR at ${position.size * requiredScale}px`)
    
    // Create high-res viewport
    const scaledViewport = page.getViewport({ scale: requiredScale })
    
    // Create canvas for full page (we'll crop later)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true
    })
    
    if (!context) {
      throw new Error('Could not create canvas context')
    }
    
    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height
    
    // White background
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // Render the page
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
      background: 'white',
      renderInteractiveForms: true,
      intent: 'display' as const
    }).promise
    
    // Now extract the QR code region
    // PDF coordinates: origin is bottom-left
    // Canvas coordinates: origin is top-left
    // So we need to convert Y coordinate
    const qrX = position.x * requiredScale
    const qrY = (pageHeight - position.y - position.size) * requiredScale // Flip Y coordinate
    const qrSize = position.size * requiredScale
    
    // Add padding around the QR code (20% on each side)
    const padding = qrSize * 0.2
    const extractX = Math.max(0, qrX - padding)
    const extractY = Math.max(0, qrY - padding)
    const extractSize = qrSize + (padding * 2)
    
    console.log(`Extracting region: X:${extractX}, Y:${extractY}, Size:${extractSize}`)
    
    // Create a new canvas for the QR region
    const qrCanvas = document.createElement('canvas')
    const qrContext = qrCanvas.getContext('2d')
    
    if (!qrContext) {
      throw new Error('Could not create QR canvas context')
    }
    
    qrCanvas.width = extractSize
    qrCanvas.height = extractSize
    
    // Copy the QR region
    qrContext.drawImage(
      canvas,
      extractX, extractY, extractSize, extractSize,
      0, 0, extractSize, extractSize
    )
    
    // Try multiple image processing techniques on the extracted region
    const results = await tryMultipleProcessing(qrCanvas, qrContext)
    
    // Clean up
    page.cleanup()
    await pdf.destroy()
    canvas.remove()
    qrCanvas.remove()
    
    return results
    
  } catch (error) {
    console.error('Error extracting QR from position:', error)
    return null
  }
}

// Try multiple processing techniques on the QR region
async function tryMultipleProcessing(
  canvas: HTMLCanvasElement, 
  context: CanvasRenderingContext2D
): Promise<string | null> {
  
  const techniques = [
    { name: 'original', process: () => {} },
    { name: 'high-contrast', process: () => {
      context.filter = 'contrast(2) brightness(1.1)'
      context.drawImage(canvas, 0, 0)
    }},
    { name: 'threshold', process: () => {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      
      // Apply binary threshold
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        const value = gray > 128 ? 255 : 0
        data[i] = data[i + 1] = data[i + 2] = value
      }
      
      context.putImageData(imageData, 0, 0)
    }},
    { name: 'adaptive-threshold', process: () => {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const width = canvas.width
      
      // Adaptive threshold with local area
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4
          const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
          
          // Calculate local average (5x5 window)
          let sum = 0
          let count = 0
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const ny = y + dy
              const nx = x + dx
              if (ny >= 0 && ny < canvas.height && nx >= 0 && nx < width) {
                const nidx = (ny * width + nx) * 4
                sum += data[nidx] * 0.299 + data[nidx + 1] * 0.587 + data[nidx + 2] * 0.114
                count++
              }
            }
          }
          
          const localAvg = sum / count
          const value = gray > localAvg * 0.9 ? 255 : 0
          data[idx] = data[idx + 1] = data[idx + 2] = value
        }
      }
      
      context.putImageData(imageData, 0, 0)
    }}
  ]
  
  for (const technique of techniques) {
    console.log(`Trying QR extraction with: ${technique.name}`)
    
    // Apply processing
    technique.process()
    
    // Convert to blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1.0)
    })
    
    if (blob) {
      const file = new File([blob], `qr-${technique.name}.png`, { type: 'image/png' })
      
      try {
        const scanner = new Html5Qrcode('qr-file-scanner-position')
        const result = await scanner.scanFile(file, false)
        console.log(`QR code found with ${technique.name} processing:`, result)
        return result
      } catch (err) {
        console.log(`No QR found with ${technique.name}`)
      }
    }
  }
  
  return null
}

// Extract QR codes from all known positions
export async function extractQRFromAllPositions(pdfFile: File): Promise<string | null> {
  console.log('Trying all known QR positions...')
  
  for (const position of KNOWN_QR_POSITIONS) {
    const result = await extractQRFromPosition(pdfFile, position)
    if (result) {
      console.log(`QR found at position X:${position.x}, Y:${position.y}`)
      return result
    }
  }
  
  console.log('No QR found in any known position')
  return null
}

// Extract and visualize QR regions for debugging
export async function visualizeQRRegions(pdfFile: File): Promise<string> {
  try {
    const arrayBuffer = await pdfFile.arrayBuffer()
    
    const loadingTask = getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      disableWorker: !GlobalWorkerOptions.workerSrc
    })
    
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(1)
    
    const scale = 2.0
    const viewport = page.getViewport({ scale })
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) throw new Error('Could not create canvas context')
    
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    // Render the page
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      background: 'white'
    }).promise
    
    // Draw rectangles around known QR positions
    context.strokeStyle = 'red'
    context.lineWidth = 3
    
    const pageHeight = viewport.height / scale
    
    for (const pos of KNOWN_QR_POSITIONS) {
      const x = pos.x * scale
      const y = (pageHeight - pos.y - pos.size) * scale
      const size = pos.size * scale
      
      context.strokeRect(x, y, size, size)
      
      // Add label
      context.fillStyle = 'red'
      context.font = '12px Arial'
      context.fillText(`QR ${pos.x},${pos.y}`, x, y - 5)
    }
    
    const dataUrl = canvas.toDataURL('image/png', 1.0)
    
    // Clean up
    page.cleanup()
    await pdf.destroy()
    canvas.remove()
    
    return dataUrl
    
  } catch (error) {
    console.error('Error visualizing QR regions:', error)
    throw error
  }
}