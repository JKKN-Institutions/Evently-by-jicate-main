import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bookingFormSchema } from '@/lib/validations/booking'
import { hasEventSeatAllocation, allocateSeatsForBooking } from '@/lib/seat-management'

export async function GET(request: NextRequest) {
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

    // Fetch user's bookings
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        events (
          id,
          title,
          date,
          time,
          venue,
          location,
          image_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching bookings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bookings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ bookings })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    // Check if user profile exists, if not create one
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      // Create profile if it doesn't exist
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        return NextResponse.json(
          { error: 'Failed to create user profile. Please try again.' },
          { status: 500 }
        )
      }
    }

    // Parse and validate request body
    const body = await request.json()
    console.log('Received booking data:', body)
    
    const { event_id, ...bookingData } = body
    
    let validatedData
    try {
      validatedData = bookingFormSchema.parse(bookingData)
    } catch (validationError) {
      console.error('Validation error:', validationError)
      return NextResponse.json(
        { error: 'Invalid booking data', details: validationError },
        { status: 400 }
      )
    }

    // Check if event exists and has available seats
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, price, max_attendees, current_attendees')
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    const availableSeats = event.max_attendees - event.current_attendees
    if (availableSeats < validatedData.quantity) {
      return NextResponse.json(
        { error: `Only ${availableSeats} seats available` },
        { status: 400 }
      )
    }

    // Calculate total amount
    const total_amount = event.price * validatedData.quantity

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        event_id,
        user_id: user.id,
        user_email: validatedData.user_email,
        user_name: validatedData.user_name,
        user_phone: validatedData.user_phone,
        quantity: validatedData.quantity,
        total_amount,
        payment_status: 'pending',
        booking_status: 'confirmed'
      })
      .select()
      .single()

    if (bookingError) {
      console.error('Error creating booking:', bookingError)
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      )
    }

    // Check if event has seat allocation enabled and allocate seats
    const hasSeatAllocation = await hasEventSeatAllocation(event_id)
    let allocatedSeats = []
    
    if (hasSeatAllocation) {
      try {
        console.log(`Allocating ${validatedData.quantity} seats for booking ${booking.id}`)
        allocatedSeats = await allocateSeatsForBooking(
          booking.id,
          event_id,
          validatedData.quantity
        )
        console.log(`Successfully allocated seats:`, allocatedSeats)
      } catch (seatError) {
        console.error('Error allocating seats:', seatError)
        // Don't fail the booking, but log the error
        // In production, you might want to handle this more gracefully
      }
    }

    // Update event attendee count
    const { error: updateError } = await supabase
      .from('events')
      .update({ 
        current_attendees: event.current_attendees + validatedData.quantity 
      })
      .eq('id', event_id)

    if (updateError) {
      console.error('Error updating attendee count:', updateError)
      // Note: In production, you'd want to handle this with a transaction
    }

    return NextResponse.json({ 
      booking: {
        ...booking,
        allocated_seats: allocatedSeats
      }
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid booking data', details: error },
        { status: 400 }
      )
    }
    
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
