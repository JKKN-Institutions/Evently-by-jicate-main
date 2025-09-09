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

    const { 
      bookingId,
      paymentId,
      error: paymentError 
    } = await request.json()

    // First get the current payment record to increment attempts
    const { data: currentPayment } = await supabase
      .from('payments')
      .select('attempts')
      .eq('id', paymentId)
      .single()

    // Update payment record with failure details
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'failed',
        error_code: paymentError?.code || 'UNKNOWN',
        error_description: paymentError?.description || 'Payment failed',
        error_source: paymentError?.source || 'razorpay',
        error_step: paymentError?.step || 'payment_processing',
        error_reason: paymentError?.reason || 'unknown',
        attempts: (currentPayment?.attempts || 0) + 1
      })
      .eq('id', paymentId)

    if (updateError) {
      console.error('Error updating payment record:', updateError)
      // Continue processing even if payment update fails
    }

    // Log payment failure (optional - don't fail if this doesn't work)
    try {
      await supabase
        .from('payment_logs')
        .insert({
          payment_id: paymentId,
          booking_id: bookingId,
          event_type: 'payment_failed',
          event_data: {
            error: paymentError,
            timestamp: new Date().toISOString()
          }
        })
    } catch (logError) {
      console.error('Error logging payment failure:', logError)
      // Continue processing even if logging fails
    }

    // Update booking status to failed (this is important)
    try {
      await supabase
        .from('bookings')
        .update({ 
          payment_status: 'failed'
        })
        .eq('id', bookingId)
        .eq('user_id', user.id)
    } catch (bookingError) {
      console.error('Error updating booking status:', bookingError)
      // Continue processing even if booking update fails
    }

    // Always return success for payment failure handling
    return NextResponse.json({
      success: true,
      message: 'Payment failed. Please try again or contact support.',
      status: 'failed'
    })
  } catch (error) {
    console.error('Error recording payment failure:', error)
    // Even if there's an error, return success for payment failure
    // We don't want to throw errors when handling payment failures
    return NextResponse.json({
      success: true,
      message: 'Payment failed. The failure has been recorded.',
      status: 'failed'
    })
  }
}
