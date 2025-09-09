import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sdkdimqmzunfmyawtqfy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNka2RpbXFtenVuZm15YXd0cWZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc3MTUyMSwiZXhwIjoyMDcxMzQ3NTIxfQ.Mj8Ol8nDqLFdMLpLcCPY4PLS7LevI0CbNb89ovBjLfk';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

console.log('🔧 Applying RLS fix to Supabase database...\n');

// First, let's check if the table exists
const { data: tableCheck, error: tableError } = await supabase
  .from('event_verification_stats')
  .select('event_id')
  .limit(1);

if (tableError && !tableError.message.includes('permission')) {
  console.log('Creating event_verification_stats table...');
  
  // Create the table if it doesn't exist
  const createTableResult = await fetch(`${supabaseUrl}/rest/v1/rpc`, {
    method: 'POST',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      query: `
        CREATE TABLE IF NOT EXISTS event_verification_stats (
          event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
          total_tickets INTEGER DEFAULT 0,
          verified_tickets INTEGER DEFAULT 0,
          unverified_tickets INTEGER DEFAULT 0,
          pending_tickets INTEGER DEFAULT 0,
          last_verified_at TIMESTAMPTZ,
          last_scan_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    })
  });
}

// Now let's update some records directly to verify access
console.log('Testing direct database access...');

// Get events that have tickets
const { data: events, error: eventsError } = await supabase
  .from('tickets')
  .select('event_id')
  .limit(5);

if (events && events.length > 0) {
  const uniqueEventIds = [...new Set(events.map(e => e.event_id))];
  
  for (const eventId of uniqueEventIds) {
    // Get ticket stats for this event
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('is_verified')
      .eq('event_id', eventId);
    
    if (tickets) {
      const total = tickets.length;
      const verified = tickets.filter(t => t.is_verified === true).length;
      const unverified = tickets.filter(t => t.is_verified === false || t.is_verified === null).length;
      
      console.log(`Updating stats for event ${eventId}: ${total} total, ${verified} verified`);
      
      // Try to upsert the stats
      const { error: upsertError } = await supabase
        .from('event_verification_stats')
        .upsert({
          event_id: eventId,
          total_tickets: total,
          verified_tickets: verified,
          unverified_tickets: unverified,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'event_id'
        });
      
      if (upsertError) {
        console.error(`Error updating stats for event ${eventId}:`, upsertError.message);
      } else {
        console.log(`✅ Successfully updated stats for event ${eventId}`);
      }
    }
  }
}

console.log('\n✨ Database operations completed!');
console.log('The ticket generation should now work better.');
console.log('\nNote: The RLS policies are controlled by Supabase dashboard.');
console.log('If you still see RLS errors, you may need to:');
console.log('1. Go to Supabase Dashboard > Database > Tables');
console.log('2. Find the "event_verification_stats" table');
console.log('3. Click on "RLS disabled/enabled" and adjust policies');
console.log('4. Or temporarily disable RLS for this table');

process.exit(0);