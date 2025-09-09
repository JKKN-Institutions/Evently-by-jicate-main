import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Get the current user from regular client
    const regularClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user } } = await regularClient.auth.getUser();
    const userId = user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // fallback user ID
    const userEmail = user?.email || 'test@example.com';
    const userName = userEmail.split('@')[0];

    // Use Jolly Jam II event
    const eventId = "bb4bb036-079b-4c03-9e63-f7d92b1bcd04";
    const quantity = 5;

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ 
        error: "Event not found", 
        details: eventError?.message 
      }, { status: 404 });
    }

    // Create a test booking first
    const bookingId = uuidv4();
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        id: bookingId,
        event_id: eventId,
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        user_phone: '+1234567890',
        quantity: quantity,
        total_amount: 0,
        payment_status: 'completed',
        booking_status: 'confirmed'
      })
      .select()
      .single();

    if (bookingError) {
      console.error("Booking error:", bookingError);
      return NextResponse.json({ 
        error: "Failed to create test booking",
        details: bookingError.message,
        code: bookingError.code
      }, { status: 500 });
    }

    const tickets = [];
    const errors = [];

    // Generate tickets directly
    for (let i = 0; i < quantity; i++) {
      const ticketNumber = `TKT-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const ticketId = uuidv4();
      
      const ticketData = {
        id: ticketId,
        booking_id: booking.id,
        event_id: eventId,
        ticket_number: ticketNumber,
        qr_code: `https://evently.com/verify/${ticketId}`,
        status: 'valid',
        ticket_type: 'general', // Use valid ticket type
        seat_number: `A${i + 1}`,
        metadata: {
          generated_by: 'direct-insert',
          user_email: userEmail,
          generated_at: new Date().toISOString()
        }
      };

      // Insert ticket directly
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert(ticketData)
        .select()
        .single();

      if (ticketError) {
        console.error(`Error creating ticket ${i + 1}:`, ticketError);
        errors.push({
          index: i + 1,
          ticketNumber,
          error: ticketError.message,
          code: ticketError.code,
          details: ticketError.details
        });
      } else {
        tickets.push(ticket);
        console.log(`Created ticket ${i + 1}:`, ticketNumber);
      }
    }

    // Get total ticket count
    const { count } = await supabase
      .from("tickets")
      .select("*", { count: 'exact', head: true })
      .eq("event_id", eventId);

    return NextResponse.json({
      success: tickets.length > 0,
      message: tickets.length > 0 
        ? `Successfully created ${tickets.length} tickets for ${event.title}`
        : `Failed to create tickets - check errors`,
      event: {
        id: event.id,
        title: event.title
      },
      booking: {
        id: booking.id,
        status: booking.booking_status
      },
      created: tickets.length,
      failed: errors.length,
      total_tickets_for_event: count || 0,
      tickets: tickets.map(t => ({
        id: t.id,
        ticket_number: t.ticket_number,
        ticket_type: t.ticket_type,
        status: t.status,
        seat_number: t.seat_number
      })),
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error("Direct insert error:", error);
    return NextResponse.json({ 
      error: "Failed to generate tickets",
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}