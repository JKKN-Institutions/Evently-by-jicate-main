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

    if (error || !event) {
      console.log(`[Image API] Event ${id} not found or error:`, error)
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" fill="none">
        <rect width="400" height="300" fill="#F3F4F6"/>
        <rect x="150" y="100" width="100" height="100" rx="10" fill="#E5E7EB"/>
        <circle cx="200" cy="150" r="30" stroke="#9CA3AF" stroke-width="2" fill="none"/>
        <text x="200" y="220" text-anchor="middle" fill="#6B7280" font-family="Arial" font-size="14">Event</text>
      </svg>`
      
      return new NextResponse(placeholderSvg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    console.log(`[Image API] Event ${id} found. Image URL:`, event.image_url ? 'exists' : 'null')
    
    // If there's a stored image_url path, use it directly
    if (event.image_url && event.image_url.startsWith('event-images/')) {
      // It's a storage path, generate public URL
      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(event.image_url.replace('event-images/', ''))
      
      if (publicUrl) {
        console.log(`[Image API] Using storage path from database: ${event.image_url}`)
        return NextResponse.redirect(publicUrl)
      }
    }

    // If event has an image_url in database
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
      console.log(`[Image API] No image URL in database and no image in storage bucket for event ${id}`)
    }

    // No image found, return placeholder image directly
    const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" fill="none">
      <rect width="400" height="300" fill="#F3F4F6"/>
      <path d="M170 110h60v80h-60z" fill="#E5E7EB"/>
      <path d="M190 130h20v40h-20z" fill="#9CA3AF"/>
      <circle cx="200" cy="150" r="30" stroke="#9CA3AF" stroke-width="2" fill="none"/>
      <text x="200" y="220" text-anchor="middle" fill="#6B7280" font-family="Arial" font-size="14">Event</text>
    </svg>`
    
    return new NextResponse(placeholderSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    })
    
  } catch (error) {
    console.error('[Image API] Unexpected error:', error)
    // On error, return placeholder SVG
    const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" fill="none">
      <rect width="400" height="300" fill="#F3F4F6"/>
      <path d="M170 110h60v80h-60z" fill="#E5E7EB"/>
      <circle cx="200" cy="150" r="30" stroke="#9CA3AF" stroke-width="2" fill="none"/>
      <text x="200" y="220" text-anchor="middle" fill="#6B7280" font-family="Arial" font-size="14">Event</text>
    </svg>`
    
    return new NextResponse(placeholderSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }
}