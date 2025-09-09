import QRCode from 'qrcode'

export interface QRPosition {
  x: number
  y: number
  size: number
}

export interface TicketQRData {
  ticketId: string
  eventId: string
  attendeeName: string
  attendeeEmail: string
  eventName: string
  eventDate: string
  venue: string
  ticketType?: string
  seatNumber?: string
}

/**
 * Generates a QR code data URL
 */
export async function generateQRCode(data: TicketQRData, size: number = 200): Promise<string> {
  try {
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(data), {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
    return qrDataUrl
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw new Error('Failed to generate QR code')
  }
}

/**
 * Overlays QR code on a ticket template using Canvas API (client-side)
 */
export async function overlayQRCodeOnTemplate(
  templateUrl: string,
  qrData: TicketQRData,
  position: QRPosition
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }

    const templateImg = new Image()
    templateImg.crossOrigin = 'anonymous'
    
    templateImg.onload = async () => {
      // Set canvas size to match template
      canvas.width = templateImg.width
      canvas.height = templateImg.height
      
      // Draw template
      ctx.drawImage(templateImg, 0, 0)
      
      try {
        // Generate QR code
        const qrDataUrl = await generateQRCode(qrData, position.size)
        
        // Draw QR code on template
        const qrImg = new Image()
        qrImg.onload = () => {
          // Add white background for QR code
          ctx.fillStyle = 'white'
          ctx.fillRect(position.x - 5, position.y - 5, position.size + 10, position.size + 10)
          
          // Draw QR code
          ctx.drawImage(qrImg, position.x, position.y, position.size, position.size)
          
          // Add subtle border around QR code
          ctx.strokeStyle = '#cccccc'
          ctx.lineWidth = 1
          ctx.strokeRect(position.x - 5, position.y - 5, position.size + 10, position.size + 10)
          
          // Convert canvas to data URL
          const resultDataUrl = canvas.toDataURL('image/png', 0.95)
          resolve(resultDataUrl)
        }
        
        qrImg.onerror = () => {
          reject(new Error('Failed to load QR code image'))
        }
        
        qrImg.src = qrDataUrl
      } catch (error) {
        reject(error)
      }
    }
    
    templateImg.onerror = () => {
      reject(new Error('Failed to load template image'))
    }
    
    templateImg.src = templateUrl
  })
}

/**
 * Adds additional ticket information text to the template
 */
export async function addTicketInfoToTemplate(
  templateUrl: string,
  ticketInfo: {
    attendeeName: string
    ticketNumber: string
    seatNumber?: string
    ticketType?: string
  },
  textPosition: { x: number; y: number },
  fontSize: number = 16
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }

    const templateImg = new Image()
    templateImg.crossOrigin = 'anonymous'
    
    templateImg.onload = () => {
      canvas.width = templateImg.width
      canvas.height = templateImg.height
      
      // Draw template
      ctx.drawImage(templateImg, 0, 0)
      
      // Configure text style
      ctx.font = `${fontSize}px 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
      ctx.fillStyle = '#333333'
      ctx.textAlign = 'left'
      
      let yOffset = textPosition.y
      const lineHeight = fontSize * 1.5
      
      // Add attendee name
      if (ticketInfo.attendeeName) {
        ctx.font = `bold ${fontSize}px 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
        ctx.fillText(`Name: ${ticketInfo.attendeeName}`, textPosition.x, yOffset)
        yOffset += lineHeight
      }
      
      // Add ticket number
      if (ticketInfo.ticketNumber) {
        ctx.font = `${fontSize * 0.9}px 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
        ctx.fillText(`Ticket: ${ticketInfo.ticketNumber}`, textPosition.x, yOffset)
        yOffset += lineHeight
      }
      
      // Add seat number if available
      if (ticketInfo.seatNumber) {
        ctx.fillText(`Seat: ${ticketInfo.seatNumber}`, textPosition.x, yOffset)
        yOffset += lineHeight
      }
      
      // Add ticket type if available
      if (ticketInfo.ticketType) {
        ctx.fillText(`Type: ${ticketInfo.ticketType}`, textPosition.x, yOffset)
      }
      
      // Convert canvas to data URL
      const resultDataUrl = canvas.toDataURL('image/png', 0.95)
      resolve(resultDataUrl)
    }
    
    templateImg.onerror = () => {
      reject(new Error('Failed to load template image'))
    }
    
    templateImg.src = templateUrl
  })
}

/**
 * Validates if a position is within template bounds
 */
export function validateQRPosition(
  position: QRPosition,
  templateWidth: number,
  templateHeight: number
): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + position.size <= templateWidth &&
    position.y + position.size <= templateHeight &&
    position.size > 0
  )
}

/**
 * Suggests optimal QR code position based on template dimensions
 */
export function suggestQRPosition(
  templateWidth: number,
  templateHeight: number
): QRPosition {
  // Default to bottom-right corner with some padding
  const size = Math.min(templateWidth, templateHeight) * 0.15 // 15% of smallest dimension
  const padding = 20
  
  return {
    x: templateWidth - size - padding,
    y: templateHeight - size - padding,
    size: Math.round(size)
  }
}