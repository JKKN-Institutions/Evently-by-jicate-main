import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface Seat {
  id: string
  seat_number: string
  row_number?: string
  section?: string
  status: 'available' | 'reserved' | 'booked' | 'blocked'
  price_override?: number
}

export interface SeatAllocation {
  seat_id: string
  seat_number: string
  row_number?: string
  section?: string
}

/**
 * Generate seats for an event
 */
export async function generateEventSeats(
  eventId: string,
  totalSeats: number,
  layoutType: 'sequential' | 'rows' | 'sections' = 'sequential',
  sections?: Array<{ name: string; seats: number; price?: number }>,
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient || createClient()
  
  try {
    // First, create seat configuration
    const { error: configError } = await supabase
      .from('event_seat_config')
      .upsert({
        event_id: eventId,
        has_seat_allocation: true,
        total_seats: totalSeats,
        seat_layout_type: layoutType,
        sections: sections || null
      })
    
    if (configError) throw configError
    
    // Call the database function to generate seats
    const { data, error } = await supabase
      .rpc('generate_event_seats', {
        p_event_id: eventId,
        p_total_seats: totalSeats,
        p_layout_type: layoutType
      })
    
    if (error) throw error
    
    // If sections are provided, update seats with section info
    if (layoutType === 'sections' && sections) {
      let seatIndex = 0
      for (const section of sections) {
        for (let i = 0; i < section.seats; i++) {
          const { error: updateError } = await supabase
            .from('event_seats')
            .update({
              section: section.name,
              price_override: section.price
            })
            .eq('event_id', eventId)
            .eq('seat_number', (seatIndex + 1).toString())
          
          if (updateError) console.error('Error updating seat section:', updateError)
          seatIndex++
        }
      }
    }
    
    return { success: true, seatsGenerated: data }
  } catch (error) {
    console.error('Error generating seats:', error)
    return { success: false, error }
  }
}

/**
 * Allocate seats for a booking
 */
export async function allocateSeatsForBooking(
  bookingId: string,
  eventId: string,
  quantity: number,
  preferredSection?: string
): Promise<SeatAllocation[]> {
  const supabase = createClient()
  
  try {
    // If preferred section is specified, try to get seats from that section first
    let query = supabase
      .from('event_seats')
      .select('id, seat_number, row_number, section')
      .eq('event_id', eventId)
      .eq('status', 'available')
      .order('seat_number')
      .limit(quantity)
    
    if (preferredSection) {
      query = query.eq('section', preferredSection)
    }
    
    const { data: availableSeats, error: fetchError } = await query
    
    if (fetchError) throw fetchError
    
    if (!availableSeats || availableSeats.length < quantity) {
      // If not enough seats in preferred section, get any available seats
      if (preferredSection) {
        const { data: anySeats, error: anyError } = await supabase
          .from('event_seats')
          .select('id, seat_number, row_number, section')
          .eq('event_id', eventId)
          .eq('status', 'available')
          .order('seat_number')
          .limit(quantity)
        
        if (anyError) throw anyError
        if (!anySeats || anySeats.length < quantity) {
          throw new Error(`Not enough available seats. Requested: ${quantity}, Available: ${anySeats?.length || 0}`)
        }
        
        // Use any available seats
        availableSeats.length = 0
        availableSeats.push(...anySeats)
      } else {
        throw new Error(`Not enough available seats. Requested: ${quantity}, Available: ${availableSeats?.length || 0}`)
      }
    }
    
    const allocatedSeats: SeatAllocation[] = []
    
    // Allocate each seat
    for (const seat of availableSeats) {
      // Mark seat as booked
      const { error: updateError } = await supabase
        .from('event_seats')
        .update({
          status: 'booked',
          booking_id: bookingId,
          booked_at: new Date().toISOString()
        })
        .eq('id', seat.id)
      
      if (updateError) throw updateError
      
      // Add to booking_seats table
      const { error: linkError } = await supabase
        .from('booking_seats')
        .insert({
          booking_id: bookingId,
          seat_id: seat.id
        })
      
      if (linkError) throw linkError
      
      allocatedSeats.push({
        seat_id: seat.id,
        seat_number: seat.seat_number,
        row_number: seat.row_number,
        section: seat.section
      })
    }
    
    return allocatedSeats
  } catch (error) {
    console.error('Error allocating seats:', error)
    throw error
  }
}

/**
 * Get available seats for an event
 */
export async function getAvailableSeats(eventId: string): Promise<Seat[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('event_seats')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'available')
    .order('seat_number')
  
  if (error) {
    console.error('Error fetching available seats:', error)
    return []
  }
  
  return data || []
}

/**
 * Get available seats count
 */
export async function getAvailableSeatsCount(eventId: string): Promise<number> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .rpc('get_available_seats_count', {
      p_event_id: eventId
    })
  
  if (error) {
    console.error('Error getting seats count:', error)
    return 0
  }
  
  return data || 0
}

/**
 * Release seats for a cancelled booking
 */
export async function releaseBookingSeats(bookingId: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .rpc('release_booking_seats', {
        p_booking_id: bookingId
      })
    
    if (error) throw error
    
    return true
  } catch (error) {
    console.error('Error releasing seats:', error)
    return false
  }
}

/**
 * Get seats for a booking
 */
export async function getBookingSeats(bookingId: string): Promise<SeatAllocation[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('booking_seats')
    .select(`
      seat_id,
      event_seats (
        seat_number,
        row_number,
        section
      )
    `)
    .eq('booking_id', bookingId)
  
  if (error) {
    console.error('Error fetching booking seats:', error)
    return []
  }
  
  return data?.map(item => ({
    seat_id: item.seat_id,
    seat_number: item.event_seats.seat_number,
    row_number: item.event_seats.row_number,
    section: item.event_seats.section
  })) || []
}

/**
 * Check if event has seat allocation enabled
 */
export async function hasEventSeatAllocation(eventId: string): Promise<boolean> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('event_seat_config')
    .select('has_seat_allocation')
    .eq('event_id', eventId)
    .single()
  
  if (error || !data) {
    return false
  }
  
  return data.has_seat_allocation
}

/**
 * Format seat display (e.g., "A1, A2, A3" or "101-105")
 */
export function formatSeatDisplay(seats: SeatAllocation[]): string {
  if (seats.length === 0) return ''
  
  if (seats.length === 1) {
    return seats[0].seat_number
  }
  
  // Check if seats are consecutive numbers
  const numbers = seats
    .map(s => parseInt(s.seat_number))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b)
  
  if (numbers.length === seats.length) {
    // All seats are numeric
    const isConsecutive = numbers.every((num, i) => 
      i === 0 || num === numbers[i - 1] + 1
    )
    
    if (isConsecutive && numbers.length > 2) {
      return `${numbers[0]}-${numbers[numbers.length - 1]}`
    }
  }
  
  // For non-consecutive or mixed seats, list them
  if (seats.length <= 4) {
    return seats.map(s => s.seat_number).join(', ')
  }
  
  // For many seats, show first few and count
  return `${seats.slice(0, 3).map(s => s.seat_number).join(', ')}... (+${seats.length - 3} more)`
}