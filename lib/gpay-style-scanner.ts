import { Html5Qrcode, Html5QrcodeScannerState, QrcodeSuccessCallback, QrcodeErrorCallback } from 'html5-qrcode'

export interface ScannerConfig {
  fps: number
  qrbox?: any
  aspectRatio?: number
  disableFlip?: boolean
  experimentalFeatures?: {
    useBarCodeDetectorIfSupported?: boolean
  }
  formatsToSupport?: any[]
  rememberLastUsedCamera?: boolean
  supportedScanTypes?: any[]
}

export interface AutoZoomConfig {
  enabled: boolean
  minZoom: number
  maxZoom: number
  zoomStep: number
  autoZoomDelay: number
  targetQRSizePercent: number
}

export class GPayStyleScanner {
  private scanner: Html5Qrcode | null = null
  private cameraId: string | null = null
  private isScanning: boolean = false
  private zoomLevel: number = 1
  private autoZoomTimer: NodeJS.Timeout | null = null
  private detectionCount: number = 0
  private lastDetectedSize: number = 0
  private videoElement: HTMLVideoElement | null = null
  private canvasElement: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private animationFrame: number | null = null
  private onQRDetected: ((data: string) => void) | null = null
  private onStateChange: ((state: string) => void) | null = null
  private successSound: HTMLAudioElement | null = null
  private focusSound: HTMLAudioElement | null = null

  constructor(elementId: string) {
    this.scanner = new Html5Qrcode(elementId, {
      verbose: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    } as any)
    
    // Initialize audio feedback
    this.initializeAudio()
  }

  private initializeAudio() {
    // Create success sound (simple beep)
    this.successSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSiK0fPTgjMGHm7A7+OZURE')
    this.successSound.volume = 0.5
    
    // Create focus sound (softer beep)
    this.focusSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSiK0fPTgjMGHm7A7+OZURE')
    this.focusSound.volume = 0.2
  }

  async start(
    onSuccess: (data: string) => void,
    onError?: (error: string) => void,
    onStateChange?: (state: string) => void
  ): Promise<void> {
    this.onQRDetected = onSuccess
    this.onStateChange = onStateChange
    
    try {
      // Get the best camera
      const cameras = await Html5Qrcode.getCameras()
      if (!cameras || cameras.length === 0) {
        throw new Error('No cameras found')
      }
      
      // Prefer back camera for mobile devices
      const backCamera = cameras.find(camera => 
        camera.label.toLowerCase().includes('back') ||
        camera.label.toLowerCase().includes('rear') ||
        camera.label.toLowerCase().includes('environment')
      )
      
      this.cameraId = backCamera ? backCamera.id : cameras[0].id
      
      // Start with enhanced configuration
      const config: ScannerConfig = {
        fps: 30,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
          const size = Math.floor(minEdge * 0.75)
          return { width: size, height: size }
        },
        aspectRatio: 1.0,
        disableFlip: false,
        rememberLastUsedCamera: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      }
      
      await this.scanner!.start(
        this.cameraId,
        config,
        this.handleQRCodeSuccess.bind(this),
        this.handleQRCodeError.bind(this)
      )
      
      this.isScanning = true
      this.onStateChange?.('scanning')
      
      // Get video element for advanced features
      this.setupVideoProcessing()
      
      // Start auto-zoom detection
      this.startAutoZoom()
      
    } catch (error) {
      console.error('Failed to start scanner:', error)
      onError?.(error instanceof Error ? error.message : 'Failed to start scanner')
      this.onStateChange?.('error')
    }
  }

  private setupVideoProcessing() {
    // Get the video element created by Html5Qrcode
    const videoElements = document.getElementsByTagName('video')
    for (let i = 0; i < videoElements.length; i++) {
      if (videoElements[i].srcObject) {
        this.videoElement = videoElements[i]
        break
      }
    }
    
    if (this.videoElement) {
      // Create canvas for processing
      this.canvasElement = document.createElement('canvas')
      this.ctx = this.canvasElement.getContext('2d')
      
      // Start processing frames
      this.processFrame()
    }
  }

  private processFrame() {
    if (!this.videoElement || !this.ctx || !this.canvasElement || !this.isScanning) {
      return
    }
    
    // Set canvas size to match video
    this.canvasElement.width = this.videoElement.videoWidth
    this.canvasElement.height = this.videoElement.videoHeight
    
    // Draw current frame
    this.ctx.drawImage(this.videoElement, 0, 0)
    
    // Analyze frame for QR code presence and size
    this.analyzeFrame()
    
    // Continue processing
    this.animationFrame = requestAnimationFrame(() => this.processFrame())
  }

  private analyzeFrame() {
    if (!this.ctx || !this.canvasElement) return
    
    // Get image data
    const imageData = this.ctx.getImageData(
      0, 0, 
      this.canvasElement.width, 
      this.canvasElement.height
    )
    
    // Simple edge detection to find QR code boundaries
    const edges = this.detectEdges(imageData)
    
    // Find QR code patterns
    const qrSize = this.detectQRCodeSize(edges)
    
    if (qrSize > 0) {
      this.lastDetectedSize = qrSize
      this.detectionCount++
      
      // Trigger focus sound on first detection
      if (this.detectionCount === 1) {
        this.playFocusSound()
        this.onStateChange?.('focusing')
      }
      
      // Auto-zoom logic
      this.adjustZoom(qrSize)
    } else {
      this.detectionCount = 0
    }
  }

  private detectEdges(imageData: ImageData): Uint8ClampedArray {
    const width = imageData.width
    const height = imageData.height
    const data = imageData.data
    const edges = new Uint8ClampedArray(width * height)
    
    // Simple Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4
        
        // Convert to grayscale
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        
        // Calculate gradients
        const gx = (
          -1 * this.getPixelGray(data, x - 1, y - 1, width) +
          -2 * this.getPixelGray(data, x - 1, y, width) +
          -1 * this.getPixelGray(data, x - 1, y + 1, width) +
          1 * this.getPixelGray(data, x + 1, y - 1, width) +
          2 * this.getPixelGray(data, x + 1, y, width) +
          1 * this.getPixelGray(data, x + 1, y + 1, width)
        )
        
        const gy = (
          -1 * this.getPixelGray(data, x - 1, y - 1, width) +
          -2 * this.getPixelGray(data, x, y - 1, width) +
          -1 * this.getPixelGray(data, x + 1, y - 1, width) +
          1 * this.getPixelGray(data, x - 1, y + 1, width) +
          2 * this.getPixelGray(data, x, y + 1, width) +
          1 * this.getPixelGray(data, x + 1, y + 1, width)
        )
        
        const magnitude = Math.sqrt(gx * gx + gy * gy)
        edges[y * width + x] = magnitude > 128 ? 255 : 0
      }
    }
    
    return edges
  }

  private getPixelGray(data: Uint8ClampedArray, x: number, y: number, width: number): number {
    const idx = (y * width + x) * 4
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3
  }

  private detectQRCodeSize(edges: Uint8ClampedArray): number {
    // Simplified QR detection - look for square patterns
    // This is a placeholder - real implementation would use more sophisticated detection
    let detectedSize = 0
    
    // Count edge pixels in center region
    const width = this.canvasElement!.width
    const height = this.canvasElement!.height
    const centerX = width / 2
    const centerY = height / 2
    const searchRadius = Math.min(width, height) / 3
    
    let edgeCount = 0
    for (let y = centerY - searchRadius; y < centerY + searchRadius; y++) {
      for (let x = centerX - searchRadius; x < centerX + searchRadius; x++) {
        if (edges[Math.floor(y) * width + Math.floor(x)] > 128) {
          edgeCount++
        }
      }
    }
    
    // Estimate QR size based on edge density
    if (edgeCount > 100) {
      detectedSize = edgeCount / 100 // Simplified calculation
    }
    
    return detectedSize
  }

  private adjustZoom(qrSize: number) {
    if (!this.videoElement) return
    
    const targetSize = Math.min(this.canvasElement!.width, this.canvasElement!.height) * 0.4
    const currentSize = qrSize
    
    if (currentSize < targetSize * 0.8) {
      // QR too small, zoom in
      this.zoomIn()
    } else if (currentSize > targetSize * 1.2) {
      // QR too large, zoom out
      this.zoomOut()
    }
  }

  private async zoomIn() {
    if (!this.videoElement || !this.videoElement.srcObject) return
    
    const stream = this.videoElement.srcObject as MediaStream
    const track = stream.getVideoTracks()[0]
    
    if (track && 'getCapabilities' in track) {
      const capabilities = track.getCapabilities() as any
      
      if (capabilities.zoom) {
        const currentZoom = (track.getSettings() as any).zoom || 1
        const newZoom = Math.min(currentZoom * 1.1, capabilities.zoom.max)
        
        await track.applyConstraints({
          advanced: [{ zoom: newZoom } as any]
        })
        
        this.zoomLevel = newZoom
        this.onStateChange?.(`zoom_${Math.round(newZoom * 100)}`)
      }
    }
  }

  private async zoomOut() {
    if (!this.videoElement || !this.videoElement.srcObject) return
    
    const stream = this.videoElement.srcObject as MediaStream
    const track = stream.getVideoTracks()[0]
    
    if (track && 'getCapabilities' in track) {
      const capabilities = track.getCapabilities() as any
      
      if (capabilities.zoom) {
        const currentZoom = (track.getSettings() as any).zoom || 1
        const newZoom = Math.max(currentZoom * 0.9, capabilities.zoom.min || 1)
        
        await track.applyConstraints({
          advanced: [{ zoom: newZoom } as any]
        })
        
        this.zoomLevel = newZoom
        this.onStateChange?.(`zoom_${Math.round(newZoom * 100)}`)
      }
    }
  }

  private startAutoZoom() {
    // Periodically check and adjust zoom
    this.autoZoomTimer = setInterval(() => {
      if (this.lastDetectedSize > 0) {
        this.adjustZoom(this.lastDetectedSize)
      }
    }, 500)
  }

  private handleQRCodeSuccess(decodedText: string) {
    // Play success sound
    this.playSuccessSound()
    
    // Vibrate if available
    if ('vibrate' in navigator) {
      navigator.vibrate(200)
    }
    
    // Callback
    this.onQRDetected?.(decodedText)
    this.onStateChange?.('success')
    
    // Stop scanning
    this.stop()
  }

  private handleQRCodeError(errorMessage: string) {
    // Silent fail for not found errors
    if (!errorMessage.includes('NotFoundException')) {
      console.log('Scan error:', errorMessage)
    }
  }

  private playSuccessSound() {
    this.successSound?.play().catch(() => {})
  }

  private playFocusSound() {
    this.focusSound?.play().catch(() => {})
  }

  async stop(): Promise<void> {
    this.isScanning = false
    
    // Clear timers
    if (this.autoZoomTimer) {
      clearInterval(this.autoZoomTimer)
      this.autoZoomTimer = null
    }
    
    // Cancel animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
    
    // Stop scanner
    if (this.scanner) {
      try {
        const state = this.scanner.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          await this.scanner.stop()
        }
      } catch (error) {
        console.error('Error stopping scanner:', error)
      }
    }
    
    // Clear references
    this.videoElement = null
    this.canvasElement = null
    this.ctx = null
    this.detectionCount = 0
    this.lastDetectedSize = 0
    this.zoomLevel = 1
    
    this.onStateChange?.('stopped')
  }

  async toggleTorch(): Promise<void> {
    if (!this.videoElement || !this.videoElement.srcObject) return
    
    const stream = this.videoElement.srcObject as MediaStream
    const track = stream.getVideoTracks()[0]
    
    if (track && 'getCapabilities' in track) {
      const capabilities = track.getCapabilities() as any
      
      if (capabilities.torch) {
        const currentTorch = (track.getSettings() as any).torch || false
        
        await track.applyConstraints({
          advanced: [{ torch: !currentTorch } as any]
        })
        
        this.onStateChange?.(`torch_${!currentTorch ? 'on' : 'off'}`)
      }
    }
  }

  getZoomLevel(): number {
    return this.zoomLevel
  }
}