import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()

    let totalFixed = 0
    let fixedEvents: any[] = []

    // First, get ALL events to check their image URLs
    const { data: allEvents, error: allFetchError } = await supabase
      .from('events')
      .select('id, title, image_url')

    if (allFetchError) {
      return NextResponse.json({ 
        error: 'Failed to fetch events',
        details: allFetchError.message 
      }, { status: 500 })
    }

    // Filter events with problematic URLs
    const problematicEvents = allEvents?.filter(event => {
      if (!event.image_url) return false
      const url = event.image_url.toLowerCase()
      return (
        url.includes('placeholder') ||
        url.includes('via.placeholder.com') ||
        url === '/placeholder-event.jpg' ||
        url === '/placeholder-event.svg' ||
        url === '/event-placeholder.svg' ||
        url === '/event-placeholder.jpg' ||
        url.startsWith('http://via.placeholder.com') ||
        url.startsWith('https://via.placeholder.com')
      )
    }) || []

    if (problematicEvents.length > 0) {
      // Update all problematic URLs to null in batches
      for (const event of problematicEvents) {
        const { error: updateError } = await supabase
          .from('events')
          .update({ image_url: null })
          .eq('id', event.id)

        if (!updateError) {
          totalFixed++
          fixedEvents.push({ id: event.id, title: event.title, oldUrl: event.image_url })
        } else {
          console.error(`Failed to update event ${event.id}:`, updateError)
        }
      }
    }

    // Also check for any remaining external URLs that might be problematic
    const { data: externalUrlEvents, error: externalFetchError } = await supabase
      .from('events')
      .select('id, title, image_url')
      .or('image_url.ilike.%http://%,image_url.ilike.%https://%')

    if (!externalFetchError && externalUrlEvents) {
      const externalProblematic = externalUrlEvents.filter(event => {
        const url = event.image_url?.toLowerCase() || ''
        return url.includes('placeholder') || url.includes('400x300')
      })

      for (const event of externalProblematic) {
        if (!fixedEvents.find(e => e.id === event.id)) {
          const { error: updateError } = await supabase
            .from('events')
            .update({ image_url: null })
            .eq('id', event.id)

          if (!updateError) {
            totalFixed++
            fixedEvents.push({ id: event.id, title: event.title, oldUrl: event.image_url })
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Fixed ${totalFixed} events with problematic image URLs`,
      totalChecked: allEvents?.length || 0,
      fixedEvents
    })
    
  } catch (error) {
    console.error('Fix placeholder URLs error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}