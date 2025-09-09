// Manual QR helper for debugging and fallback
export function downloadExtractedImage(dataUrl: string, filename: string = 'extracted-pdf-page.png') {
  // Create a download link for the extracted image
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function showImageInNewTab(dataUrl: string) {
  // Open the extracted image in a new tab for inspection
  const newTab = window.open()
  if (newTab) {
    newTab.document.write(`
      <html>
        <head>
          <title>Extracted PDF Page - QR Code Scanner</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              background: #f0f0f0;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            img {
              width: 100%;
              height: auto;
              border: 1px solid #ddd;
            }
            .info {
              margin-bottom: 20px;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 4px;
            }
            .info h2 {
              margin-top: 0;
              color: #333;
            }
            .info p {
              margin: 10px 0;
              color: #666;
            }
            .actions {
              margin-top: 20px;
              display: flex;
              gap: 10px;
            }
            button {
              padding: 10px 20px;
              background: #4CAF50;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
            }
            button:hover {
              background: #45a049;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="info">
              <h2>Extracted PDF Page</h2>
              <p>The QR code scanner couldn't automatically detect a QR code in this image.</p>
              <p><strong>What you can do:</strong></p>
              <ul>
                <li>Check if there's a visible QR code in the image below</li>
                <li>If the QR code is too small, try zooming in your browser (Ctrl/Cmd + Plus)</li>
                <li>Take a screenshot of just the QR code area</li>
                <li>Use your phone camera to scan the QR code directly from this screen</li>
              </ul>
            </div>
            <div class="actions">
              <button onclick="downloadImage()">Download Image</button>
              <button onclick="window.print()">Print Page</button>
            </div>
            <img src="${dataUrl}" alt="Extracted PDF Page" id="extracted-image">
          </div>
          <script>
            function downloadImage() {
              const link = document.createElement('a');
              link.href = '${dataUrl}';
              link.download = 'pdf-page-with-qr.png';
              link.click();
            }
          </script>
        </body>
      </html>
    `)
  }
}

// Provide manual entry option
export function getManualEntryInstructions(): string {
  return `
If the QR code cannot be scanned automatically:

1. **Manual QR Scan Options:**
   - Use your phone's camera app to scan the QR code from your screen
   - Use a QR scanner app on your phone
   - Take a photo of the screen and scan it

2. **Image Preparation Tips:**
   - Zoom in on the PDF to make the QR code larger
   - Take a screenshot focusing only on the QR code
   - Ensure good lighting if photographing the screen
   - Save as PNG for best quality

3. **Alternative Methods:**
   - Copy the ticket ID/URL from the QR code manually
   - Contact support with your booking reference
  `
}