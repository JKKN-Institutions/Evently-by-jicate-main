import { NextRequest, NextResponse } from 'next/server'

// This endpoint has been replaced with generate-bulk-stream for better performance
// This file acts as a redirect/proxy to maintain backward compatibility

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json()
    
    // Build the new endpoint URL
    const baseUrl = request.url.replace('/generate-bulk', '/generate-bulk-stream')
    
    // Forward the request to the new streaming endpoint
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward authentication cookies
        'Cookie': request.headers.get('cookie') || '',
        'Authorization': request.headers.get('authorization') || '',
      },
      body: JSON.stringify(body)
    })
    
    // Check if it's a successful streaming response
    if (response.ok && response.headers.get('content-type')?.includes('application/zip')) {
      // Return the streaming response directly
      const buffer = await response.arrayBuffer()
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': response.headers.get('content-disposition') || `attachment; filename="tickets-bulk-${Date.now()}.zip"`,
          'X-Generated-Count': response.headers.get('X-Generated-Count') || '0',
          'X-Failed-Count': response.headers.get('X-Failed-Count') || '0'
        }
      })
    }
    
    // If it's an error response, forward it as JSON
    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(error, { status: response.status })
    }
    
    // Default: forward the response as-is
    return response
    
  } catch (error: any) {
    console.error('Error in generate-bulk redirect:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate bulk tickets',
        details: error?.message || 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}