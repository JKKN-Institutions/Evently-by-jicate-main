import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export interface EnhancedDetectorConfig {
  elementId: string
  onSuccess: (decodedText: string) => void
  onError?: (error: string) => void
  onStatusUpdate?: (status: string) => void
}

export class EnhancedQRDetector {
  private scanner: Html5Qrcode | null = null
  private currentCameraId: string | null = null
  private isScanning: boolean = false
  private config: EnhancedDetectorConfig
  private scanAttempts: number = 0
  private lastDetectionTime: number = 0
  private detectionConfidence: number = 0
  private currentZoom: number = 1
  private torchOn: boolean = false
  
  // Detection configurations for different scenarios
  private detectionConfigs = [
    {
      name: 'High Quality',
      qrbox: (width: number, height: number) => {
        const min = Math.min(width, height)
        return { width: Math.floor(min * 0.8), height: Math.floor(min * 0.8) }
      },
      fps: 10,
      aspectRatio: 1.0,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.AZTEC,
        Html5QrcodeSupportedFormats.PDF_417,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E
      ]
    },
    {
      name: 'Fast Scan',
      qrbox: { width: 300, height: 300 },
      fps: 30,
      aspectRatio: 1.0,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    },
    {
      name: 'Wide Area',
      qrbox: (width: number, height: number) => {
        const min = Math.min(width, height)
        return { width: Math.floor(min * 0.95), height: Math.floor(min * 0.95) }
      },
      fps: 15,
      aspectRatio: 1.0,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    }
  ]
  
  private currentConfigIndex: number = 0

  constructor(config: EnhancedDetectorConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Enhanced QR Detector...')
    
    try {
      const cameras = await this.getCameras()
      if (!cameras || cameras.length === 0) {
        throw new Error('No cameras found')
      }
      
      const cameraId = this.selectBestCamera(cameras)
      this.currentCameraId = cameraId
      
      await this.startWithEnhancedDetection(cameraId)
      
    } catch (error) {
      console.error('Detector initialization failed:', error)
      this.config.onError?.(error instanceof Error ? error.message : 'Failed to start detector')
    }
  }

  private async getCameras(): Promise<any[]> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      stream.getTracks().forEach(track => track.stop())
      
      const cameras = await Html5Qrcode.getCameras()
      console.log(`Found ${cameras.length} camera(s)`)
      return cameras
    } catch (error) {
      console.error('Camera access error:', error)
      throw error
    }
  }

  private selectBestCamera(cameras: any[]): string {
    const backCamera = cameras.find(camera => {
      const label = camera.label.toLowerCase()
      return label.includes('back') || 
             label.includes('rear') || 
             label.includes('environment') ||
             !label.includes('front')
    })
    
    const selectedCamera = backCamera || cameras[0]
    console.log(`Selected camera: ${selectedCamera.label}`)
    return selectedCamera.id
  }

  private async startWithEnhancedDetection(cameraId: string): Promise<void> {
    const config = this.detectionConfigs[this.currentConfigIndex]
    console.log(`Using detection config: ${config.name}`)
    
    this.scanner = new Html5Qrcode(this.config.elementId, {
      verbose: false,
      formatsToSupport: config.formatsToSupport,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    } as any)
    
    const scanConfig = {
      fps: config.fps,
      qrbox: config.qrbox,
      aspectRatio: config.aspectRatio,
      disableFlip: false,
      videoConstraints: {
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 },
        facingMode: 'environment',
        advanced: [{
          focusMode: 'continuous',
          exposureMode: 'continuous',
          whiteBalanceMode: 'continuous',
          zoom: this.currentZoom
        } as any]
      }
    }
    
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
    console.log('Enhanced detector started')
    
    // Apply optimizations after starting
    setTimeout(() => {
      this.applyEnhancedSettings()
    }, 500)
    
    // Set up config rotation for difficult QRs
    this.setupConfigRotation()
  }

  private handleDetection(decodedText: string): void {
    const now = Date.now()
    
    // Implement detection confidence
    if (now - this.lastDetectionTime < 500) {
      this.detectionConfidence++
    } else {
      this.detectionConfidence = 1
    }
    
    this.lastDetectionTime = now
    
    // Only trigger success after confident detection
    if (this.detectionConfidence >= 2 || decodedText.length > 0) {
      console.log('✅ QR Code confidently detected:', decodedText)
      
      // Vibrate on success
      if ('vibrate' in navigator) {
        navigator.vibrate(200)
      }
      
      this.stop()
      this.config.onSuccess(decodedText)
    }
  }

  private handleScanError(errorMessage: string): void {
    this.scanAttempts++
    
    // Only log non-NotFoundException errors
    if (!errorMessage.includes('NotFoundException')) {
      console.debug('Scan error:', errorMessage)
    }
    
    // Try adjusting settings after multiple failed attempts
    if (this.scanAttempts > 50 && this.scanAttempts % 25 === 0) {
      this.adjustDetectionSettings()
    }
  }

  private async applyEnhancedSettings(): Promise<void> {
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
      
      // Enhanced focus settings
      if (capabilities.focusMode) {
        constraints.advanced.push({ 
          focusMode: 'continuous',
          focusDistance: capabilities.focusDistance?.min || 0
        })
      }
      
      // Better exposure for QR contrast
      if (capabilities.exposureMode) {
        constraints.advanced.push({ 
          exposureMode: 'continuous',
          exposureCompensation: 0
        })
      }
      
      // Optimize ISO for better detection
      if (capabilities.iso) {
        constraints.advanced.push({ 
          iso: Math.min(1600, capabilities.iso.max || 800)
        })
      }
      
      // Better contrast
      if (capabilities.contrast) {
        constraints.advanced.push({ 
          contrast: capabilities.contrast.max || 100
        })
      }
      
      // Sharper image
      if (capabilities.sharpness) {
        constraints.advanced.push({ 
          sharpness: capabilities.sharpness.max || 100
        })
      }
      
      // White balance
      if (capabilities.whiteBalanceMode) {
        constraints.advanced.push({ 
          whiteBalanceMode: 'continuous'
        })
      }
      
      if (constraints.advanced.length > 0) {
        await track.applyConstraints(constraints)
        console.log('Applied enhanced camera settings')
      }
      
    } catch (error) {
      console.warn('Could not apply enhanced settings:', error)
    }
  }

  private setupConfigRotation(): void {
    // Rotate through detection configs every 3 seconds if no detection
    setInterval(() => {
      if (this.isScanning && this.scanAttempts > 30) {
        this.rotateConfig()
      }
    }, 3000)
  }

  private async rotateConfig(): Promise<void> {
    this.currentConfigIndex = (this.currentConfigIndex + 1) % this.detectionConfigs.length
    const newConfig = this.detectionConfigs[this.currentConfigIndex]
    
    console.log(`Switching to config: ${newConfig.name}`)
    this.config.onStatusUpdate?.(`Trying: ${newConfig.name}`)
    
    // Restart with new config
    await this.cleanup()
    if (this.currentCameraId) {
      await this.startWithEnhancedDetection(this.currentCameraId)
    }
  }

  private async adjustDetectionSettings(): Promise<void> {
    try {
      const videoElements = document.getElementsByTagName('video')
      if (videoElements.length === 0) return
      
      const video = videoElements[0]
      const stream = video.srcObject as MediaStream
      if (!stream) return
      
      const track = stream.getVideoTracks()[0]
      if (!track || !track.getCapabilities) return
      
      const capabilities = track.getCapabilities() as any
      
      // Try different focus distances
      if (capabilities.focusDistance) {
        const distances = [
          capabilities.focusDistance.min,
          (capabilities.focusDistance.min + capabilities.focusDistance.max) / 2,
          capabilities.focusDistance.max
        ]
        const distance = distances[this.scanAttempts % 3]
        
        await track.applyConstraints({
          advanced: [{ focusDistance: distance } as any]
        })
      }
      
      // Adjust exposure compensation
      if (capabilities.exposureCompensation) {
        const compensation = [-1, 0, 1][this.scanAttempts % 3]
        await track.applyConstraints({
          advanced: [{ exposureCompensation: compensation } as any]
        })
      }
      
    } catch (error) {
      console.warn('Settings adjustment failed:', error)
    }
  }

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
        console.log(`Zoom set to ${targetZoom}x`)
        
        // Reset scan attempts when zoom changes
        this.scanAttempts = 0
      }
    } catch (error) {
      console.warn('Zoom adjustment failed:', error)
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
      
      if (capabilities.torch) {
        this.torchOn = !this.torchOn
        await track.applyConstraints({
          advanced: [{ torch: this.torchOn } as any]
        })
        return this.torchOn
      }
    } catch (error) {
      console.warn('Torch toggle failed:', error)
    }
    return false
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

  getZoomLevel(): number {
    return this.currentZoom
  }
}