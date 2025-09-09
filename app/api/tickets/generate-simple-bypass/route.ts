import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { 
      eventId, 
      quantity = 1, 
      ticketType = "Bronze",
      predefinedId 
    } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

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

    // Generate tickets without triggering stats updates
    for (let i = 0; i < quantity; i++) {
      const ticketData = {
        id: uuidv4(),
        event_id: eventId,
        ticket_number: `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        user_id: user.id,
        user_name: user.email?.split('@')[0] || 'Guest',
        user_email: user.email,
        ticket_type: ticketType,
        price: event.price || 0,
        purchase_date: new Date().toISOString(),
        status: 'active',
        is_verified: false,
        verification_code: Math.random().toString(36).substring(2, 15).toUpperCase(),
        qr_code: `${process.env.NEXT_PUBLIC_SITE_URL}/verify/${uuidv4()}`,
        predefined_id: predefinedId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert(ticketData)
        .select()
        .single();

      if (ticketError) {
        console.error(`Error creating ticket ${i + 1}:`, ticketError);
        errors.push({
          index: i + 1,
          error: ticketError.message
        });
      } else {
        tickets.push(ticket);
      }
    }

    // Manually update stats to avoid RLS issues
    if (tickets.length > 0) {
      try {
        // Get current stats
        const { data: currentStats } = await supabase
          .from("event_verification_stats")
          .select("*")
          .eq("event_id", eventId)
          .single();

        const newTotal = (currentStats?.total_tickets || 0) + tickets.length;
        const newUnverified = (currentStats?.unverified_tickets || 0) + tickets.length;

        // Try to upsert stats (may fail due to RLS, but that's ok)
        await supabase
          .from("event_verification_stats")
          .upsert({
            event_id: eventId,
            total_tickets: newTotal,
            verified_tickets: currentStats?.verified_tickets || 0,
            unverified_tickets: newUnverified
          }, {
            onConflict: 'event_id'
          });
      } catch (statsError) {
        console.log("Stats update skipped (RLS):", statsError);
        // Continue anyway - tickets are created
      }
    }

    return NextResponse.json({
      success: tickets.length > 0,
      message: `Created ${tickets.length} out of ${quantity} tickets`,
      tickets,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error("Ticket generation error:", error);
    return NextResponse.json({ 
      error: "Failed to generate tickets",
      details: error.message 
    }, { status: 500 });
  }
}