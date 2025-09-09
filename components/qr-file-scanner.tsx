'use client'


import { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Upload, Image as ImageIcon, AlertCircle, FileText, Download, ExternalLink } from 'lucide-react'
import { extractImageFromPDF, isPDFProcessingSupported, initializePDFWorker } from '@/lib/pdf-utils'
import { enhancedQRScan } from '@/lib/enhanced-qr-scanner'
import { showImageInNewTab, getManualEntryInstructions } from '@/lib/qr-manual-helper'
import { extractQRFromAllPositions, visualizeQRRegions } from '@/lib/pdf-qr-extractor'


interface QRFileScannerProps {
  onScan: (result: string) => void
}

export default function QRFileScanner({ onScan }: QRFileScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const [pdfSupported, setPdfSupported] = useState(true)
  const [scanProgress, setScanProgress] = useState<string | null>(null)
  const [extractedImage, setExtractedImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    // Initialize PDF worker and check support
    initializePDFWorker()
    setPdfSupported(isPDFProcessingSupported())
  }, [])


  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type - accept both images and PDFs
    const isImage = file.type.startsWith('image/')
    const isPDF = file.type === 'application/pdf'
    
    if (!isImage && !isPDF) {

      setError(pdfSupported ? 'Please select an image file (PNG, JPG) or PDF' : 'Please select an image file (PNG, JPG)')
      return
    }
    
    if (isPDF && !pdfSupported) {
      setError('PDF processing is not supported in this browser. Please convert to image first.')

      return
    }

    try {
      setError(null)
      setIsScanning(true)

      if (isPDF) {

        // Handle PDF files using the robust utility
        setPreview('pdf') // Special preview state for PDFs
        
        try {
          // First try position-based extraction for known QR locations
          setScanProgress('Checking known QR code positions (40,275)...')
          console.log('Attempting position-based QR extraction...')
          let result = await extractQRFromAllPositions(file)
          
          if (!result) {
            // If position-based fails, try full page extraction
            setScanProgress('Extracting full page from PDF...')
            const imageDataUrl = await extractImageFromPDF(file)
            
            if (!imageDataUrl) {
              throw new Error('Could not extract image from PDF')
            }
            
            // Create a blob from the data URL for scanning
            setScanProgress('Preparing image for scanning...')
            const response = await fetch(imageDataUrl)
            const blob = await response.blob()
            const imageFile = new File([blob], 'pdf-page.png', { type: 'image/png' })
            
            // Try enhanced scanning for small/corner QR codes
            setScanProgress('Scanning for QR codes (checking all regions)...')
            console.log('Attempting enhanced QR scanning for PDF...')
            result = await enhancedQRScan(imageFile)
            
            // Fallback to standard scanning if enhanced fails
            if (!result) {
              setScanProgress('Trying alternative scanning method...')
              console.log('Enhanced scan failed, trying standard scan...')
              const html5QrCode = new Html5Qrcode('qr-file-scanner')
              result = await html5QrCode.scanFile(imageFile, false)
            }
            
            if (!result) {
              // Save the extracted image for manual fallback
              setExtractedImage(imageDataUrl)
              
              // Also create a visualization of QR regions for debugging
              try {
                const debugImage = await visualizeQRRegions(file)
                console.log('Debug visualization created - check red boxes for QR locations')
              } catch (err) {
                console.error('Could not create debug visualization:', err)
              }
              
              throw new Error('No QR code found in PDF. The QR code might be too small or at position (40,275).')
            }
          }
          
          setScanProgress(null)
          setExtractedImage(null)
          console.log('QR Code decoded from PDF:', result)
          onScan(result)
        } catch (pdfError) {
          console.error('PDF processing error:', pdfError)
          if (pdfError instanceof Error) {
            if (pdfError.message.includes('worker')) {
              setError('PDF processing failed. Please try refreshing the page or convert the PDF to an image (PNG/JPG) first.')
            } else {
              throw new Error(pdfError.message)
            }
          } else {
            throw new Error('Could not process PDF file. Please convert it to an image.')
          }

        }
      } else {
        // Handle image files as before
        const reader = new FileReader()
        reader.onload = (e) => {
          setPreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)


        // Try enhanced scanning first for small/corner QR codes
        setScanProgress('Scanning for QR codes (checking all regions)...')
        console.log('Attempting enhanced QR scanning for image...')
        let result = await enhancedQRScan(file)
        
        // Fallback to standard scanning if enhanced fails
        if (!result) {
          setScanProgress('Trying alternative scanning method...')
          console.log('Enhanced scan failed, trying standard scan...')
          const html5QrCode = new Html5Qrcode('qr-file-scanner')
          result = await html5QrCode.scanFile(file, false)
        }
        
        if (!result) {
          throw new Error('No QR code found. The QR code might be too small, in a corner, or unclear.')
        }
        
        setScanProgress(null)

        console.log('QR Code decoded from image:', result)
        onScan(result)
      }
      
      // Reset after successful scan
      setPreview(null)
      setIsScanning(false)

      setScanProgress(null)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Error scanning QR from file:', err)

      setScanProgress(null)
      if (err instanceof Error && err.message.includes('PDF')) {
        setError(err.message)
      } else {
        setError('No QR code found in the file. Please ensure the QR code is clear and try another image or PDF.')
      }

      setIsScanning(false)
    }
  }




  return (
    <div className="w-full">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
        <input
          ref={fileInputRef}
          type="file"

          accept={pdfSupported ? "image/*,application/pdf" : "image/*"}

          onChange={handleFileSelect}
          className="hidden"
          id="qr-file-input"
        />
        
        <label
          htmlFor="qr-file-input"
          className="cursor-pointer block"
        >
          {preview ? (
            <div>
              {preview === 'pdf' ? (
                <div className="flex flex-col items-center">
                  <FileText className="h-16 w-16 text-blue-500 mb-2" />
                  <p className="text-sm font-medium text-gray-700">Processing PDF...</p>
                </div>
              ) : (
                <img 
                  src={preview} 
                  alt="QR Code preview" 
                  className="max-w-full h-48 mx-auto rounded-lg object-contain"
                />
              )}
              <p className="mt-4 text-sm text-gray-600">

                {scanProgress || (isScanning ? 'Scanning QR code...' : 'Click to select another file')}
              </p>
              {scanProgress && (
                <div className="mt-2">
                  <div className="animate-pulse flex space-x-1 justify-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animation-delay-200"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animation-delay-400"></div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div>
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm font-medium text-gray-900">
                Upload QR Code File
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Click to select or drag and drop
              </p>
              <p className="mt-1 text-xs text-gray-500">

                Supports: PNG, JPG{pdfSupported ? ', PDF' : ''} (up to 10MB)

              </p>
            </div>
          )}
        </label>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />

            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
              {(error.includes('PDF') || error.includes('QR code')) && (
                <div className="mt-2 text-xs text-red-600">
                  <p className="font-semibold mb-1">Tips for better scanning:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {error.includes('small') && (
                      <>
                        <li>Zoom in on the QR code and take a screenshot</li>
                        <li>Crop the image to focus on the QR code area</li>
                      </>
                    )}
                    <li>Ensure the QR code is clear and not blurry</li>
                    <li>Try taking a photo with better lighting</li>
                    <li>Use your phone camera to scan directly from screen</li>
                    {error.includes('PDF') && (
                      <>
                        <li>Convert PDF to high-resolution image (300 DPI or higher)</li>
                        <li>Export PDF page as PNG/JPG from your PDF viewer</li>
                      </>
                    )}
                  </ul>
                  {extractedImage && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="font-semibold mb-2">Manual Options:</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => showImageInNewTab(extractedImage)}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Extracted Page
                        </button>
                        <button
                          onClick={() => {
                            const link = document.createElement('a')
                            link.href = extractedImage
                            link.download = 'pdf-page.png'
                            link.click()
                          }}
                          className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                        >
                          <Download className="h-3 w-3" />
                          Download Image
                        </button>
                      </div>
                      <p className="text-xs mt-2 text-gray-600">
                        Click "View Extracted Page" to see the PDF page and scan the QR code with your phone
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}


      {/* Hidden divs for QR scanners */}
      <div id="qr-file-scanner" style={{ display: 'none' }}></div>
      <div id="qr-file-scanner-advanced" style={{ display: 'none' }}></div>
      <div id="qr-file-scanner-contrast" style={{ display: 'none' }}></div>
      <div id="qr-file-scanner-crop" style={{ display: 'none' }}></div>
      <div id="qr-file-scanner-position" style={{ display: 'none' }}></div>
      <div id="qr-file-scanner-fallback" style={{ display: 'none' }}></div>

    </div>
  )
}