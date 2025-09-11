import { Html5Qrcode, Html5QrcodeCameraScanConfig, Html5QrcodeScannerState } from 'html5-qrcode'

export interface EnhancedScannerConfig {
  fps?: number
  qrbox?: number | { width: number; height: number }
  aspectRatio?: number
  disableFlip?: boolean
  videoConstraints?: MediaTrackConstraints
  experimentalFeatures?: {
    useBarCodeDetectorIfSupported?: boolean
  }
  formatsToSupport?: any[]
  verbose?: boolean
}

export class EnhancedQRScannerV2 {
  private scanner: Html5Qrcode | null = null
  private currentCameraId: string | null = null
  private isScanning: boolean = false
  private onSuccess: ((data: string) => void) | null = null
  private onError: ((error: string) => void) | null = null
  private retryCount: number = 0
  private maxRetries: number = 3

  constructor(private elementId: string) {}

  async getCameras(): Promise<{ id: string; label: string }[]> {
    try {
      // First, ensure we have camera permissions
      await this.requestCameraPermission()
      
      // Get available cameras
      const devices = await Html5Qrcode.getCameras()
      console.log('Available cameras:', devices)
      
      if (!devices || devices.length === 0) {
        throw new Error('No cameras found on this device')
      }
      
      return devices
    } catch (error) {
      console.error('Error getting cameras:', error)
      throw error
    }
  }

  private async requestCameraPermission(): Promise<void> {
    try {
      console.log('Requesting camera permission...')
      
      // Try to get user media to trigger permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      })
      
      console.log('Camera permission granted')
      
      // Stop the stream immediately as we just needed permissions
      stream.getTracks().forEach(track => track.stop())
    } catch (error) {
      console.error('Camera permission error:', error)
      
      // Try again with basic constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        console.log('Camera permission granted (basic)')
        stream.getTracks().forEach(track => track.stop())
      } catch (fallbackError) {
        console.error('Camera permission denied or not available:', fallbackError)
        throw new Error('Camera access denied. Please check your browser permissions.')
      }
    }
  }

  private async selectBestCamera(cameras: { id: string; label: string }[]): Promise<string> {
    console.log('Selecting best camera from:', cameras)
    
    // Prefer back/rear camera for mobile devices
    const backCamera = cameras.find(camera => {
      const label = camera.label.toLowerCase()
      return label.includes('back') || 
             label.includes('rear') || 
             label.includes('environment') ||
             label.includes('facing back')
    })
    
    if (backCamera) {
      console.log('Selected back camera:', backCamera.label)
      return backCamera.id
    }
    
    // If no back camera found, use the first available camera
    console.log('No back camera found, using:', cameras[0].label)
    return cameras[0].id
  }

  async start(
    onSuccess: (decodedText: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    this.onSuccess = onSuccess
    this.onError = onError
    
    try {
      console.log('Starting enhanced QR scanner...')
      
      // Clean up any existing scanner
      await this.cleanup()
      
      // Get cameras with proper permission handling
      const cameras = await this.getCameras()
      const cameraId = await this.selectBestCamera(cameras)
      this.currentCameraId = cameraId
      
      // Create scanner instance
      this.scanner = new Html5Qrcode(this.elementId, {
        verbose: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      } as any)
      
      // Configure scanner with enhanced settings
      const config: Html5QrcodeCameraScanConfig = {
        fps: 10, // Start with lower FPS for better compatibility
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
          const size = Math.floor(minEdge * 0.7)
          return { width: size, height: size }
        },
        aspectRatio: 1.0,
        disableFlip: false,
        videoConstraints: {
          facingMode: 'environment',
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 }
        } as MediaTrackConstraints
      }
      
      console.log('Starting camera with config:', config)
      
      // Start scanning with retry logic
      await this.startWithRetry(cameraId, config)
      
      this.isScanning = true
      console.log('Scanner started successfully')
      
    } catch (error) {
      console.error('Failed to start scanner:', error)
      this.handleStartError(error)
    }
  }

  private async startWithRetry(
    cameraId: string,
    config: Html5QrcodeCameraScanConfig
  ): Promise<void> {
    try {
      await this.scanner!.start(
        cameraId,
        config,
        (decodedText) => {
          console.log('QR Code detected:', decodedText)
          this.onSuccess?.(decodedText)
        },
        (errorMessage) => {
          // Silent fail for QR not found errors
          if (!errorMessage.includes('NotFoundException')) {
            console.log('Scan error:', errorMessage)
          }
        }
      )
    } catch (error) {
      console.error(`Start attempt ${this.retryCount + 1} failed:`, error)
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        console.log(`Retrying with fallback config (attempt ${this.retryCount})...`)
        
        // Try with simpler config
        const fallbackConfig: Html5QrcodeCameraScanConfig = {
          fps: 10,
          qrbox: 250 // Fixed size box
        }
        
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 500))
        
        return this.startWithRetry(cameraId, fallbackConfig)
      }
      
      throw error
    }
  }

  private handleStartError(error: any): void {
    let errorMessage = 'Failed to start camera'
    
    if (error instanceof Error) {
      if (error.message.includes('NotAllowedError')) {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.'
      } else if (error.message.includes('NotFoundError')) {
        errorMessage = 'No camera found. Please ensure your device has a camera.'
      } else if (error.message.includes('NotReadableError')) {
        errorMessage = 'Camera is in use by another application. Please close other apps using the camera.'
      } else if (error.message.includes('OverconstrainedError')) {
        errorMessage = 'Camera does not support the required resolution. Trying with default settings...'
      } else {
        errorMessage = error.message
      }
    }
    
    console.error('Scanner error:', errorMessage)
    this.onError?.(errorMessage)
  }

  async stop(): Promise<void> {
    if (!this.scanner || !this.isScanning) {
      return
    }
    
    try {
      const state = this.scanner.getState()
      if (state === Html5QrcodeScannerState.SCANNING) {
        await this.scanner.stop()
        console.log('Scanner stopped')
      }
    } catch (error) {
      console.error('Error stopping scanner:', error)
    } finally {
      this.isScanning = false
      this.retryCount = 0
    }
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

  async restart(): Promise<void> {
    console.log('Restarting scanner...')
    await this.stop()
    await new Promise(resolve => setTimeout(resolve, 500))
    if (this.onSuccess) {
      await this.start(this.onSuccess, this.onError || undefined)
    }
  }

  isActive(): boolean {
    return this.isScanning
  }

  getCurrentCamera(): string | null {
    return this.currentCameraId
  }
}