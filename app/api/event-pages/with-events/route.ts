import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get query params
    const searchParams = request.nextUrl.searchParams
    const includeEmpty = searchParams.get('includeEmpty') === 'true'
    
    // First, let's fetch all event pages
    console.log('Fetching event pages...')
    const { data: eventPages, error: pagesError } = await supabase
      .from('event_pages')
      .select('*')
      .eq('status', 'published')
      .order('start_date', { ascending: true })
    
    if (pagesError) {
      console.error('Error fetching event pages:', pagesError)
      return NextResponse.json(
        { error: 'Failed to fetch event pages', details: pagesError },
        { status: 500 }
      )
    }

    console.log(`Found ${eventPages?.length || 0} published event pages`)

    // Now fetch events for each page
    const pagesWithEvents = []
    for (const page of eventPages || []) {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('event_page_id', page.id)
        .eq('status', 'published')
        .order('start_date', { ascending: true })
      
      if (eventsError) {
        console.error(`Error fetching events for page ${page.id}:`, eventsError)
        continue
      }

      console.log(`Page "${page.title}" has ${events?.length || 0} events`)
      
      pagesWithEvents.push({
        ...page,
        events: events || []
      })
    }

    // Filter to only include pages with events (based on query param)
    const filteredPages = includeEmpty 
      ? pagesWithEvents 
      : pagesWithEvents.filter(page => page.events && page.events.length > 0)

    // Transform data for frontend
    const transformedPages = filteredPages.map(page => ({
      id: page.id,
      title: page.title,
      slug: page.slug, // Add slug field for sharing functionality
      description: page.description,
      banner_image: page.banner_image,
      location: page.location,
      start_date: page.start_date,
      end_date: page.end_date,
      event_count: page.events?.length || 0,
      events: page.events || []
    }))

    console.log(`Returning ${transformedPages.length} event pages with events`)

    return NextResponse.json({ 
      eventPages: transformedPages,
      total: transformedPages.length
    })
    
  } catch (error) {
    console.error('Error in event pages API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}