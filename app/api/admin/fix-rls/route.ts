import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    // Create a service role client to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Drop existing policies
    const dropPolicies = [
      "DROP POLICY IF EXISTS \"View event stats\" ON event_verification_stats",
      "DROP POLICY IF EXISTS \"Allow stats insert via functions\" ON event_verification_stats",
      "DROP POLICY IF EXISTS \"Allow stats update via functions\" ON event_verification_stats"
    ];

    for (const sql of dropPolicies) {
      await supabase.rpc('exec_sql', { sql });
    }

    // Enable RLS
    await supabase.rpc('exec_sql', { 
      sql: "ALTER TABLE event_verification_stats ENABLE ROW LEVEL SECURITY" 
    });

    // Create new policies
    const createPolicies = [
      `CREATE POLICY "Anyone can view stats" ON event_verification_stats
        FOR SELECT USING (true)`,
      
      `CREATE POLICY "Insert stats for own events" ON event_verification_stats
        FOR INSERT WITH CHECK (
          auth.uid() IS NOT NULL AND (
            EXISTS (
              SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()
            ) OR
            EXISTS (
              SELECT 1 FROM bookings WHERE event_id = event_verification_stats.event_id AND user_id = auth.uid()
            ) OR
            EXISTS (
              SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer')
            )
          )
        )`,
      
      `CREATE POLICY "Update stats for own events" ON event_verification_stats
        FOR UPDATE USING (
          auth.uid() IS NOT NULL AND (
            EXISTS (
              SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()
            ) OR
            EXISTS (
              SELECT 1 FROM bookings WHERE event_id = event_verification_stats.event_id AND user_id = auth.uid()
            ) OR
            EXISTS (
              SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer')
            )
          )
        )`
    ];

    for (const sql of createPolicies) {
      await supabase.rpc('exec_sql', { sql });
    }

    // Drop and recreate the function
    await supabase.rpc('exec_sql', { 
      sql: `DROP FUNCTION IF EXISTS safe_update_event_stats CASCADE` 
    });
    
    await supabase.rpc('exec_sql', { 
      sql: `DROP FUNCTION IF EXISTS safe_update_event_stats(UUID) CASCADE` 
    });
    
    await supabase.rpc('exec_sql', { 
      sql: `DROP FUNCTION IF EXISTS safe_update_event_stats(p_event_id UUID) CASCADE` 
    });

    await supabase.rpc('exec_sql', { 
      sql: `
        CREATE OR REPLACE FUNCTION safe_update_event_stats(p_event_id UUID)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
          INSERT INTO event_verification_stats (
            event_id, 
            total_tickets, 
            verified_tickets, 
            unverified_tickets
          )
          SELECT 
            p_event_id,
            COUNT(*),
            COUNT(*) FILTER (WHERE is_verified = true),
            COUNT(*) FILTER (WHERE is_verified = false)
          FROM tickets
          WHERE event_id = p_event_id
          ON CONFLICT (event_id) DO UPDATE
          SET 
            total_tickets = EXCLUDED.total_tickets,
            verified_tickets = EXCLUDED.verified_tickets,
            unverified_tickets = EXCLUDED.unverified_tickets;
        END;
        $$
      ` 
    });

    // Update the trigger function
    await supabase.rpc('exec_sql', { 
      sql: `
        CREATE OR REPLACE FUNCTION update_event_stats_on_ticket_change()
        RETURNS TRIGGER AS $$
        BEGIN
          PERFORM safe_update_event_stats(NEW.event_id);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      ` 
    });

    // Recreate the trigger
    await supabase.rpc('exec_sql', { 
      sql: `DROP TRIGGER IF EXISTS update_event_stats_on_ticket ON tickets` 
    });
    
    await supabase.rpc('exec_sql', { 
      sql: `
        CREATE TRIGGER update_event_stats_on_ticket
        AFTER INSERT OR UPDATE OF is_verified ON tickets
        FOR EACH ROW
        EXECUTE FUNCTION update_event_stats_on_ticket_change()
      ` 
    });

    // Grant permissions
    const grantPermissions = [
      "GRANT EXECUTE ON FUNCTION safe_update_event_stats TO authenticated",
      "GRANT EXECUTE ON FUNCTION safe_update_event_stats TO service_role",
      "GRANT ALL ON event_verification_stats TO authenticated",
      "GRANT ALL ON event_verification_stats TO service_role"
    ];

    for (const sql of grantPermissions) {
      await supabase.rpc('exec_sql', { sql });
    }

    return NextResponse.json({ 
      success: true, 
      message: "RLS policies fixed successfully" 
    });

  } catch (error: any) {
    console.error("Error fixing RLS:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}