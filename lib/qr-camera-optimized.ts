/**
 * Camera-Optimized QR Code Generation
 * Generates simple, camera-readable QR codes with minimal data
 */

import QRCode from 'qrcode'

export interface SimplifiedQRData {
  t: string;    // Ticket number (short)
  e: string;    // Event ID (first 8 chars)
  v: string;    // Verification code (8 chars)
}

/**
 * Generate a simple, camera-readable QR code
 * Uses minimal data to ensure camera readability
 */
export async function generateCameraOptimizedQR(
  ticketNumber: string,
  eventId: string,
  verificationCode?: string
): Promise<{ qrDataUrl: string; qrBuffer: Buffer; qrContent: string }> {
  
  // Create simplified data structure (much shorter than encrypted)
  const simplifiedData: SimplifiedQRData = {
    t: ticketNumber.substring(0, 12), // Limit ticket number length
    e: eventId.substring(0, 8),       // First 8 chars of event ID
    v: verificationCode || generateVerificationCode()
  }
  
  // Convert to compact JSON string (no spaces)
  const qrContent = JSON.stringify(simplifiedData)
  
  console.log('QR Content Length:', qrContent.length, 'characters')
  console.log('QR Content:', qrContent)
  
  // Optimal QR settings for camera scanning
  const qrOptions = {
    errorCorrectionLevel: 'L' as const,  // Low correction = less dense QR
    type: 'image/png' as const,
    quality: 1.0,
    margin: 2,                           // Adequate white border
    color: {
      dark: '#000000',                   // Pure black
      light: '#FFFFFF'                   // Pure white for maximum contrast
    },
    width: 250,                          // Optimal size for cameras
    scale: 8                             // Good resolution
  }
  
  try {
    // Generate QR as data URL
    const qrDataUrl = await QRCode.toDataURL(qrContent, qrOptions)
    
    // Generate QR as buffer for overlaying
    const qrBuffer = await QRCode.toBuffer(qrContent, {
      ...qrOptions,
      type: 'png' as const
    })
    
    return {
      qrDataUrl,
      qrBuffer,
      qrContent
    }
  } catch (error) {
    console.error('Error generating camera-optimized QR:', error)
    throw new Error('Failed to generate camera-readable QR code')
  }
}

/**
 * Generate URL-based QR code (shortest possible)
 * URLs are often better recognized by camera apps
 */
export async function generateURLBasedQR(
  ticketNumber: string,
  baseUrl?: string
): Promise<{ qrDataUrl: string; qrBuffer: Buffer; qrContent: string }> {
  
  // Use a short URL format
  const url = baseUrl || 'https://evently.app'
  const shortTicketId = ticketNumber.replace(/[^A-Z0-9]/gi, '').substring(0, 10)
  const qrContent = `${url}/t/${shortTicketId}`
  
  console.log('URL QR Length:', qrContent.length, 'characters')
  console.log('URL QR Content:', qrContent)
  
  // Settings optimized for URL QR codes
  const qrOptions = {
    errorCorrectionLevel: 'M' as const,  // Medium correction for URLs
    type: 'image/png' as const,
    quality: 1.0,
    margin: 3,                           // Larger margin for URL QRs
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    width: 300,                          // Slightly larger for URLs
    scale: 10
  }
  
  const qrDataUrl = await QRCode.toDataURL(qrContent, qrOptions)
  const qrBuffer = await QRCode.toBuffer(qrContent, {
    ...qrOptions,
    type: 'png' as const
  })
  
  return {
    qrDataUrl,
    qrBuffer,
    qrContent
  }
}

/**
 * Generate numeric-only QR code (easiest for cameras)
 * Pure numeric QR codes are the most reliable for camera scanning
 */
export async function generateNumericQR(
  ticketNumber: string
): Promise<{ qrDataUrl: string; qrBuffer: Buffer; qrContent: string }> {
  
  // Extract only numbers from ticket number
  const numericPart = ticketNumber.replace(/\D/g, '')
  
  // Ensure we have a valid numeric string
  const qrContent = numericPart.length > 0 
    ? numericPart.substring(0, 20)  // Limit to 20 digits
    : Date.now().toString()          // Fallback to timestamp
  
  console.log('Numeric QR Length:', qrContent.length, 'digits')
  console.log('Numeric QR Content:', qrContent)
  
  // Optimal settings for numeric QR codes
  const qrOptions = {
    errorCorrectionLevel: 'L' as const,  // Lowest correction for numeric
    type: 'image/png' as const,
    quality: 1.0,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    width: 200,                          // Smaller size works for numeric
    scale: 6
  }
  
  const qrDataUrl = await QRCode.toDataURL(qrContent, qrOptions)
  const qrBuffer = await QRCode.toBuffer(qrContent, {
    ...qrOptions,
    type: 'png' as const
  })
  
  return {
    qrDataUrl,
    qrBuffer,
    qrContent
  }
}

/**
 * Generate a verification code
 */
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Test QR readability score
 * Returns a score from 0-100 indicating how readable the QR is
 */
export function calculateQRReadabilityScore(qrContent: string): {
  score: number;
  factors: {
    length: number;
    complexity: number;
    format: number;
  };
  recommendation: string;
} {
  let score = 100
  const factors = {
    length: 0,
    complexity: 0,
    format: 0
  }
  
  // Factor 1: Content length (shorter is better)
  if (qrContent.length < 50) {
    factors.length = 100
  } else if (qrContent.length < 100) {
    factors.length = 80
  } else if (qrContent.length < 200) {
    factors.length = 60
  } else if (qrContent.length < 500) {
    factors.length = 40
  } else {
    factors.length = 20
  }
  
  // Factor 2: Character complexity
  const hasSpecialChars = /[^A-Za-z0-9:\/\-.]/.test(qrContent)
  const isNumericOnly = /^\d+$/.test(qrContent)
  const isAlphanumeric = /^[A-Za-z0-9]+$/.test(qrContent)
  
  if (isNumericOnly) {
    factors.complexity = 100  // Best for cameras
  } else if (isAlphanumeric) {
    factors.complexity = 90
  } else if (!hasSpecialChars) {
    factors.complexity = 70
  } else {
    factors.complexity = 50
  }
  
  // Factor 3: Format (URL, JSON, etc.)
  if (qrContent.startsWith('http')) {
    factors.format = 95  // URLs are well recognized
  } else if (isNumericOnly) {
    factors.format = 100  // Pure numeric is best
  } else if (qrContent.startsWith('{') && qrContent.endsWith('}')) {
    factors.format = 60  // JSON is okay but not ideal
  } else {
    factors.format = 70
  }
  
  // Calculate weighted score
  score = (factors.length * 0.4 + factors.complexity * 0.3 + factors.format * 0.3)
  
  // Generate recommendation
  let recommendation = ''
  if (score >= 90) {
    recommendation = 'Excellent - Highly readable by cameras'
  } else if (score >= 75) {
    recommendation = 'Good - Should work with most cameras'
  } else if (score >= 60) {
    recommendation = 'Fair - May have issues with some cameras'
  } else {
    recommendation = 'Poor - Consider simplifying the QR content'
  }
  
  return {
    score: Math.round(score),
    factors,
    recommendation
  }
}

/**
 * Generate the most camera-friendly QR based on input
 */
export async function generateBestQRForCamera(
  ticketNumber: string,
  eventId: string,
  options?: {
    preferFormat?: 'simple' | 'url' | 'numeric';
    baseUrl?: string;
  }
): Promise<{
  qrDataUrl: string;
  qrBuffer: Buffer;
  qrContent: string;
  format: string;
  readabilityScore: number;
}> {
  
  const format = options?.preferFormat || 'simple'
  let result
  
  switch (format) {
    case 'numeric':
      result = await generateNumericQR(ticketNumber)
      break
    case 'url':
      result = await generateURLBasedQR(ticketNumber, options?.baseUrl)
      break
    case 'simple':
    default:
      const verificationCode = generateVerificationCode()
      result = await generateCameraOptimizedQR(ticketNumber, eventId, verificationCode)
      break
  }
  
  const readability = calculateQRReadabilityScore(result.qrContent)
  
  console.log('QR Readability Score:', readability.score)
  console.log('Recommendation:', readability.recommendation)
  
  return {
    ...result,
    format,
    readabilityScore: readability.score
  }
}