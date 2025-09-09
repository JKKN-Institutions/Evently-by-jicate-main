import { NextRequest, NextResponse } from 'next/server'
import { getRazorpayInstance } from '@/lib/razorpay-server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

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

    const { bookingId } = await request.json()

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        events (
          title,
          price
        )
      `)
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Check if payment is already completed
    if (booking.payment_status === 'completed') {
      return NextResponse.json(
        { error: 'Payment already completed' },
        { status: 400 }
      )
    }

    // Create Razorpay order
    // Generate a shorter receipt ID (max 40 chars for Razorpay)
    const shortReceiptId = `BK_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    
    const options = {
      amount: Math.round(booking.total_amount * 100), // Amount in paise
      currency: 'INR',
      receipt: shortReceiptId,
      notes: {
        bookingId: bookingId,
        eventTitle: booking.events.title,
        userId: user.id,
      }
    }

    console.log('Creating Razorpay order with options:', options)
    
    let order
    try {
      const razorpay = getRazorpayInstance()
      order = await razorpay.orders.create(options)
      console.log('Razorpay order created:', order)
    } catch (razorpayError) {
      console.error('Razorpay API Error:', razorpayError)
      return NextResponse.json(
        { 
          error: 'Failed to create payment order', 
          details: (razorpayError as Error).message 
        },
        { status: 400 }
      )
    }

    // Try to create payment record (optional - only if table exists)
    let paymentId = null
    try {
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          booking_id: bookingId,
          razorpay_order_id: order.id,
          amount: booking.total_amount,
          currency: order.currency,
          status: 'created',
          notes: {
            eventTitle: booking.events.title,
            userId: user.id,
            bookingId: bookingId
          }
        })
        .select()
        .single()

      if (paymentError) {
        console.error('Error creating payment record:', paymentError)
        console.log('Payment tracking table may not be set up yet')
      } else {
        paymentId = payment?.id

        // Try to log payment creation
        try {
          await supabase
            .from('payment_logs')
            .insert({
              payment_id: payment?.id,
              booking_id: bookingId,
              event_type: 'order_created',
              event_data: {
                order_id: order.id,
                amount: order.amount,
                currency: order.currency
              }
            })
        } catch (logError) {
          console.log('Payment logs table may not be set up yet')
        }
      }
    } catch (error) {
      console.log('Payment tracking not yet configured - continuing without it')
    }

    // Update booking with order ID
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ payment_id: order.id })
      .eq('id', bookingId)

    if (updateError) {
      console.error('Error updating booking with order ID:', updateError)
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bookingId: bookingId,
      paymentId: paymentId
    })
  } catch (error) {
    console.error('Error creating Razorpay order:', error)
    return NextResponse.json(
      { error: 'Failed to create payment order' },
      { status: 500 }
    )
  }
}
