import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { eventId } = await request.json()
    
    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    // Check if user is authorized (organizer or admin)
    const { data: event } = await supabase
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isOrganizer = event?.organizer_id === user.id
    const isAdmin = profile?.role === 'admin'

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to refresh stats for this event' },
        { status: 403 }
      )
    }

    // Count tickets for this event
    const { data: tickets, error: countError } = await supabase
      .from('tickets')
      .select('id, is_verified')
      .eq('event_id', eventId)

    if (countError) {
      console.error('Error counting tickets:', countError)
      return NextResponse.json(
        { error: 'Failed to count tickets' },
        { status: 500 }
      )
    }

    const totalTickets = tickets?.length || 0
    const verifiedTickets = tickets?.filter(t => t.is_verified).length || 0
    const unverifiedTickets = totalTickets - verifiedTickets

    // Try to update stats directly (without triggers)
    const { data: stats, error: statsError } = await supabase
      .from('event_verification_stats')
      .upsert({
        event_id: eventId,
        total_tickets: totalTickets,
        verified_tickets: verifiedTickets,
        unverified_tickets: unverifiedTickets,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'event_id'
      })
      .select()
      .single()

    if (statsError) {
      // If we can't update stats due to RLS, just return the calculated values
      if (statsError.code === '42501') {
        return NextResponse.json({
          success: true,
          message: 'Stats calculated (RLS prevents database update)',
          stats: {
            event_id: eventId,
            total_tickets: totalTickets,
            verified_tickets: verifiedTickets,
            unverified_tickets: unverifiedTickets,
            calculated_at: new Date().toISOString()
          }
        })
      }
      
      console.error('Error updating stats:', statsError)
      return NextResponse.json(
        { error: 'Failed to update stats' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Event stats refreshed successfully',
      stats: stats || {
        event_id: eventId,
        total_tickets: totalTickets,
        verified_tickets: verifiedTickets,
        unverified_tickets: unverifiedTickets
      }
    })

  } catch (error) {
    console.error('Error refreshing stats:', error)
    return NextResponse.json(
      { error: 'Failed to refresh stats' },
      { status: 500 }
    )
  }
}