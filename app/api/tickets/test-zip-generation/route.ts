import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

export async function GET(request: NextRequest) {
  try {
    // Create a simple test ZIP
    const zip = new JSZip()
    
    // Add test files
    zip.file('test.txt', 'This is a test file')
    zip.file('manifest.json', JSON.stringify({
      test: true,
      timestamp: new Date().toISOString(),
      message: 'ZIP generation test'
    }, null, 2))
    
    // Generate ZIP as base64
    const zipBase64 = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
    
    // Convert to buffer
    const zipBuffer = Buffer.from(zipBase64, 'base64')
    
    console.log('Test ZIP generated:', {
      size: zipBuffer.length,
      base64Length: zipBase64.length
    })
    
    // Return ZIP file
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="test.zip"',
        'Content-Length': zipBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Test ZIP generation failed:', error)
    return NextResponse.json({
      error: 'Failed to generate test ZIP',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}