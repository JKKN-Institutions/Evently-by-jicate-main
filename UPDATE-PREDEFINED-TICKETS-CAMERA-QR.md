# Update Instructions for Camera-Optimized QR in Predefined Tickets Page

To make the QR codes camera-readable in the `/admin/predefined-tickets` page, make these changes:

## 1. Add Import at Top of File
Add this import after the existing imports (around line 9):
```typescript
import { generateBestQRForCamera, calculateQRReadabilityScore } from '@/lib/qr-camera-optimized'
```

## 2. Update generatePreviewWithQR Function
Replace the QR generation section in the `generatePreviewWithQR` function (around lines 284-308) with:

```typescript
  const generatePreviewWithQR = async (templateUrl: string, position: typeof qrPosition, ticketData?: any) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    // Load template image
    const img = new Image()
    img.src = templateUrl
    await new Promise(resolve => img.onload = resolve)

    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)

    // Generate CAMERA-OPTIMIZED QR code
    const ticketNumber = ticketData?.ticketNumber || generateTicketNumber(selectedEventId || 'SAMPLE')
    const eventId = selectedEventId || 'SAMPLE-EVENT'
    
    // Use camera-optimized QR generation for better scanning
    const { qrDataUrl, readabilityScore, qrContent } = await generateBestQRForCamera(
      ticketNumber,
      eventId,
      { preferFormat: 'simple' }
    )
    
    console.log('Preview QR Readability Score:', readabilityScore)
    console.log('Preview QR Content:', qrContent)

    // Add white background padding for QR code (more padding for camera readability)
    const padding = 15
    ctx.fillStyle = 'white'
    ctx.fillRect(position.x - padding, position.y - padding, position.size + (padding * 2), position.size + (padding * 2))
    
    // Add black border for contrast
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 2
    ctx.strokeRect(position.x - padding, position.y - padding, position.size + (padding * 2), position.size + (padding * 2))

    // Draw QR code on template
    const qrImg = new Image()
    qrImg.src = qrDataUrl
    await new Promise(resolve => qrImg.onload = resolve)
    
    ctx.drawImage(qrImg, position.x, position.y, position.size, position.size)

    return canvas.toDataURL()
  }
```

## 3. Update Client-Side QR Composition
In the `generateTicketWithTemplate` function, update the QR drawing section (around lines 433-438) with:

```typescript
// Draw white background padding for better camera scanning
const padding = 15 // More padding for camera readability
ctx.fillStyle = 'white'
ctx.fillRect(
  qrPos.x - padding, 
  qrPos.y - padding, 
  qrPos.size + (padding * 2), 
  qrPos.size + (padding * 2)
)

// Draw black border for contrast
ctx.strokeStyle = 'black'
ctx.lineWidth = 2
ctx.strokeRect(
  qrPos.x - padding, 
  qrPos.y - padding, 
  qrPos.size + (padding * 2), 
  qrPos.size + (padding * 2)
)

// Draw QR at exact position
ctx.drawImage(qrImg, qrPos.x, qrPos.y, qrPos.size, qrPos.size)
```

## 4. Update Generate Button Text
Update the "Generate with QR" button text (around line 1091-1093) to indicate camera optimization:

```typescript
<button
  type="button"
  onClick={async () => {
    // ... existing onClick code ...
    console.log('Generating CAMERA-OPTIMIZED QR at position:', qrPosition)
    // ... rest of code ...
  }}
  className="mt-4 w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
  disabled={!selectedEventId}
>
  <QrCode className="h-5 w-5 mr-2" />
  Generate Camera-Readable PDF ({qrPosition.x}, {qrPosition.y})
</button>
<p className="text-xs text-green-600 mt-2 text-center">
  ✓ QR codes are optimized for phone camera scanning
</p>
```

## Benefits of These Changes

1. **Simple QR Format**: Uses JSON with only essential data (< 50 characters)
2. **Better Contrast**: White padding with black border around QR
3. **Optimized Settings**: Lower error correction level for less dense QR codes
4. **Readability Score**: Logs the QR readability score (should be > 75)
5. **Camera-Friendly**: Works with all phone camera apps without special QR scanners

## Testing

After applying these changes:
1. Generate a predefined ticket
2. Check console for "QR Readability Score" (should be 90+)
3. Test scanning with phone camera app
4. QR should scan instantly without issues

## Important Notes

- The QR content is now simple JSON: `{"t":"TICKET123","e":"EVENT456","v":"VERIFY89"}`
- This is much shorter than encrypted data (was 500+ chars, now < 50)
- All phone cameras can read this format
- Verification still works through the `/api/tickets/verify-camera-qr` endpoint