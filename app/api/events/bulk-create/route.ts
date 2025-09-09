import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { events, parentEventId, organizerId } = await request.json()

    // Validate that user is the organizer or admin
    if (user.id !== organizerId && user.user_metadata?.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to bulk upload events for this organizer' },
        { status: 403 }
      )
    }

    // Get parent event details for default values
    const { data: parentEvent } = await supabase
      .from('events')
      .select('*')
      .eq('id', parentEventId)
      .single()

    if (!parentEvent) {
      return NextResponse.json(
        { error: 'Parent event not found' },
        { status: 404 }
      )
    }

    // Process events
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const eventData of events) {
      try {
        // Validate required fields
        if (!eventData.title || !eventData.description) {
          results.failed++
          results.errors.push(`Event "${eventData.title || 'Unnamed'}" missing required fields`)
          continue
        }

        // Prepare event with defaults from parent event
        const newEvent = {
          title: eventData.title,
          description: eventData.description,
          date: eventData.date || parentEvent.date,
          time: eventData.time || parentEvent.time || '09:00',
          venue: eventData.venue || parentEvent.venue || 'TBD',
          location: eventData.location || parentEvent.location || 'TBD',
          category: eventData.category || parentEvent.category || 'other',
          price: eventData.price !== undefined ? eventData.price : parentEvent.price || 0,
          max_attendees: eventData.max_attendees || parentEvent.max_attendees || 100,
          current_attendees: 0,
          image_url: eventData.image_url || parentEvent.image_url,
          organizer_id: organizerId,
          status: 'published',
          parent_event_id: parentEventId
        }

        // Insert event
        const { error: insertError } = await supabase
          .from('events')
          .insert(newEvent)

        if (insertError) {
          results.failed++
          results.errors.push(`Failed to create "${eventData.title}": ${insertError.message}`)
        } else {
          results.success++
        }
      } catch (error) {
        results.failed++
        results.errors.push(`Error processing "${eventData.title}": ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: results.success,
      failed: results.failed,
      errors: results.errors,
      message: `Successfully created ${results.success} out of ${events.length} events`
    })

  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk upload' },
      { status: 500 }
    )
  }
}