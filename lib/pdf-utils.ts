// PDF processing utilities for QR code extraction
import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist'

// Initialize PDF.js worker with multiple fallbacks
export const initializePDFWorker = () => {
  if (typeof window !== 'undefined') {
    // Try different worker configurations
    const workerSources = [
      // Use local worker file first (most reliable)
      '/pdf.worker.min.js',
      // Use unpkg CDN as fallback
      `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.js`,
      // Use cdnjs as second fallback
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`,
      // Use jsdelivr as third fallback
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.js`
    ]
    
    // Try each worker source
    let workerInitialized = false
    for (const src of workerSources) {
      try {
        GlobalWorkerOptions.workerSrc = src
        console.log(`PDF.js worker initialized with: ${src}`)
        workerInitialized = true
        break
      } catch (error) {
        console.warn(`Failed to initialize PDF worker with ${src}:`, error)
        continue
      }
    }
    
    // If all fail, use inline worker as last resort
    if (!workerInitialized) {
      try {
        // Try to use the worker as a module directly (no external file needed)
        GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString()
        console.log('PDF.js worker initialized with inline module')
      } catch (error) {
        // Final fallback: disable worker
        GlobalWorkerOptions.workerSrc = ''
        console.warn('PDF.js worker disabled, using synchronous processing')
      }
    }
  }
}

// Extract image from PDF with robust error handling
export const extractImageFromPDF = async (file: File): Promise<string | null> => {
  try {
    // Initialize worker if not already done
    if (!GlobalWorkerOptions.workerSrc && typeof window !== 'undefined') {
      initializePDFWorker()
    }
    
    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer()
    
    // Load PDF document with robust configuration
    const loadingTask = getDocument({
      data: arrayBuffer,
      // Configuration for better compatibility
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      // Disable problematic features that might cause issues
      disableFontFace: true,
      disableRange: true,
      disableStream: true,
      // Add CORS proxy for worker if needed
      withCredentials: false,
      // Disable web worker if it's causing issues
      disableWorker: !GlobalWorkerOptions.workerSrc
    })
    
    const pdf = await loadingTask.promise
    
    // Get first page
    const page = await pdf.getPage(1)
    
    // Create ULTRA high-quality viewport for small QR codes
    // Try to get the actual page dimensions first
    const pageViewport = page.getViewport({ scale: 1.0 })
    const pageWidth = pageViewport.width
    const pageHeight = pageViewport.height
    
    // Calculate optimal scale based on page size
    // Aim for at least 3000px on the longest side for small QR codes
    const targetSize = 3000
    const optimalScale = Math.max(
      targetSize / pageWidth,
      targetSize / pageHeight,
      5.0 // Minimum scale of 5x
    )
    
    console.log(`PDF page size: ${pageWidth}x${pageHeight}, using scale: ${optimalScale}`)
    const viewport = page.getViewport({ scale: optimalScale })
    
    // Create canvas
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', {
      alpha: false,
      desynchronized: false,
      willReadFrequently: true
    })
    
    if (!context) {
      throw new Error('Could not create canvas context')
    }
    
    canvas.height = viewport.height
    canvas.width = viewport.width
    
    // Set canvas background to white for better QR detection
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // Enable image smoothing for better quality
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    
    // Render page with maximum quality settings
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      background: 'white',
      renderInteractiveForms: true,
      // Additional quality settings
      intent: 'display' as const,
      annotationMode: 2, // Display all annotations
      imageLayer: true
    }
    
    await page.render(renderContext).promise
    
    // Clean up resources
    page.cleanup()
    await pdf.destroy()
    
    // Convert to high-quality PNG
    const dataURL = canvas.toDataURL('image/png', 1.0)
    
    // Clean up canvas
    canvas.remove()
    
    return dataURL
    
  } catch (error) {
    console.error('Error extracting image from PDF:', error)
    
    // Provide specific error information
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        throw new Error('Invalid or corrupted PDF file. Please ensure the file is a valid PDF.')
      } else if (error.message.includes('worker')) {
        throw new Error('PDF processing worker failed. Try converting the PDF to an image first.')
      } else if (error.message.includes('password')) {
        throw new Error('Password-protected PDFs are not supported.')
      }
    }
    
    throw new Error('Failed to process PDF. Please try converting it to an image (PNG/JPG) first.')
  }
}

// Utility to check if PDF processing is supported
export const isPDFProcessingSupported = (): boolean => {
  if (typeof window === 'undefined') return false
  
  try {
    // Check if canvas is supported
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    return !!context
  } catch {
    return false
  }
}