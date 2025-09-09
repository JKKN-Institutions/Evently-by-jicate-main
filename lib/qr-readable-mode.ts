/**
 * QR Code Readable Mode - Human-readable QR code generation and display
 * This module provides functions to create QR codes with human-readable information
 */

import { TicketData, decryptTicketDataSync } from './qr-generator'

// QR Code display modes
export enum QRDisplayMode {
  ENCRYPTED = 'encrypted',    // Standard encrypted QR
  READABLE = 'readable',      // Human-readable format
  HYBRID = 'hybrid',         // Both encrypted and readable
  DEBUG = 'debug'           // Debug mode with all details
}

// Human-readable ticket format
export interface ReadableTicket {
  displayId: string          // Short display ID
  eventName?: string         // Event name if available
  ticketNumber: string       // Full ticket number
  ticketType: string        // Ticket type/category
  eventDate: string         // Event date
  venue?: string           // Venue if available
  seatInfo?: {             // Seat information if applicable
    section?: string
    row?: string
    seat?: string
  }
  validationCode?: string  // Short validation code
  qrContent?: string      // Original QR content
}

/**
 * Generate a human-readable ticket code
 */
export function generateReadableCode(ticketData: TicketData): string {
  const parts = [
    'TKT',                                          // Ticket prefix
    ticketData.eventId.substring(0, 4).toUpperCase(),   // Event ID prefix
    ticketData.ticketNumber.substring(0, 8).toUpperCase(), // Ticket number prefix
    Date.now().toString(36).substring(-4).toUpperCase()    // Timestamp suffix
  ]
  
  return parts.join('-')
}

/**
 * Convert encrypted QR data to readable format
 */
export function convertToReadable(encryptedData: string): ReadableTicket | null {
  try {
    // Decrypt the ticket data
    const ticketData = decryptTicketDataSync(encryptedData)
    
    if (!ticketData) {
      return null
    }
    
    // Create readable format
    const readable: ReadableTicket = {
      displayId: generateReadableCode(ticketData),
      ticketNumber: ticketData.ticketNumber,
      ticketType: ticketData.ticketType,
      eventDate: ticketData.eventDate,
      validationCode: ticketData.ticketId.substring(0, 8).toUpperCase(),
      qrContent: encryptedData
    }
    
    return readable
  } catch (error) {
    console.error('Error converting to readable format:', error)
    return null
  }
}

/**
 * Generate QR code with readable overlay
 */
export async function generateReadableQR(
  ticketData: TicketData,
  mode: QRDisplayMode = QRDisplayMode.HYBRID
): Promise<{ qrDataUrl: string; readableInfo: ReadableTicket }> {
  const QRCode = (await import('qrcode')).default
  
  // Generate readable info
  const readableInfo: ReadableTicket = {
    displayId: generateReadableCode(ticketData),
    ticketNumber: ticketData.ticketNumber,
    ticketType: ticketData.ticketType,
    eventDate: ticketData.eventDate,
    validationCode: ticketData.ticketId.substring(0, 8).toUpperCase()
  }
  
  let qrContent: string
  
  switch (mode) {
    case QRDisplayMode.READABLE:
      // Generate QR with human-readable JSON
      qrContent = JSON.stringify({
        t: 'EVTKT',
        id: readableInfo.displayId,
        num: ticketData.ticketNumber,
        type: ticketData.ticketType,
        date: ticketData.eventDate,
        event: ticketData.eventId.substring(0, 8)
      })
      break
      
    case QRDisplayMode.DEBUG:
      // Full debug information
      qrContent = JSON.stringify(ticketData, null, 2)
      break
      
    case QRDisplayMode.HYBRID:
      // Hybrid format with both encrypted and readable parts
      const { encryptTicketDataSync } = await import('./qr-generator')
      const encrypted = encryptTicketDataSync(ticketData)
      qrContent = JSON.stringify({
        enc: encrypted,
        readable: readableInfo.displayId
      })
      break
      
    case QRDisplayMode.ENCRYPTED:
    default:
      // Standard encrypted format
      const { encryptTicketDataSync: encrypt } = await import('./qr-generator')
      qrContent = `EVTKT:${encrypt(ticketData)}`
      break
  }
  
  // Generate QR code with optimized settings for readability
  const qrOptions = {
    errorCorrectionLevel: 'H' as const,  // High error correction for better scanning
    type: 'image/png' as const,
    quality: 1.0,
    margin: 4,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    width: 512,  // High resolution for clarity
    scale: 12
  }
  
  const qrDataUrl = await QRCode.toDataURL(qrContent, qrOptions)
  
  return {
    qrDataUrl,
    readableInfo
  }
}

/**
 * Generate HTML for displaying readable QR code
 */
export function generateReadableQRHTML(
  qrDataUrl: string,
  readableInfo: ReadableTicket,
  options?: {
    showFullDetails?: boolean
    includeInstructions?: boolean
    theme?: 'light' | 'dark'
  }
): string {
  const opts = {
    showFullDetails: false,
    includeInstructions: true,
    theme: 'light' as const,
    ...options
  }
  
  const isDark = opts.theme === 'dark'
  const bgColor = isDark ? '#1a1a1a' : '#ffffff'
  const textColor = isDark ? '#ffffff' : '#333333'
  const borderColor = isDark ? '#444444' : '#dddddd'
  const accentColor = '#0b6d41'
  
  return `
    <div style="
      background: ${bgColor};
      color: ${textColor};
      padding: 20px;
      border-radius: 12px;
      border: 2px solid ${borderColor};
      max-width: 400px;
      font-family: 'Segoe UI', system-ui, sans-serif;
    ">
      <!-- QR Code Display -->
      <div style="
        background: white;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 20px;
        text-align: center;
      ">
        <img src="${qrDataUrl}" alt="Ticket QR Code" style="
          width: 100%;
          max-width: 300px;
          height: auto;
        ">
      </div>
      
      <!-- Readable Information -->
      <div style="
        border-top: 2px solid ${accentColor};
        padding-top: 15px;
      ">
        <h3 style="
          margin: 0 0 15px 0;
          color: ${accentColor};
          font-size: 18px;
          font-weight: 600;
        ">Ticket Information</h3>
        
        <!-- Display ID -->
        <div style="
          background: ${isDark ? '#2a2a2a' : '#f5f5f5'};
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 10px;
          font-family: 'Courier New', monospace;
          font-size: 16px;
          font-weight: bold;
          text-align: center;
          letter-spacing: 1px;
        ">
          ${readableInfo.displayId}
        </div>
        
        <!-- Ticket Details -->
        <div style="font-size: 14px; line-height: 1.6;">
          <div style="margin-bottom: 8px;">
            <strong>Ticket #:</strong> ${readableInfo.ticketNumber}
          </div>
          <div style="margin-bottom: 8px;">
            <strong>Type:</strong> ${readableInfo.ticketType}
          </div>
          <div style="margin-bottom: 8px;">
            <strong>Date:</strong> ${readableInfo.eventDate}
          </div>
          ${readableInfo.venue ? `
            <div style="margin-bottom: 8px;">
              <strong>Venue:</strong> ${readableInfo.venue}
            </div>
          ` : ''}
          ${readableInfo.seatInfo ? `
            <div style="margin-bottom: 8px;">
              <strong>Seat:</strong> 
              ${readableInfo.seatInfo.section || ''} 
              ${readableInfo.seatInfo.row ? `Row ${readableInfo.seatInfo.row}` : ''} 
              ${readableInfo.seatInfo.seat ? `Seat ${readableInfo.seatInfo.seat}` : ''}
            </div>
          ` : ''}
          ${readableInfo.validationCode ? `
            <div style="
              margin-top: 12px;
              padding: 8px;
              background: ${accentColor}22;
              border-radius: 4px;
              text-align: center;
            ">
              <strong>Validation:</strong> 
              <span style="
                font-family: monospace;
                font-size: 16px;
                color: ${accentColor};
              ">${readableInfo.validationCode}</span>
            </div>
          ` : ''}
        </div>
        
        ${opts.showFullDetails && readableInfo.qrContent ? `
          <details style="margin-top: 15px;">
            <summary style="cursor: pointer; color: ${accentColor};">
              Show QR Data
            </summary>
            <pre style="
              margin-top: 10px;
              padding: 10px;
              background: ${isDark ? '#2a2a2a' : '#f5f5f5'};
              border-radius: 4px;
              font-size: 10px;
              overflow-x: auto;
              word-break: break-all;
            ">${readableInfo.qrContent.substring(0, 100)}...</pre>
          </details>
        ` : ''}
        
        ${opts.includeInstructions ? `
          <div style="
            margin-top: 20px;
            padding: 10px;
            background: ${isDark ? '#2a2a2a' : '#f9f9f9'};
            border-radius: 6px;
            font-size: 12px;
            color: ${isDark ? '#aaa' : '#666'};
          ">
            <strong>Instructions:</strong>
            <ul style="margin: 5px 0; padding-left: 20px;">
              <li>Present this QR code at the venue entrance</li>
              <li>Keep the validation code for reference</li>
              <li>Screenshot or print this ticket for backup</li>
            </ul>
          </div>
        ` : ''}
      </div>
    </div>
  `
}

/**
 * Parse and validate readable QR codes
 */
export function parseReadableQR(qrContent: string): {
  isValid: boolean
  format: 'encrypted' | 'readable' | 'hybrid' | 'unknown'
  data?: any
  error?: string
} {
  try {
    // Check for encrypted format
    if (qrContent.startsWith('EVTKT:')) {
      const encryptedData = qrContent.substring(6)
      const decrypted = decryptTicketDataSync(encryptedData)
      return {
        isValid: !!decrypted,
        format: 'encrypted',
        data: decrypted,
        error: decrypted ? undefined : 'Failed to decrypt ticket data'
      }
    }
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(qrContent)
      
      // Check for hybrid format
      if (parsed.enc && parsed.readable) {
        const decrypted = decryptTicketDataSync(parsed.enc)
        return {
          isValid: !!decrypted,
          format: 'hybrid',
          data: {
            encrypted: decrypted,
            readable: parsed.readable
          }
        }
      }
      
      // Check for readable format
      if (parsed.t === 'EVTKT' || parsed.id) {
        return {
          isValid: true,
          format: 'readable',
          data: parsed
        }
      }
      
      // Unknown JSON format
      return {
        isValid: false,
        format: 'unknown',
        data: parsed,
        error: 'Unrecognized QR format'
      }
    } catch {
      // Not JSON, treat as plain text
      return {
        isValid: false,
        format: 'unknown',
        data: qrContent,
        error: 'Invalid QR code format'
      }
    }
  } catch (error) {
    return {
      isValid: false,
      format: 'unknown',
      error: `Error parsing QR: ${error}`
    }
  }
}

/**
 * Generate a QR code verification report
 */
export function generateVerificationReport(
  qrContent: string,
  scanResult?: {
    timestamp: Date
    location?: string
    deviceInfo?: any
  }
): string {
  const parsed = parseReadableQR(qrContent)
  const scanTime = scanResult?.timestamp || new Date()
  
  const report = {
    scanTimestamp: scanTime.toISOString(),
    location: scanResult?.location || 'Unknown',
    device: scanResult?.deviceInfo || 'Unknown',
    qrValidation: {
      isValid: parsed.isValid,
      format: parsed.format,
      error: parsed.error
    },
    ticketData: parsed.data,
    recommendations: [] as string[]
  }
  
  // Add recommendations based on validation
  if (!parsed.isValid) {
    report.recommendations.push('QR code is invalid or corrupted')
    report.recommendations.push('Request a new ticket from the organizer')
  } else if (parsed.format === 'readable') {
    report.recommendations.push('QR uses readable format - verify with encrypted version for security')
  }
  
  return JSON.stringify(report, null, 2)
}

export default {
  QRDisplayMode,
  generateReadableCode,
  convertToReadable,
  generateReadableQR,
  generateReadableQRHTML,
  parseReadableQR,
  generateVerificationReport
}