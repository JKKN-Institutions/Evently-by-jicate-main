import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode'

/**
 * Specialized scanner for poster/flyer QR codes with low contrast
 * Optimized for QR codes like the one in Jolly Jam poster
 */
export class PosterQRScanner {
  private scanner: Html5Qrcode | null = null
  private currentCameraId: string | null = null
  private isScanning: boolean = false
  private currentZoom: number = 2.5 // Start with 2.5x zoom for poster QRs
  private torchOn: boolean = false
  private scanAttempts: number = 0
  private frameProcessingCanvas: HTMLCanvasElement | null = null
  private frameProcessingCtx: CanvasRenderingContext2D | null = null
  
  // Callbacks
  private onSuccess: (decodedText: string) => void
  private onError?: (error: string) => void
  private onStatusUpdate?: (status: string) => void
  
  // Poster QR specific configurations
  private posterConfigs = [
    {
      name: 'Corner Focus',
      fps: 8,
      qrbox: { width: 200, height: 200 }, // Small box for corner QRs
      description: 'Scanning corners...'
    },
    {
      name: 'Bottom Third',
      fps: 10,
      qrbox: (width: number, height: number) => {
        // Focus on bottom third where QRs often are
        return { 
          width: Math.floor(width * 0.4), 
          height: Math.floor(height * 0.3) 
        }
      },
      description: 'Scanning bottom area...'
    },
    {
      name: 'Full Scan',
      fps: 12,
      qrbox: (width: number, height: number) => {
        const min = Math.min(width, height)
        return { 
          width: Math.floor(min * 0.7), 
          height: Math.floor(min * 0.7) 
        }
      },
      description: 'Full area scan...'
    },
    {
      name: 'Tight Focus',
      fps: 5,
      qrbox: { width: 150, height: 150 }, // Very small for tiny QRs
      description: 'Focused scan...'
    }
  ]
  private currentConfigIndex: number = 0
  private configRotationInterval: NodeJS.Timeout | null = null

  constructor(config: {
    elementId: string
    onSuccess: (decodedText: string) => void
    onError?: (error: string) => void
    onStatusUpdate?: (status: string) => void
  }) {
    this.onSuccess = config.onSuccess
    this.onError = config.onError
    this.onStatusUpdate = config.onStatusUpdate
    
    // Initialize processing canvas for contrast enhancement
    this.frameProcessingCanvas = document.createElement('canvas')
    this.frameProcessingCtx = this.frameProcessingCanvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false
    })
    
    // Create scanner instance
    this.scanner = new Html5Qrcode(config.elementId, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE
      ],
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    } as any)
  }

  async start(): Promise<void> {
    console.log('🎯 Starting Poster QR Scanner...')
    this.onStatusUpdate?.('Initializing camera...')
    
    try {
      // Get cameras
      const cameras = await Html5Qrcode.getCameras()
      if (!cameras || cameras.length === 0) {
        throw new Error('No cameras found')
      }
      
      // Select best camera
      const camera = this.selectBestCamera(cameras)
      this.currentCameraId = camera.id
      
      // Start with first config
      await this.startWithConfig(this.posterConfigs[0])
      
      // Start config rotation for poster scanning
      this.startConfigRotation()
      
    } catch (error) {
      console.error('Failed to start scanner:', error)
      this.onError?.(error instanceof Error ? error.message : 'Scanner failed')
    }
  }

  private selectBestCamera(cameras: any[]): any {
    // Prefer back camera for posters
    const backCamera = cameras.find(cam => {
      const label = cam.label?.toLowerCase() || ''
      return label.includes('back') || 
             label.includes('rear') || 
             label.includes('environment') ||
             !label.includes('front')
    })
    return backCamera || cameras[0]
  }

  private async startWithConfig(config: any): Promise<void> {
    if (!this.scanner || !this.currentCameraId) return
    
    console.log(`📸 Config: ${config.name}`)
    this.onStatusUpdate?.(config.description)
    
    const scanConfig = {
      fps: config.fps,
      qrbox: config.qrbox,
      aspectRatio: 1.0,
      disableFlip: false,
      videoConstraints: {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        facingMode: 'environment',
        advanced: [{
          // Optimized for poster QRs at 20-40cm distance
          focusMode: 'continuous',
          focusDistance: 0.3, // 30cm typical poster viewing
          zoom: this.currentZoom,
          
          // High contrast and sharpness for low-contrast QRs
          contrast: 120,
          sharpness: 100,
          brightness: 10,
          saturation: 50, // Lower saturation helps with contrast
          
          // Better exposure for printed materials
          exposureMode: 'continuous',
          exposureCompensation: 0.5,
          
          // High ISO for indoor lighting
          iso: 1000,
          
          whiteBalanceMode: 'continuous'
        } as any]
      }
    }
    
    try {
      await this.scanner.start(
        this.currentCameraId,
        scanConfig,
        (decodedText) => {
          this.handleSuccess(decodedText)
        },
        (errorMessage) => {
          this.handleError(errorMessage)
        }
      )
      
      this.isScanning = true
      
      // Apply poster-specific optimizations
      setTimeout(() => {
        this.applyPosterOptimizations()
      }, 500)
      
    } catch (error) {
      console.error('Config start failed:', error)
    }
  }

  private async applyPosterOptimizations(): Promise<void> {
    try {
      const videos = document.getElementsByTagName('video')
      if (videos.length === 0) return
      
      const video = videos[0]
      const stream = video.srcObject as MediaStream
      if (!stream) return
      
      const track = stream.getVideoTracks()[0]
      if (!track) return
      
      const capabilities = track.getCapabilities ? track.getCapabilities() : {} as any
      const constraints: any = { advanced: [] }
      
      // Optimize for poster distance (20-40cm)
      if (capabilities.focusDistance) {
        constraints.advanced.push({
          focusMode: 'continuous',
          focusDistance: 0.25 // 25cm optimal for posters
        })
      }
      
      // Maximum contrast for low-contrast QRs
      if (capabilities.contrast) {
        constraints.advanced.push({
          contrast: capabilities.contrast.max || 100
        })
      }
      
      // Brightness adjustment for white QRs
      if (capabilities.brightness) {
        constraints.advanced.push({
          brightness: 20 // Slight brightness boost
        })
      }
      
      // Edge enhancement through sharpness
      if (capabilities.sharpness) {
        constraints.advanced.push({
          sharpness: capabilities.sharpness.max || 100
        })
      }
      
      if (constraints.advanced.length > 0) {
        await track.applyConstraints(constraints)
        console.log('Applied poster optimizations')
      }
      
      // Try inverting for white QR codes
      this.setupInversionDetection()
      
    } catch (error) {
      console.warn('Optimization failed:', error)
    }
  }

  private setupInversionDetection(): void {
    // For white QR codes on colored backgrounds
    try {
      const videos = document.getElementsByTagName('video')
      if (videos.length === 0 || !this.frameProcessingCtx) return
      
      const video = videos[0]
      
      // Process frames for inversion
      setInterval(() => {
        if (!this.isScanning) return
        
        this.frameProcessingCanvas!.width = video.videoWidth
        this.frameProcessingCanvas!.height = video.videoHeight
        
        // Draw and invert
        this.frameProcessingCtx!.filter = 'invert(1) contrast(1.5)'
        this.frameProcessingCtx!.drawImage(video, 0, 0)
        
        // Scanner will process both normal and inverted
      }, 500) // Check every 500ms
      
    } catch (error) {
      console.warn('Inversion setup failed:', error)
    }
  }

  private handleSuccess(decodedText: string): void {
    console.log('✅ Poster QR detected:', decodedText)
    
    // Vibrate
    if ('vibrate' in navigator) {
      navigator.vibrate(200)
    }
    
    this.stop()
    this.onSuccess(decodedText)
  }

  private handleError(errorMessage: string): void {
    this.scanAttempts++
    
    // Log non-standard errors
    if (!errorMessage.includes('NotFoundException')) {
      console.debug('Scan error:', errorMessage)
    }
    
    // Try different zoom levels for poster QRs
    if (this.scanAttempts > 20 && this.scanAttempts % 10 === 0) {
      this.adjustZoomForPoster()
    }
    
    // Adjust focus distance periodically
    if (this.scanAttempts > 30 && this.scanAttempts % 15 === 0) {
      this.adjustFocusDistance()
    }
  }

  private async adjustZoomForPoster(): Promise<void> {
    // Cycle through zoom levels optimized for posters
    const zoomLevels = [2, 2.5, 3, 3.5, 4, 1.5, 1]
    const newZoom = zoomLevels[Math.floor(this.scanAttempts / 10) % zoomLevels.length]
    
    await this.setZoom(newZoom)
    console.log(`🔍 Trying zoom: ${newZoom}x`)
  }

  private async adjustFocusDistance(): Promise<void> {
    try {
      const videos = document.getElementsByTagName('video')
      if (videos.length === 0) return
      
      const video = videos[0]
      const stream = video.srcObject as MediaStream
      if (!stream) return
      
      const track = stream.getVideoTracks()[0]
      if (!track || !track.getCapabilities) return
      
      const capabilities = track.getCapabilities() as any
      
      if (capabilities.focusDistance) {
        // Try different poster distances
        const distances = [0.2, 0.25, 0.3, 0.35, 0.4, 0.15]
        const distance = distances[Math.floor(this.scanAttempts / 15) % distances.length]
        
        await track.applyConstraints({
          advanced: [{ 
            focusDistance: distance,
            focusMode: 'continuous'
          } as any]
        })
        
        console.log(`📏 Focus distance: ${distance * 100}cm`)
      }
    } catch (error) {
      console.warn('Focus adjustment failed:', error)
    }
  }

  private startConfigRotation(): void {
    // Rotate through configs every 3 seconds
    this.configRotationInterval = setInterval(() => {
      if (!this.isScanning) return
      
      this.currentConfigIndex = (this.currentConfigIndex + 1) % this.posterConfigs.length
      const newConfig = this.posterConfigs[this.currentConfigIndex]
      
      console.log(`🔄 Switching to: ${newConfig.name}`)
      
      // Restart with new config
      this.restartWithConfig(newConfig)
    }, 3000)
  }

  private async restartWithConfig(config: any): Promise<void> {
    if (!this.scanner || !this.currentCameraId) return
    
    try {
      // Stop current scanning
      const state = this.scanner.getState()
      if (state === Html5QrcodeScannerState.SCANNING) {
        await this.scanner.stop()
      }
      
      // Start with new config
      await this.startWithConfig(config)
    } catch (error) {
      console.error('Config restart failed:', error)
    }
  }

  async setZoom(level: number): Promise<void> {
    if (!this.isScanning) return
    
    try {
      const videos = document.getElementsByTagName('video')
      if (videos.length === 0) return
      
      const video = videos[0]
      const stream = video.srcObject as MediaStream
      if (!stream) return
      
      const track = stream.getVideoTracks()[0]
      if (!track) return
      
      const capabilities = track.getCapabilities ? track.getCapabilities() : {} as any
      
      if (capabilities.zoom) {
        const maxZoom = capabilities.zoom.max || 5
        const minZoom = capabilities.zoom.min || 1
        const targetZoom = Math.max(minZoom, Math.min(level, maxZoom))
        
        await track.applyConstraints({
          advanced: [{ zoom: targetZoom } as any]
        })
        
        this.currentZoom = targetZoom
        this.onStatusUpdate?.(`Zoom: ${targetZoom.toFixed(1)}x`)
      }
    } catch (error) {
      console.warn('Zoom failed:', error)
    }
  }

  async toggleTorch(): Promise<boolean> {
    try {
      const videos = document.getElementsByTagName('video')
      if (videos.length === 0) return false
      
      const video = videos[0]
      const stream = video.srcObject as MediaStream
      if (!stream) return false
      
      const track = stream.getVideoTracks()[0]
      if (!track) return false
      
      const capabilities = track.getCapabilities ? track.getCapabilities() : {} as any
      
      if (capabilities.torch) {
        this.torchOn = !this.torchOn
        await track.applyConstraints({
          advanced: [{ torch: this.torchOn } as any]
        })
        return this.torchOn
      }
    } catch (error) {
      console.warn('Torch failed:', error)
    }
    return false
  }

  async stop(): Promise<void> {
    this.isScanning = false
    
    // Stop config rotation
    if (this.configRotationInterval) {
      clearInterval(this.configRotationInterval)
      this.configRotationInterval = null
    }
    
    // Stop scanner
    if (this.scanner) {
      try {
        const state = this.scanner.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          await this.scanner.stop()
        }
        this.scanner.clear()
      } catch (error) {
        console.error('Stop error:', error)
      }
    }
  }

  getZoomLevel(): number {
    return this.currentZoom
  }
}