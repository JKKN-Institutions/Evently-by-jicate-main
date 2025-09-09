import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { encryptQRData, type QRCodeData } from '@/lib/qr-code'

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

    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      bookingId,
      paymentId 
    } = await request.json()

    // Log payment attempt (only if paymentId exists)
    if (paymentId) {
      try {
        await supabase
          .from('payment_logs')
          .insert({
            payment_id: paymentId,
            booking_id: bookingId,
            event_type: 'payment_verification_attempt',
            event_data: {
              order_id: razorpay_order_id,
              payment_id: razorpay_payment_id
            }
          })
      } catch (error) {
        console.log('Payment logs table may not be set up yet')
      }
    }

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(sign)
      .digest('hex')

    const isAuthentic = expectedSign === razorpay_signature

    if (!isAuthentic) {
      // Update payment record with failure (only if paymentId exists)
      if (paymentId) {
        try {
          await supabase
            .from('payments')
            .update({
              status: 'failed',
              error_code: 'SIGNATURE_MISMATCH',
              error_description: 'Payment signature verification failed',
              razorpay_payment_id: razorpay_payment_id
            })
            .eq('id', paymentId)

          // Log failure
          await supabase
            .from('payment_logs')
            .insert({
              payment_id: paymentId,
              booking_id: bookingId,
              event_type: 'payment_verification_failed',
              event_data: {
                reason: 'Invalid signature',
                provided_signature: razorpay_signature,
                expected_signature: expectedSign
              }
            })
        } catch (error) {
          console.log('Payment tracking tables may not be set up yet')
        }
      }

      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      )
    }

    // Update payment record with success (only if paymentId exists)
    if (paymentId) {
      try {
        const { data: payment, error: paymentUpdateError } = await supabase
          .from('payments')
          .update({
            status: 'captured',
            razorpay_payment_id: razorpay_payment_id,
            razorpay_signature: razorpay_signature
          })
          .eq('id', paymentId)
          .select()
          .single()

        if (paymentUpdateError) {
          console.error('Error updating payment:', paymentUpdateError)
        }

        // Log success
        await supabase
          .from('payment_logs')
          .insert({
            payment_id: paymentId,
            booking_id: bookingId,
            event_type: 'payment_captured',
            event_data: {
              order_id: razorpay_order_id,
              payment_id: razorpay_payment_id
            }
          })
      } catch (error) {
        console.log('Payment tracking tables may not be set up yet')
      }
    }

    // Update booking payment status (this will be done by trigger as well)
    const { data: booking, error: updateError } = await supabase
      .from('bookings')
      .update({ 
        payment_status: 'completed',
        payment_id: razorpay_payment_id
      })
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .select(`
        *,
        events (
          id,
          title,
          date,
          time,
          venue
        )
      `)
      .single()

    if (updateError || !booking) {
      console.error('Error updating booking:', updateError)
      return NextResponse.json(
        { error: 'Failed to update booking status' },
        { status: 500 }
      )
    }

    // Generate tickets for this booking
    try {
      await generateTicketsForBooking(supabase, booking)
    } catch (ticketError) {
      console.error('Error generating tickets:', ticketError)
      // Don't fail the payment verification, but log the error
    }

    // Send confirmation email (you can implement this later)
    // await sendBookingConfirmationEmail(booking)

    return NextResponse.json({
      success: true,
      booking: booking
    })
  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    )
  }
}

// Helper function to generate tickets for a booking
interface Booking {
  id: string
  event_id: string
  user_id?: string
  quantity: number
  events: {
    id: string
    title: string
    date?: string
  }
}

async function generateTicketsForBooking(supabase: ReturnType<typeof createClient>, booking: Booking) {
  const tickets = []
  
  // Generate tickets based on quantity
  for (let i = 1; i <= booking.quantity; i++) {
    const ticketNumber = `${booking.events.title.substring(0, 3).toUpperCase()}-${Date.now()}-${i.toString().padStart(3, '0')}`
    
    // Create QR code data
    const qrData: QRCodeData = {
      ticketId: '', // Will be filled after insert
      eventId: booking.event_id,
      bookingId: booking.id,
      ticketNumber: ticketNumber,
      timestamp: Date.now()
    }
    
    // Create ticket record first
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        booking_id: booking.id,
        event_id: booking.event_id,
        ticket_number: ticketNumber,
        qr_code: 'temp', // Temporary, will update with encrypted QR
        status: 'valid',
        ticket_type: 'general'
      })
      .select()
      .single()
    
    if (ticketError) {
      console.error('Error creating ticket:', ticketError)
      throw ticketError
    }
    
    // Now update QR data with actual ticket ID and encrypt
    qrData.ticketId = ticket.id
    
    // Use the more robust qr-generator encryption for better compatibility
    const ticketData = {
      ticketId: ticket.id,
      eventId: booking.event_id,
      bookingId: booking.id,
      userId: booking.user_id || '',
      ticketNumber: ticketNumber,
      ticketType: 'general',
      eventDate: booking.events?.date || new Date().toISOString()
    }
    
    const { encryptTicketData } = await import('@/lib/qr-generator')
    const encryptedQR = await encryptTicketData(ticketData)
    
    // Update ticket with encrypted QR code
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ qr_code: encryptedQR })
      .eq('id', ticket.id)
    
    if (updateError) {
      console.error('Error updating ticket QR code:', updateError)
      throw updateError
    }
    
    tickets.push({ ...ticket, qr_code: encryptedQR })
  }
  
  console.log(`Generated ${tickets.length} tickets for booking ${booking.id}`)
  return tickets
}
