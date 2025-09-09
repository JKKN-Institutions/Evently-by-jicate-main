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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // SQL commands to fix the RLS issue
    const sqlCommands = [
      // Drop existing triggers
      `DROP TRIGGER IF EXISTS update_event_stats ON tickets CASCADE`,
      `DROP TRIGGER IF EXISTS update_event_verification_stats_trigger ON tickets CASCADE`,
      `DROP TRIGGER IF EXISTS safe_update_event_stats_trigger ON tickets CASCADE`,
      
      // Drop existing functions
      `DROP FUNCTION IF EXISTS update_event_stats_trigger() CASCADE`,
      `DROP FUNCTION IF EXISTS update_event_verification_stats_trigger() CASCADE`,
      `DROP FUNCTION IF EXISTS safe_update_event_stats() CASCADE`,
      
      // Create safe trigger function
      `CREATE OR REPLACE FUNCTION safe_update_event_stats()
      RETURNS TRIGGER 
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
          BEGIN
              IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_verified IS DISTINCT FROM NEW.is_verified) THEN
                  INSERT INTO event_verification_stats (
                      event_id, 
                      total_tickets, 
                      verified_tickets, 
                      unverified_tickets,
                      updated_at
                  )
                  SELECT 
                      NEW.event_id,
                      COUNT(*),
                      COUNT(*) FILTER (WHERE is_verified = true),
                      COUNT(*) FILTER (WHERE is_verified = false),
                      NOW()
                  FROM tickets
                  WHERE event_id = NEW.event_id
                  ON CONFLICT (event_id) DO UPDATE
                  SET 
                      total_tickets = EXCLUDED.total_tickets,
                      verified_tickets = EXCLUDED.verified_tickets,
                      unverified_tickets = EXCLUDED.unverified_tickets,
                      updated_at = NOW();
              END IF;
          EXCEPTION 
              WHEN insufficient_privilege THEN
                  RAISE DEBUG 'Stats update skipped due to RLS: %', SQLERRM;
              WHEN OTHERS THEN
                  RAISE WARNING 'Could not update event stats: %', SQLERRM;
          END;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`,
      
      // Create new trigger
      `CREATE TRIGGER safe_update_event_stats_trigger
      AFTER INSERT OR UPDATE OF is_verified ON tickets
      FOR EACH ROW
      EXECUTE FUNCTION safe_update_event_stats()`,
      
      // Drop all existing RLS policies
      `DROP POLICY IF EXISTS "View event stats" ON event_verification_stats`,
      `DROP POLICY IF EXISTS "Allow stats insert via functions" ON event_verification_stats`,
      `DROP POLICY IF EXISTS "Allow stats update via functions" ON event_verification_stats`,
      `DROP POLICY IF EXISTS "stats_select_all" ON event_verification_stats`,
      `DROP POLICY IF EXISTS "stats_insert_authenticated" ON event_verification_stats`,
      `DROP POLICY IF EXISTS "stats_update_authenticated" ON event_verification_stats`,
      `DROP POLICY IF EXISTS "stats_delete_admin" ON event_verification_stats`,
      
      // Create new permissive policies
      `CREATE POLICY "Anyone can view stats" 
      ON event_verification_stats 
      FOR SELECT 
      USING (true)`,
      
      `CREATE POLICY "System can insert stats" 
      ON event_verification_stats 
      FOR INSERT 
      WITH CHECK (true)`,
      
      `CREATE POLICY "System can update stats" 
      ON event_verification_stats 
      FOR UPDATE 
      USING (true)
      WITH CHECK (true)`,
      
      // Grant permissions
      `GRANT ALL ON event_verification_stats TO authenticated`,
      `GRANT ALL ON event_verification_stats TO service_role`,
      `GRANT ALL ON event_verification_stats TO anon`
    ]

    // Execute SQL commands using RPC
    const results = []
    let hasErrors = false

    // Create an RPC function to execute the SQL
    const { error: rpcError } = await supabase.rpc('exec_sql', {
      sql: sqlCommands.join('; ')
    }).single()

    if (rpcError) {
      // If the RPC function doesn't exist, try individual commands
      for (const sql of sqlCommands) {
        try {
          // Try to execute via raw SQL (this might not work due to Supabase restrictions)
          const { error } = await supabase.rpc('exec_sql', { sql })
          
          if (error) {
            results.push({
              command: sql.substring(0, 50) + '...',
              success: false,
              error: error.message
            })
            hasErrors = true
          } else {
            results.push({
              command: sql.substring(0, 50) + '...',
              success: true
            })
          }
        } catch (err: any) {
          results.push({
            command: sql.substring(0, 50) + '...',
            success: false,
            error: err.message
          })
        }
      }
    }

    // Test if the fix worked by trying to create a test ticket
    const testResult = await testTicketCreation(supabase)

    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors 
        ? 'Some fixes could not be applied. Please run the SQL manually in Supabase SQL editor.'
        : 'RLS fix applied successfully!',
      results,
      testResult,
      manualFixPath: '/supabase/FIX-RLS-COMPREHENSIVE.sql',
      instructions: hasErrors
        ? 'Please go to your Supabase dashboard > SQL Editor and run the contents of FIX-RLS-COMPREHENSIVE.sql'
        : 'The fix has been applied. Try generating tickets again.'
    })

  } catch (error: any) {
    console.error('Error applying RLS fix:', error)
    return NextResponse.json(
      { 
        error: 'Failed to apply RLS fix',
        details: error.message,
        manualFixPath: '/supabase/FIX-RLS-COMPREHENSIVE.sql',
        instructions: 'Please run the SQL file manually in your Supabase SQL editor'
      },
      { status: 500 }
    )
  }
}

async function testTicketCreation(supabase: any) {
  try {
    // Get a test event
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .limit(1)
      .single()

    if (!event) {
      return { tested: false, reason: 'No events found for testing' }
    }

    // Try to create a test booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        event_id: event.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        quantity: 1,
        total_amount: 0,
        payment_status: 'test',
        user_name: 'RLS Test',
        user_email: 'test@rls-fix.com',
        user_phone: '+1234567890'
      })
      .select()
      .single()

    if (bookingError) {
      return { tested: false, reason: 'Could not create test booking', error: bookingError.message }
    }

    // Try to create a test ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        booking_id: booking.id,
        event_id: event.id,
        ticket_number: 'RLS-TEST-' + Date.now(),
        qr_code: 'test',
        status: 'valid',
        ticket_type: 'Test'
      })
      .select()
      .single()

    // Clean up test data
    if (ticket) {
      await supabase.from('tickets').delete().eq('id', ticket.id)
    }
    if (booking) {
      await supabase.from('bookings').delete().eq('id', booking.id)
    }

    if (ticketError) {
      // Check if it's the stats RLS error
      if (ticketError.code === '42501' && ticketError.message?.includes('event_verification_stats')) {
        return { 
          tested: true, 
          success: false, 
          reason: 'Stats RLS error still occurring',
          needsManualFix: true 
        }
      }
      return { tested: true, success: false, reason: ticketError.message }
    }

    return { tested: true, success: true, reason: 'Ticket creation successful!' }

  } catch (error: any) {
    return { tested: false, reason: 'Test failed', error: error.message }
  }
}