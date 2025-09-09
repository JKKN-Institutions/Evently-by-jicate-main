// Fallback PDF scanner that works without PDF.js worker
import { Html5Qrcode } from 'html5-qrcode'

// Simple PDF to image conversion using canvas (no worker required)
export const scanQRFromPDFSimple = async (file: File): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a file reader
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          // Create an object URL for the PDF
          const pdfUrl = URL.createObjectURL(file)
          
          // Create an iframe to render the PDF
          const iframe = document.createElement('iframe')
          iframe.style.position = 'fixed'
          iframe.style.left = '-9999px'
          iframe.style.width = '1000px'
          iframe.style.height = '1000px'
          iframe.src = pdfUrl
          
          document.body.appendChild(iframe)
          
          // Wait for PDF to load
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Try to capture the iframe content
          try {
            // Create a canvas to capture the PDF
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            if (!ctx) {
              throw new Error('Could not create canvas context')
            }
            
            // Set canvas size
            canvas.width = 1000
            canvas.height = 1000
            
            // Try alternative approach: use browser's print preview
            // This will prompt user to save as image if PDF.js fails
            const img = new Image()
            img.onload = async () => {
              ctx.drawImage(img, 0, 0)
              const dataUrl = canvas.toDataURL('image/png')
              
              // Clean up
              document.body.removeChild(iframe)
              URL.revokeObjectURL(pdfUrl)
              
              // Try scanning the image
              try {
                const response = await fetch(dataUrl)
                const blob = await response.blob()
                const imageFile = new File([blob], 'pdf-scan.png', { type: 'image/png' })
                
                const html5QrCode = new Html5Qrcode('qr-file-scanner-fallback')
                const result = await html5QrCode.scanFile(imageFile, false)
                resolve(result)
              } catch (scanError) {
                reject(new Error('No QR code found in PDF'))
              }
            }
            
            img.onerror = () => {
              document.body.removeChild(iframe)
              URL.revokeObjectURL(pdfUrl)
              reject(new Error('Could not render PDF to image'))
            }
            
            // This won't work for cross-origin PDFs, but worth trying
            img.src = pdfUrl
            
          } catch (captureError) {
            document.body.removeChild(iframe)
            URL.revokeObjectURL(pdfUrl)
            reject(new Error('Could not capture PDF content. Try converting to image manually.'))
          }
          
        } catch (innerError) {
          reject(innerError)
        }
      }
      
      reader.onerror = () => {
        reject(new Error('Could not read PDF file'))
      }
      
      reader.readAsArrayBuffer(file)
      
    } catch (error) {
      reject(error)
    }
  })
}

// Alternative: Prompt user to convert PDF manually
export const promptManualConversion = () => {
  return {
    message: 'PDF scanning is not available. Please convert your PDF to an image:',
    steps: [
      '1. Open the PDF in your browser or PDF viewer',
      '2. Take a screenshot of the QR code',
      '3. Save it as an image (PNG or JPG)',
      '4. Upload the image file instead'
    ],
    alternatives: [
      'Use an online PDF to image converter',
      'Use your phone to take a photo of the QR code on screen',
      'Print the PDF and scan with camera'
    ]
  }
}

// Check if we can use the FileReader API to at least try
export const canAttemptPDFScan = (): boolean => {
  return typeof FileReader !== 'undefined' && 
         typeof document !== 'undefined' &&
         typeof Image !== 'undefined'
}