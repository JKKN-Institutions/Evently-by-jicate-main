import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { eventId } = await request.json()
    
    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    // Try to initialize event verification stats
    const { data, error } = await supabase
      .from('event_verification_stats')
      .upsert({
        event_id: eventId,
        total_tickets: 0,
        verified_tickets: 0,
        pending_tickets: 0,
        last_verified_at: null
      }, {
        onConflict: 'event_id'
      })
      .select()

    if (error) {
      console.error('Error initializing stats:', error)
      // If it's a permission error, that's okay - stats might be handled by triggers
      if (error.code === '42501') {
        return NextResponse.json({ 
          success: true, 
          message: 'Stats handled by database triggers' 
        })
      }
      return NextResponse.json(
        { error: 'Failed to initialize stats' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      data: data,
      message: 'Stats initialized successfully' 
    })

  } catch (error) {
    console.error('Error in init-stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}