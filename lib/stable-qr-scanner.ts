import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export interface StableScannerConfig {
  elementId: string
  onSuccess: (decodedText: string) => void
  onError?: (error: string) => void
}

export class StableQRScanner {
  private scanner: Html5Qrcode | null = null
  private currentCameraId: string | null = null
  private isScanning: boolean = false
  private config: StableScannerConfig
  private currentZoom: number = 1
  private torchOn: boolean = false

  constructor(config: StableScannerConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    console.log('Starting Enhanced QR Scanner...')
    
    try {
      // Get cameras
      const cameras = await this.getCameras()
      if (!cameras || cameras.length === 0) {
        throw new Error('No cameras found')
      }
      
      // Select best camera (prefer back camera)
      const cameraId = this.selectBestCamera(cameras)
      this.currentCameraId = cameraId
      
      // Start with optimal settings for QR detection
      await this.startScanning(cameraId)
      
    } catch (error) {
      console.error('Scanner initialization failed:', error)
      this.config.onError?.(error instanceof Error ? error.message : 'Failed to start scanner')
    }
  }

  private async getCameras(): Promise<any[]> {
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      stream.getTracks().forEach(track => track.stop())
      
      // Get all cameras
      const cameras = await Html5Qrcode.getCameras()
      console.log(`Found ${cameras.length} camera(s)`)
      return cameras
    } catch (error) {
      console.error('Camera access error:', error)
      throw error
    }
  }

  private selectBestCamera(cameras: any[]): string {
    // Prefer back/rear camera
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

  private async startScanning(cameraId: string): Promise<void> {
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
    
    // Optimal config for QR detection
    const config = {
      fps: 15, // Balanced FPS for stable scanning
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
        const size = Math.floor(minEdge * 0.75) // 75% scan area
        return { width: size, height: size }
      },
      aspectRatio: 1.0,
      disableFlip: false,
      videoConstraints: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment',
        advanced: [{
          focusMode: 'continuous',
          exposureMode: 'continuous',
          whiteBalanceMode: 'continuous',
          zoom: this.currentZoom
        } as any]
      }
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
        // Silent fail for not found errors
        if (!errorMessage.includes('NotFoundException')) {
          console.debug('Scan attempt:', errorMessage)
        }
      }
    )
    
    this.isScanning = true
    console.log('Scanner started successfully')
    
    // Set up auto-focus and exposure after starting
    setTimeout(() => {
      this.optimizeCameraSettings()
    }, 500)
  }

  private async optimizeCameraSettings(): Promise<void> {
    try {
      const videoElements = document.getElementsByTagName('video')
      if (videoElements.length === 0) return
      
      const video = videoElements[0]
      const stream = video.srcObject as MediaStream
      if (!stream) return
      
      const track = stream.getVideoTracks()[0]
      if (!track) return
      
      // Apply optimal settings for QR detection
      const capabilities = track.getCapabilities ? track.getCapabilities() : {} as any
      const constraints: any = { advanced: [] }
      
      // Continuous auto-focus for better detection
      if (capabilities.focusMode) {
        constraints.advanced.push({ 
          focusMode: 'continuous',
          focusDistance: capabilities.focusDistance?.min || 0
        })
      }
      
      // Auto exposure for varying light conditions
      if (capabilities.exposureMode) {
        constraints.advanced.push({ 
          exposureMode: 'continuous'
        })
      }
      
      // Auto white balance
      if (capabilities.whiteBalanceMode) {
        constraints.advanced.push({ 
          whiteBalanceMode: 'continuous'
        })
      }
      
      // Higher ISO for better low light
      if (capabilities.iso) {
        constraints.advanced.push({ 
          iso: Math.min(800, capabilities.iso.max || 800)
        })
      }
      
      // Apply all constraints at once
      if (constraints.advanced.length > 0) {
        await track.applyConstraints(constraints)
        console.log('Camera optimized for QR detection')
      }
      
    } catch (error) {
      console.warn('Could not optimize camera:', error)
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
      this.scanner = null
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

  getZoomLevel(): number {
    return this.currentZoom
  }
}