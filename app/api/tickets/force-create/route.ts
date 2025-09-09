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
    
    // First, let's try to disable the trigger via RPC if possible
    try {
      await supabase.rpc('exec_sql', { 
        sql: 'ALTER TABLE tickets DISABLE TRIGGER update_ticket_stats_on_insert' 
      });
    } catch (e) {
      console.log("Could not disable trigger (expected if no exec_sql function)");
    }

    // Get or create a booking
    let booking;
    
    // Check if a booking already exists for this user and event
    const { data: existingBooking } = await supabase
      .from("bookings")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (existingBooking) {
      booking = existingBooking;
    } else {
      // Create a new booking
      const { data: newBooking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          id: uuidv4(),
          event_id: eventId,
          user_id: user.id,
          user_email: user.email || 'test@example.com',
          user_name: user.email?.split('@')[0] || 'Test User',
          user_phone: '+1234567890',
          quantity: 5,
          total_amount: 0,
          payment_status: 'completed',
          booking_status: 'confirmed'
        })
        .select()
        .single();

      if (bookingError) {
        return NextResponse.json({ 
          error: "Failed to create booking",
          details: bookingError.message,
          code: bookingError.code
        }, { status: 500 });
      }
      
      booking = newBooking;
    }

    // Now create tickets using raw SQL to bypass triggers
    const tickets = [];
    const errors = [];
    
    for (let i = 0; i < 5; i++) {
      const ticketId = uuidv4();
      const ticketNumber = `FORCE-${Date.now()}-${i}`;
      
      // Try direct SQL insert first
      const { data: sqlResult, error: sqlError } = await supabase.rpc('exec_sql', {
        sql: `
          INSERT INTO tickets (
            id, 
            booking_id, 
            event_id, 
            ticket_number, 
            qr_code, 
            status,
            ticket_type,
            created_at,
            updated_at
          ) VALUES (
            '${ticketId}'::uuid,
            '${booking.id}'::uuid,
            '${eventId}'::uuid,
            '${ticketNumber}',
            'https://evently.com/verify/${ticketId}',
            'valid',
            'general',
            NOW(),
            NOW()
          ) RETURNING *;
        `
      }).single();

      if (!sqlError && sqlResult) {
        tickets.push({
          id: ticketId,
          ticket_number: ticketNumber,
          status: 'valid'
        });
      } else {
        // Fallback to regular insert
        const { data: ticket, error: ticketError } = await supabase
          .from("tickets")
          .insert({
            id: ticketId,
            booking_id: booking.id,
            event_id: eventId,
            ticket_number: ticketNumber,
            qr_code: `https://evently.com/verify/${ticketId}`,
            status: 'valid',
            ticket_type: 'general'
          })
          .select()
          .single();

        if (ticketError) {
          errors.push({
            index: i + 1,
            ticketNumber,
            error: ticketError.message,
            code: ticketError.code
          });
        } else if (ticket) {
          tickets.push(ticket);
        }
      }
    }

    // Re-enable trigger if we disabled it
    try {
      await supabase.rpc('exec_sql', { 
        sql: 'ALTER TABLE tickets ENABLE TRIGGER update_ticket_stats_on_insert' 
      });
    } catch (e) {
      // Ignore
    }

    // Get final count
    const { count } = await supabase
      .from("tickets")
      .select("*", { count: 'exact', head: true })
      .eq("event_id", eventId);

    return NextResponse.json({
      success: tickets.length > 0,
      message: tickets.length > 0 
        ? `Successfully created ${tickets.length} tickets`
        : "Failed to create tickets - check Supabase RLS policies",
      booking_id: booking.id,
      created: tickets.length,
      failed: errors.length,
      total_tickets_for_event: count || 0,
      tickets,
      errors: errors.length > 0 ? errors : undefined,
      recommendation: tickets.length === 0 ? 
        "Please run the SQL fix at /api/admin/fix-ticket-statistics to fix RLS policies" : 
        undefined
    });

  } catch (error: any) {
    console.error("Force create error:", error);
    return NextResponse.json({ 
      error: "Failed to force create tickets",
      details: error.message 
    }, { status: 500 });
  }
}