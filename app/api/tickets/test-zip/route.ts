import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

export async function GET(request: NextRequest) {
  try {
    console.log('Test ZIP endpoint called')
    
    // Create a simple ZIP file with test content
    const zip = new JSZip()
    
    // Add some test files
    zip.file('test.txt', 'This is a test file')
    zip.file('readme.txt', 'This ZIP was generated successfully')
    
    // Create a folder with a file
    const folder = zip.folder('tickets')
    if (folder) {
      folder.file('ticket-001.txt', 'Test ticket content')
    }
    
    // Generate ZIP buffer
    console.log('Generating test ZIP...')
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
    
    console.log(`Test ZIP generated, size: ${zipBuffer.length} bytes`)
    
    // Return ZIP file
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="test.zip"',
        'Content-Length': String(zipBuffer.length)
      }
    })
    
  } catch (error: any) {
    console.error('Test ZIP error:', error)
    return NextResponse.json(
      { error: 'Failed to generate test ZIP', details: error?.message },
      { status: 500 }
    )
  }
}