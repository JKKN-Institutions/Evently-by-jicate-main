import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export interface RobustScannerConfig {
  elementId: string
  onSuccess: (decodedText: string) => void
  onError?: (error: string) => void
  onStatusUpdate?: (status: string) => void
}

export class UltraRobustScanner {
  private scanner: Html5Qrcode | null = null
  private currentCameraId: string | null = null
  private isScanning: boolean = false
  private config: RobustScannerConfig
  private attemptCount: number = 0
  private maxAttempts: number = 5
  private currentStrategy: number = 0
  
  // Multiple scanning strategies like GPay
  private scanStrategies = [
    {
      name: 'High Resolution',
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      videoConstraints: {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        facingMode: 'environment',
        focusMode: 'continuous',
        exposureMode: 'continuous',
        whiteBalanceMode: 'continuous'
      }
    },
    {
      name: 'Medium Resolution Fast',
      fps: 30,
      qrbox: { width: 300, height: 300 },
      aspectRatio: 1.0,
      videoConstraints: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        facingMode: 'environment'
      }
    },
    {
      name: 'Low Resolution Wide',
      fps: 15,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
        const size = Math.floor(minEdge * 0.8) // 80% scan area for small QR
        return { width: size, height: size }
      },
      aspectRatio: 1.0,
      videoConstraints: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'environment'
      }
    },
    {
      name: 'Ultra Wide Detection',
      fps: 20,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
        const size = Math.floor(minEdge * 0.9) // 90% scan area
        return { width: size, height: size }
      },
      aspectRatio: 1.777, // 16:9
      videoConstraints: {
        facingMode: 'environment'
      }
    },
    {
      name: 'Legacy Compatible',
      fps: 10,
      qrbox: 250,
      videoConstraints: {
        facingMode: { exact: 'environment' }
      }
    }
  ]

  constructor(config: RobustScannerConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Ultra Robust Scanner (GPay-style)...')
    
    try {
      // Get cameras
      const cameras = await this.getCameras()
      if (!cameras || cameras.length === 0) {
        throw new Error('No cameras found')
      }
      
      // Select best camera
      const cameraId = this.selectBestCamera(cameras)
      this.currentCameraId = cameraId
      
      // Try scanning with different strategies
      await this.tryScanning(cameraId)
      
    } catch (error) {
      console.error('Scanner initialization failed:', error)
      this.config.onError?.(error instanceof Error ? error.message : 'Failed to start scanner')
    }
  }

  private async getCameras(): Promise<any[]> {
    try {
      // First ensure we have permissions
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop())
      
      // Get cameras
      const cameras = await Html5Qrcode.getCameras()
      console.log(`📷 Found ${cameras.length} camera(s)`)
      return cameras
    } catch (error) {
      console.error('Camera access error:', error)
      throw error
    }
  }

  private selectBestCamera(cameras: any[]): string {
    // Prefer back camera like GPay
    const backCamera = cameras.find(camera => {
      const label = camera.label.toLowerCase()
      return label.includes('back') || 
             label.includes('rear') || 
             label.includes('environment') ||
             label.includes('facing back') ||
             label.includes('0') // Often back camera is id 0
    })
    
    const selectedCamera = backCamera || cameras[0]
    console.log(`📷 Selected camera: ${selectedCamera.label}`)
    return selectedCamera.id
  }

  private async tryScanning(cameraId: string): Promise<void> {
    // Try different scanning strategies until one works
    for (let i = 0; i < this.scanStrategies.length; i++) {
      this.currentStrategy = i
      const strategy = this.scanStrategies[i]
      
      console.log(`🔍 Trying strategy ${i + 1}/${this.scanStrategies.length}: ${strategy.name}`)
      this.config.onStatusUpdate?.(`Scanning mode: ${strategy.name}`)
      
      try {
        await this.startWithStrategy(cameraId, strategy)
        console.log(`✅ Successfully started with strategy: ${strategy.name}`)
        return // Success!
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error)
        
        // Clean up before trying next strategy
        await this.cleanup()
        
        if (i === this.scanStrategies.length - 1) {
          throw new Error('All scanning strategies failed')
        }
        
        // Wait a bit before next attempt
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

  private async startWithStrategy(cameraId: string, strategy: any): Promise<void> {
    // Create scanner instance
    this.scanner = new Html5Qrcode(this.config.elementId, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.AZTEC,
        Html5QrcodeSupportedFormats.PDF_417
      ],
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    } as any)
    
    // Build config with strategy
    const config: any = {
      fps: strategy.fps,
      qrbox: strategy.qrbox,
      aspectRatio: strategy.aspectRatio,
      disableFlip: false,
      rememberLastUsedCamera: true
    }
    
    // Add video constraints if specified
    if (strategy.videoConstraints) {
      config.videoConstraints = strategy.videoConstraints
    }
    
    // Start scanning
    await this.scanner.start(
      cameraId,
      config,
      (decodedText) => {
        console.log('✅ QR Code detected:', decodedText)
        this.handleSuccess(decodedText)
      },
      (errorMessage) => {
        // Only log non-NotFoundException errors
        if (!errorMessage.includes('NotFoundException')) {
          this.attemptCount++
          
          // Try auto-adjustments after some attempts
          if (this.attemptCount > 20 && this.attemptCount % 10 === 0) {
            this.tryAutoAdjustments()
          }
        }
      }
    )
    
    this.isScanning = true
    
    // Set up advanced features after starting
    setTimeout(() => {
      this.setupAdvancedFeatures()
    }, 500)
  }

  private async setupAdvancedFeatures(): Promise<void> {
    try {
      // Get video element
      const videoElements = document.getElementsByTagName('video')
      if (videoElements.length === 0) return
      
      const video = videoElements[0]
      const stream = video.srcObject as MediaStream
      if (!stream) return
      
      const track = stream.getVideoTracks()[0]
      if (!track) return
      
      // Try to enable advanced camera features like GPay
      const capabilities = track.getCapabilities ? track.getCapabilities() : {} as any
      const settings = track.getSettings ? track.getSettings() : {} as any
      
      console.log('📷 Camera capabilities:', capabilities)
      console.log('📷 Current settings:', settings)
      
      // Apply advanced constraints for better detection
      const constraints: any = { advanced: [] }
      
      // Auto-focus for better QR detection
      if (capabilities.focusMode) {
        constraints.advanced.push({ focusMode: 'continuous' })
      }
      
      // Auto exposure
      if (capabilities.exposureMode) {
        constraints.advanced.push({ exposureMode: 'continuous' })
      }
      
      // Auto white balance
      if (capabilities.whiteBalanceMode) {
        constraints.advanced.push({ whiteBalanceMode: 'continuous' })
      }
      
      // ISO settings for better low light
      if (capabilities.iso) {
        constraints.advanced.push({ 
          iso: capabilities.iso.max ? Math.min(800, capabilities.iso.max) : 800 
        })
      }
      
      // Zoom - start at 1x but can be adjusted
      if (capabilities.zoom) {
        constraints.advanced.push({ zoom: 1 })
      }
      
      // Apply constraints
      if (constraints.advanced.length > 0) {
        await track.applyConstraints(constraints)
        console.log('✅ Applied advanced camera features')
      }
      
    } catch (error) {
      console.warn('Could not apply advanced features:', error)
    }
  }

  private async tryAutoAdjustments(): Promise<void> {
    try {
      const videoElements = document.getElementsByTagName('video')
      if (videoElements.length === 0) return
      
      const video = videoElements[0]
      const stream = video.srcObject as MediaStream
      if (!stream) return
      
      const track = stream.getVideoTracks()[0]
      if (!track || !track.getCapabilities) return
      
      const capabilities = track.getCapabilities() as any
      const settings = track.getSettings() as any
      
      // Try adjusting zoom
      if (capabilities.zoom && settings.zoom) {
        const currentZoom = settings.zoom
        let newZoom = currentZoom
        
        // Cycle through zoom levels
        if (currentZoom <= 1) {
          newZoom = 1.5
        } else if (currentZoom <= 1.5) {
          newZoom = 2
        } else {
          newZoom = 1
        }
        
        if (capabilities.zoom.max >= newZoom) {
          await track.applyConstraints({
            advanced: [{ zoom: newZoom } as any]
          })
          console.log(`🔍 Adjusted zoom to ${newZoom}x`)
          this.config.onStatusUpdate?.(`Zoom: ${newZoom}x`)
        }
      }
      
      // Try adjusting brightness/exposure
      if (capabilities.exposureCompensation) {
        const current = settings.exposureCompensation || 0
        const newValue = current === 0 ? 1 : 0
        await track.applyConstraints({
          advanced: [{ exposureCompensation: newValue } as any]
        })
        console.log(`💡 Adjusted exposure compensation`)
      }
      
    } catch (error) {
      console.warn('Auto-adjustment failed:', error)
    }
  }

  private handleSuccess(decodedText: string): void {
    // Vibrate on success
    if ('vibrate' in navigator) {
      navigator.vibrate(200)
    }
    
    // Stop scanning
    this.stop()
    
    // Callback
    this.config.onSuccess(decodedText)
  }

  async stop(): Promise<void> {
    this.isScanning = false
    await this.cleanup()
  }

  private async cleanup(): Promise<void> {
    if (this.scanner) {
      try {
        const state = this.scanner.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          await this.scanner.stop()
        }
        this.scanner.clear()
      } catch (error) {
        console.error('Cleanup error:', error)
      }
      this.scanner = null
    }
  }

  async toggleTorch(): Promise<boolean> {
    try {
      const videoElements = document.getElementsByTagName('video')
      if (videoElements.length === 0) return false
      
      const video = videoElements[0]
      const stream = video.srcObject as MediaStream
      if (!stream) return false
      
      const track = stream.getVideoTracks()[0]
      if (!track) return false
      
      const capabilities = track.getCapabilities ? track.getCapabilities() : {} as any
      const settings = track.getSettings ? track.getSettings() : {} as any
      
      if (capabilities.torch) {
        const currentTorch = settings.torch || false
        await track.applyConstraints({
          advanced: [{ torch: !currentTorch } as any]
        })
        return !currentTorch
      }
    } catch (error) {
      console.warn('Torch toggle failed:', error)
    }
    return false
  }

  async adjustZoom(level: number): Promise<void> {
    try {
      const videoElements = document.getElementsByTagName('video')
      if (videoElements.length === 0) return
      
      const video = videoElements[0]
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
        
        console.log(`🔍 Zoom adjusted to ${targetZoom}x`)
      }
    } catch (error) {
      console.warn('Zoom adjustment failed:', error)
    }
  }
}