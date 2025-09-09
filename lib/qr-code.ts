// Dynamic import for crypto-js to reduce initial bundle size
const getCrypto = async () => {
  const CryptoJS = await import('crypto-js')
  return CryptoJS.default
}

// Secret key for QR code encryption (in production, use environment variable)
const QR_SECRET = process.env.QR_ENCRYPTION_SECRET || 'evently-qr-secret-2024'

export interface QRCodeData {
  ticketId: string
  eventId: string
  bookingId: string
  ticketNumber: string
  timestamp: number
}

// Encrypt QR code data
export async function encryptQRData(data: QRCodeData): Promise<string> {
  const CryptoJS = await getCrypto()
  const jsonString = JSON.stringify(data)
  const encrypted = CryptoJS.AES.encrypt(jsonString, QR_SECRET).toString()
  // Make it URL safe
  return encrypted.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Decrypt QR code data
export async function decryptQRData(encryptedData: string): Promise<QRCodeData | null> {
  try {
    const CryptoJS = await getCrypto()
    // Restore the original format
    const restored = encryptedData.replace(/-/g, '+').replace(/_/g, '/')
    const decrypted = CryptoJS.AES.decrypt(restored, QR_SECRET)
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8)
    return JSON.parse(jsonString) as QRCodeData
  } catch (error) {
    console.error('Failed to decrypt QR code:', error)
    return null
  }
}

// Generate QR code URL for validation
export function generateQRValidationUrl(encryptedData: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/validate-ticket/${encryptedData}`
}

// For static QR code generation (server-side)
export async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    // Dynamic import to avoid SSR issues
    const QRCode = (await import('qrcode')).default
    return await QRCode.toDataURL(data, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw error
  }
}
