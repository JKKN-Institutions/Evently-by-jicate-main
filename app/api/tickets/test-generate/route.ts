import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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

    const tickets = [];
    const errors = [];

    // First create a test booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        id: uuidv4(),
        event_id: eventId,
        user_id: user.id,
        user_email: user.email || 'test@example.com',
        user_name: user.email?.split('@')[0] || 'Test User',
        user_phone: '+1234567890',
        quantity: quantity,
        total_amount: 0,
        payment_status: 'completed',
        booking_status: 'confirmed',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (bookingError) {
      return NextResponse.json({ 
        error: "Failed to create test booking",
        details: bookingError.message 
      }, { status: 500 });
    }

    // Generate 5 test tickets
    for (let i = 0; i < quantity; i++) {
      const ticketNumber = `TKT-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const ticketId = uuidv4();
      
      const ticketData = {
        id: ticketId,
        booking_id: booking.id,
        event_id: eventId,
        ticket_number: ticketNumber,
        qr_code: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/verify/${ticketId}`,
        status: 'valid',
        ticket_type: 'general', // Use valid ticket type
        seat_number: `A${i + 1}`,
        metadata: {
          generated_by: 'test-generate',
          user_email: user.email,
          generated_at: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
          code: ticketError.code
        });
      } else {
        tickets.push(ticket);
        console.log(`Created ticket ${i + 1}:`, ticketNumber);
      }
    }

    // Try to initialize event stats (ignore errors)
    try {
      const { data: stats } = await supabase
        .from("event_verification_stats")
        .select("*")
        .eq("event_id", eventId)
        .single();

      if (!stats) {
        // Try to insert initial stats
        await supabase
          .from("event_verification_stats")
          .insert({
            event_id: eventId,
            total_tickets: tickets.length,
            verified_tickets: tickets.filter(t => t.status === 'used').length,
            unverified_tickets: tickets.filter(t => t.status === 'valid').length
          });
      }
    } catch (statsError) {
      console.log("Stats initialization skipped:", statsError);
    }

    // Get total ticket count
    const { count } = await supabase
      .from("tickets")
      .select("*", { count: 'exact', head: true })
      .eq("event_id", eventId);

    return NextResponse.json({
      success: tickets.length > 0,
      message: `Successfully created ${tickets.length} tickets for ${event.title}`,
      event: {
        id: event.id,
        title: event.title
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
    console.error("Test generation error:", error);
    return NextResponse.json({ 
      error: "Failed to generate test tickets",
      details: error.message 
    }, { status: 500 });
  }
}