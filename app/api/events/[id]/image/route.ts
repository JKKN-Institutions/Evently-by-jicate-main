import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    console.log(`[Image API] Fetching image for event: ${id}`)
    
    const supabase = await createClient()

    // Get event data with image URL
    const { data: event, error } = await supabase
      .from('events')
      .select('image_url, title')
      .eq('id', id)
      .single()

    if (error) {
      console.error(`[Image API] Database error for event ${id}:`, error)
      return NextResponse.redirect(new URL('/placeholder-event.svg', request.url))
    }

    if (!event) {
      console.log(`[Image API] Event ${id} not found`)
      return NextResponse.redirect(new URL('/placeholder-event.svg', request.url))
    }

    console.log(`[Image API] Event ${id} found. Image URL:`, event.image_url ? 'exists' : 'null')

    // If event has an image_url
    if (event.image_url) {
      // Check if it's a data URL (base64)
      if (event.image_url.startsWith('data:')) {
        console.log(`[Image API] Processing base64 image for event ${id}`)
        // Parse the data URL and return as image
        const matches = event.image_url.match(/^data:(.+);base64,(.+)$/)
        if (matches) {
          const mimeType = matches[1]
          const base64Data = matches[2]
          const buffer = Buffer.from(base64Data, 'base64')
          
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=3600',
            },
          })
        }
      }
      
      // If it's a Supabase storage URL or external URL, check if it's valid
      if (event.image_url.startsWith('http')) {
        // Filter out known problematic URLs
        const lowerUrl = event.image_url.toLowerCase()
        if (lowerUrl.includes('placeholder') || 
            lowerUrl.includes('via.placeholder.com') ||
            lowerUrl.includes('400x300')) {
          console.log(`[Image API] Blocked problematic URL for event ${id}: ${event.image_url}`)
          return NextResponse.redirect(new URL('/placeholder-event.svg', request.url))
        }
        
        // Only allow Supabase storage URLs or trusted domains
        if (event.image_url.includes('supabase') || 
            event.image_url.includes('images.unsplash.com')) {
          console.log(`[Image API] Redirecting to trusted URL for event ${id}`)
          return NextResponse.redirect(event.image_url)
        }
        
        // Block other external URLs
        console.log(`[Image API] Blocked untrusted external URL for event ${id}`)
        return NextResponse.redirect(new URL('/placeholder-event.svg', request.url))
      }

      // If it's a relative path or other format
      console.log(`[Image API] Unknown image format for event ${id}: ${event.image_url.substring(0, 50)}`)
    } else {
      console.log(`[Image API] No image URL for event ${id}`)
    }

    // No image found, redirect to placeholder
    return NextResponse.redirect(new URL('/placeholder-event.svg', request.url))
    
  } catch (error) {
    console.error('[Image API] Unexpected error:', error)
    // On error, redirect to placeholder
    return NextResponse.redirect(new URL('/placeholder-event.svg', request.url))
  }
}