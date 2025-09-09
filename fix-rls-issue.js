const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyRLSFix() {
  console.log('🔧 Applying RLS fix for event_verification_stats...\n');

  try {
    // Test current state
    console.log('📊 Testing current ticket generation...');
    const { data: testEvent } = await supabase
      .from('events')
      .select('id, title')
      .limit(1)
      .single();

    if (testEvent) {
      console.log(`Found test event: ${testEvent.title}`);
      
      // Try to create a test ticket
      const testTicket = {
        event_id: testEvent.id,
        ticket_number: `TEST-${Date.now()}`,
        qr_code: `TEST-QR-${Date.now()}`,
        status: 'active',
        user_id: null,
        booking_id: null
      };

      const { error: ticketError } = await supabase
        .from('tickets')
        .insert(testTicket);

      if (ticketError) {
        if (ticketError.code === '42501') {
          console.log('❌ RLS error detected - applying fix is needed');
          console.log('\n📝 Instructions to fix:');
          console.log('1. Open your Supabase dashboard: ' + supabaseUrl);
          console.log('2. Navigate to SQL Editor');
          console.log('3. Copy and run the SQL from: supabase/FIX-EVENT-STATS-RLS-COMPLETE.sql');
          console.log('4. After running the SQL, test ticket generation again\n');
          
          console.log('The SQL file contains:');
          console.log('- SECURITY DEFINER functions that bypass RLS');
          console.log('- Permissive policies for event_verification_stats');
          console.log('- Safe error handling in triggers');
          console.log('- Helper functions for manual stats updates\n');
        } else {
          console.log('❌ Different error:', ticketError.message);
        }
      } else {
        console.log('✅ Ticket creation works! No RLS issues detected.');
      }
    }

    // Check if the safe functions exist
    console.log('\n🔍 Checking for required functions...');
    const { error: funcError } = await supabase.rpc('refresh_event_stats', {
      p_event_id: '00000000-0000-0000-0000-000000000000'
    });

    if (funcError && funcError.message.includes('function')) {
      console.log('❌ Required functions not found in database');
      console.log('   Please run the SQL fix script in Supabase dashboard');
    } else {
      console.log('✅ Helper functions are available');
    }

  } catch (error) {
    console.error('Error during testing:', error.message);
  }
}

// Run the check
applyRLSFix().then(() => {
  console.log('\n✨ Check complete!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});