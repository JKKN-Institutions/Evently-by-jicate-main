import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { SMALL_QR_CONFIG, getOptimalCamera } from './small-qr-scanner'

export interface FixedScannerConfig {
  elementId: string
  onSuccess: (decodedText: string) => void
  onError?: (error: string) => void
  onStatusUpdate?: (status: string) => void
}

/**
 * Enhanced Fixed Scanner with multi-algorithm support for tiny QR codes
 */
export class FixedScanner {
  private scanner: Html5Qrcode | null = null
  private currentCameraId: string | null = null
  private isScanning: boolean = false
  private config: FixedScannerConfig
  private currentZoom: number = 1
  private torchOn: boolean = false
  
  // Multi-algorithm scanning
  private scanAttempts: number = 0
  private frameBuffer: string[] = []
  private frameBufferSize: number = 5
  private consensusThreshold: number = 3
  private lastDetectionTime: number = 0
  
  // Image preprocessing
  private preprocessCanvas: HTMLCanvasElement | null = null
  private preprocessCtx: CanvasRenderingContext2D | null = null
  
  // Multi-scale scanning
  private zoomLevels: number[] = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
  private currentZoomIndex: number = 0
  private autoZoomEnabled: boolean = false
  private zoomCycleInterval: NodeJS.Timeout | null = null
  
  // Scan configurations for different scenarios
  private scanConfigs = [
    {
      name: 'Tiny QR Focus',
      fps: 5,
      qrbox: { width: 150, height: 150 },
      aspectRatio: 1.0,
      zoom: 3,
      focusDistance: 0.1
    },
    {
      name: 'Small Area Scan',
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      zoom: 2.5,
      focusDistance: 0.15
    },
    {
      name: 'Poster QR Mode',
      fps: 8,
      qrbox: { width: 200, height: 200 },
      aspectRatio: 1.0,
      zoom: 2.5,
      focusDistance: 0.25,
      contrast: 150,
      brightness: 20
    },
    {
      name: 'Medium Coverage',
      fps: 15,
      qrbox: (width: number, height: number) => {
        const min = Math.min(width, height)
        return { width: Math.floor(min * 0.6), height: Math.floor(min * 0.6) }
      },
      aspectRatio: 1.0,
      zoom: 2,
      focusDistance: 0.2
    },
    {
      name: 'Wide Detection',
      fps: 10,
      qrbox: (width: number, height: number) => {
        const min = Math.min(width, height)
        return { width: Math.floor(min * 0.8), height: Math.floor(min * 0.8) }
      },
      aspectRatio: 1.0,
      zoom: 1.5,
      focusDistance: 0.3
    }
  ]
  private currentConfigIndex: number = 2 // Start with Poster QR Mode

  constructor(config: FixedScannerConfig) {
    this.config = config
    this.initPreprocessing()
  }

  /**
   * Initialize preprocessing canvas
   */
  private initPreprocessing(): void {
    this.preprocessCanvas = document.createElement('canvas')
    this.preprocessCtx = this.preprocessCanvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false
    })
  }

  /**
   * Start scanner with optimal settings
   */
  async start(): Promise<void> {
    console.log('🚀 Starting Enhanced Fixed Scanner for Tiny QRs...')
    
    try {
      // Get optimal camera
      const cameraId = await getOptimalCamera()
      if (!cameraId) {
        throw new Error('No suitable camera found')
      }
      
      this.currentCameraId = cameraId
      
      // Start with Poster QR Mode for better detection of low-contrast QRs
      await this.startWithConfig(cameraId, this.scanConfigs[2]) // Index 2 is Poster QR Mode
      
      // Start multi-scale zoom cycling for tiny QRs
      this.startZoomCycling()
      
    } catch (error) {
      console.error('Scanner initialization failed:', error)
      this.config.onError?.(error instanceof Error ? error.message : 'Failed to start scanner')
    }
  }

  /**
   * Start scanning with specific configuration
   */
  private async startWithConfig(cameraId: string, config: any): Promise<void> {
    console.log(`📷 Starting with config: ${config.name}`)
    this.config.onStatusUpdate?.(config.name)
    
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
    
    // Build scan configuration with high resolution
    const scanConfig = {
      fps: config.fps,
      qrbox: config.qrbox,
      aspectRatio: config.aspectRatio,
      disableFlip: false,
      videoConstraints: {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        facingMode: 'environment',
        advanced: [{
          focusMode: 'continuous',
          focusDistance: config.focusDistance || 0.1, // Use config-specific distance
          exposureMode: 'continuous',
          whiteBalanceMode: 'continuous',
          zoom: config.zoom || this.currentZoom,
          iso: 1200, // Higher ISO for low contrast
          contrast: config.contrast || 120, // Higher contrast for poster QRs
          sharpness: 100,
          saturation: 60, // Lower saturation for better contrast
          brightness: config.brightness || 0,
          exposureCompensation: 0.5 // Slight overexposure for white QRs
        } as any]
      }
    }
    
    // Start scanning
    await this.scanner.start(
      cameraId,
      scanConfig,
      (decodedText) => {
        this.handleDetection(decodedText)
      },
      (errorMessage) => {
        this.handleScanError(errorMessage)
      }
    )
    
    this.isScanning = true
    console.log('Scanner started successfully')
    
    // Apply optimizations after starting
    setTimeout(() => {
      this.applyAdvancedSettings()
    }, 500)
  }

  /**
   * Handle QR detection with consensus
   */
  private handleDetection(decodedText: string): void {
    const now = Date.now()
    
    // Add to frame buffer
    this.frameBuffer.push(decodedText)
    if (this.frameBuffer.length > this.frameBufferSize) {
      this.frameBuffer.shift()
    }
    
    // Check for consensus
    const consensus = this.getConsensusDetection()
    if (consensus) {
      console.log('✅ QR Code detected with consensus:', consensus)
      
      // Vibrate on success
      if ('vibrate' in navigator) {
        navigator.vibrate(200)
      }
      
      // Stop scanning and report success
      this.stop()
      this.config.onSuccess(consensus)
    }
    
    this.lastDetectionTime = now
  }

  /**
   * Get consensus detection from frame buffer
   */
  private getConsensusDetection(): string | null {
    if (this.frameBuffer.length < this.consensusThreshold) return null
    
    const counts = new Map<string, number>()
    for (const detection of this.frameBuffer) {
      counts.set(detection, (counts.get(detection) || 0) + 1)
    }
    
    for (const [detection, count] of counts) {
      if (count >= this.consensusThreshold) {
        return detection
      }
    }
    
    return null
  }

  /**
   * Handle scan errors and adapt
   */
  private handleScanError(errorMessage: string): void {
    this.scanAttempts++
    
    // Only log non-NotFoundException errors
    if (!errorMessage.includes('NotFoundException')) {
      console.debug('Scan error:', errorMessage)
    }
    
    // Try different configuration after many failed attempts
    if (this.scanAttempts > 100 && this.scanAttempts % 50 === 0) {
      this.rotateConfiguration()
    }
    
    // Apply image enhancements after some attempts
    if (this.scanAttempts > 30 && this.scanAttempts % 10 === 0) {
      this.enhanceImageSettings()
    }
  }

  /**
   * Rotate through scan configurations
   */
  private async rotateConfiguration(): Promise<void> {
    this.currentConfigIndex = (this.currentConfigIndex + 1) % this.scanConfigs.length
    const newConfig = this.scanConfigs[this.currentConfigIndex]
    
    console.log(`🔄 Switching to: ${newConfig.name}`)
    this.config.onStatusUpdate?.(newConfig.name)
    
    // Restart with new configuration
    if (this.scanner && this.currentCameraId) {
      try {
        await this.cleanup()
        await this.startWithConfig(this.currentCameraId, newConfig)
      } catch (error) {
        console.error('Config rotation failed:', error)
      }
    }
  }

  /**
   * Apply advanced camera settings for tiny QR detection
   */
  private async applyAdvancedSettings(): Promise<void> {
    try {
      const videoElements = document.getElementsByTagName('video')
      if (videoElements.length === 0) return
      
      const video = videoElements[0]
      const stream = video.srcObject as MediaStream
      if (!stream) return
      
      const track = stream.getVideoTracks()[0]
      if (!track) return
      
      const capabilities = track.getCapabilities ? track.getCapabilities() : {} as any
      const constraints: any = { advanced: [] }
      
      // Ultra-close focus for tiny QRs
      if (capabilities.focusMode) {
        constraints.advanced.push({ 
          focusMode: 'continuous',
          focusDistance: capabilities.focusDistance?.min || 0.05 // 5cm
        })
      }
      
      // Maximum contrast and sharpness
      if (capabilities.contrast) {
        constraints.advanced.push({ 
          contrast: capabilities.contrast.max || 100
        })
      }
      
      if (capabilities.sharpness) {
        constraints.advanced.push({ 
          sharpness: capabilities.sharpness.max || 100
        })
      }
      
      // High ISO for better detection
      if (capabilities.iso) {
        constraints.advanced.push({ 
          iso: Math.min(1600, capabilities.iso.max || 800)
        })
      }
      
      // Optimal exposure
      if (capabilities.exposureMode) {
        constraints.advanced.push({ 
          exposureMode: 'continuous',
          exposureCompensation: 0
        })
      }
      
      // Lower saturation for better contrast
      if (capabilities.saturation) {
        constraints.advanced.push({ 
          saturation: 70
        })
      }
      
      if (constraints.advanced.length > 0) {
        await track.applyConstraints(constraints)
        console.log('Applied advanced camera settings for tiny QRs')
      }
      
    } catch (error) {
      console.warn('Could not apply advanced settings:', error)
    }
  }

  /**
   * Enhance image settings dynamically
   */
  private async enhanceImageSettings(): Promise<void> {
    try {
      const videoElements = document.getElementsByTagName('video')
      if (videoElements.length === 0) return
      
      const video = videoElements[0]
      const stream = video.srcObject as MediaStream
      if (!stream) return
      
      const track = stream.getVideoTracks()[0]
      if (!track || !track.getCapabilities) return
      
      const capabilities = track.getCapabilities() as any
      
      // Cycle through different focus distances
      if (capabilities.focusDistance) {
        const distances = [0.05, 0.1, 0.15, 0.2, 0.3]
        const distance = distances[this.scanAttempts % distances.length]
        
        await track.applyConstraints({
          advanced: [{ focusDistance: distance } as any]
        })
      }
      
      // Adjust exposure compensation
      if (capabilities.exposureCompensation) {
        const compensations = [-1, -0.5, 0, 0.5, 1]
        const compensation = compensations[this.scanAttempts % compensations.length]
        
        await track.applyConstraints({
          advanced: [{ exposureCompensation: compensation } as any]
        })
      }
      
    } catch (error) {
      console.warn('Image enhancement failed:', error)
    }
  }

  /**
   * Start automatic zoom cycling for multi-scale scanning
   */
  private startZoomCycling(): void {
    if (this.autoZoomEnabled && !this.zoomCycleInterval) {
      this.zoomCycleInterval = setInterval(() => {
        this.cycleZoom()
      }, 2000) // Change zoom every 2 seconds
    }
  }

  /**
   * Stop zoom cycling
   */
  private stopZoomCycling(): void {
    if (this.zoomCycleInterval) {
      clearInterval(this.zoomCycleInterval)
      this.zoomCycleInterval = null
    }
  }

  /**
   * Cycle through zoom levels
   */
  private async cycleZoom(): Promise<void> {
    if (!this.isScanning) return
    
    this.currentZoomIndex = (this.currentZoomIndex + 1) % this.zoomLevels.length
    const newZoom = this.zoomLevels[this.currentZoomIndex]
    
    await this.setZoom(newZoom)
    console.log(`🔍 Auto-zoom: ${newZoom}x`)
  }

  /**
   * Set manual zoom level
   */
  async setZoom(level: number): Promise<void> {
    if (!this.isScanning) return
    
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
        
        this.currentZoom = targetZoom
        this.config.onStatusUpdate?.(`Zoom: ${targetZoom.toFixed(1)}x`)
        
        // Reset scan attempts when zoom changes
        this.scanAttempts = 0
        this.frameBuffer = []
      }
    } catch (error) {
      console.warn('Zoom adjustment failed:', error)
    }
  }

  /**
   * Toggle torch/flashlight
   */
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
      
      if (capabilities.torch) {
        this.torchOn = !this.torchOn
        await track.applyConstraints({
          advanced: [{ torch: this.torchOn } as any]
        })
        
        this.config.onStatusUpdate?.(this.torchOn ? 'Torch ON' : 'Torch OFF')
        return this.torchOn
      }
    } catch (error) {
      console.warn('Torch toggle failed:', error)
    }
    return false
  }

  /**
   * Enable/disable auto zoom cycling
   */
  setAutoZoom(enabled: boolean): void {
    this.autoZoomEnabled = enabled
    if (enabled) {
      this.startZoomCycling()
    } else {
      this.stopZoomCycling()
    }
  }

  /**
   * Stop scanner and cleanup
   */
  async stop(): Promise<void> {
    this.isScanning = false
    this.stopZoomCycling()
    await this.cleanup()
  }

  /**
   * Cleanup scanner resources
   */
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
    
    // Reset state
    this.frameBuffer = []
    this.scanAttempts = 0
    this.currentConfigIndex = 0
    this.currentZoomIndex = 0
  }

  /**
   * Get current zoom level
   */
  getZoomLevel(): number {
    return this.currentZoom
  }

  /**
   * Get scan statistics
   */
  getStats(): { attempts: number; bufferSize: number; config: string } {
    return {
      attempts: this.scanAttempts,
      bufferSize: this.frameBuffer.length,
      config: this.scanConfigs[this.currentConfigIndex].name
    }
  }
}