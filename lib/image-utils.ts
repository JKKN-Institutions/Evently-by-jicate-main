/**
 * Image utilities for handling base64 conversion and compression
 */

export interface ImageData {
  base64: string
  mimeType: string
  size: number
}

/**
 * Compress image using canvas (client-side only)
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 800,
  quality: number = 0.8
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (event) => {
      const img = new Image()
      
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width
        let height = img.height
        
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height
          
          if (width > height) {
            width = maxWidth
            height = width / aspectRatio
          } else {
            height = maxHeight
            width = height * aspectRatio
          }
        }
        
        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        
        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height)
        
        // Convert to base64
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Could not compress image'))
              return
            }
            
            const reader = new FileReader()
            reader.onload = () => {
              const base64 = reader.result as string
              resolve({
                base64: base64.split(',')[1], // Remove data:image/jpeg;base64, prefix
                mimeType: blob.type,
                size: blob.size
              })
            }
            reader.readAsDataURL(blob)
          },
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          quality
        )
      }
      
      img.onerror = () => reject(new Error('Could not load image'))
      img.src = event.target?.result as string
    }
    
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Convert file to base64 without compression
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Create data URL from base64
 */
export function base64ToDataUrl(base64: string, mimeType: string = 'image/jpeg'): string {
  return `data:${mimeType};base64,${base64}`
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  const maxSize = 10 * 1024 * 1024 // 10MB
  
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload JPG, PNG, WebP, or GIF'
    }
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`
    }
  }
  
  return { valid: true }
}

/**
 * Generate thumbnail from base64
 */
export async function generateThumbnail(
  base64: string,
  mimeType: string,
  maxSize: number = 200
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      // Calculate thumbnail dimensions
      let width = img.width
      let height = img.height
      
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
      }
      
      // Create canvas for thumbnail
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      
      // Draw thumbnail
      ctx.drawImage(img, 0, 0, width, height)
      
      // Convert to base64
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not create thumbnail'))
            return
          }
          
          const reader = new FileReader()
          reader.onload = () => {
            const thumbnailBase64 = reader.result as string
            resolve({
              base64: thumbnailBase64.split(',')[1],
              mimeType: blob.type,
              size: blob.size
            })
          }
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        0.7 // Lower quality for thumbnails
      )
    }
    
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = base64ToDataUrl(base64, mimeType)
  })
}

/**
 * Check if base64 string is valid
 */
export function isValidBase64(str: string): boolean {
  try {
    return btoa(atob(str)) === str
  } catch (err) {
    return false
  }
}

/**
 * Get approximate size of base64 string in bytes
 */
export function getBase64Size(base64: string): number {
  // Remove any whitespace
  const cleaned = base64.replace(/\s/g, '')
  // Base64 encoding increases size by ~33%
  return Math.round(cleaned.length * 0.75)
}