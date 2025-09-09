const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Get credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Testing Supabase Connection...');
console.log('URL:', supabaseUrl);
console.log('Service Key:', supabaseServiceKey ? '✓ Found' : '✗ Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  try {
    console.log('\n📊 Testing database connection...');
    
    // Test 1: Check if we can query the events table
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title')
      .limit(1);
    
    if (eventsError) {
      console.error('❌ Error querying events:', eventsError.message);
    } else {
      console.log('✅ Successfully connected to database');
      console.log('   Found', events?.length || 0, 'event(s)');
    }
    
    // Test 2: Check event_verification_stats table
    console.log('\n🔍 Checking event_verification_stats table...');
    const { data: stats, error: statsError } = await supabase
      .from('event_verification_stats')
      .select('*')
      .limit(1);
    
    if (statsError) {
      console.error('❌ Error accessing event_verification_stats:', statsError.message);
      if (statsError.code === '42501') {
        console.log('   ⚠️  RLS policy issue detected - this needs to be fixed');
      }
    } else {
      console.log('✅ Can access event_verification_stats table');
    }
    
    // Test 3: Check if we can query tickets
    console.log('\n🎫 Checking tickets table...');
    const { count, error: ticketsError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true });
    
    if (ticketsError) {
      console.error('❌ Error counting tickets:', ticketsError.message);
    } else {
      console.log('✅ Tickets table accessible');
      console.log('   Total tickets:', count || 0);
    }
    
    // Test 4: Check profiles table
    console.log('\n👤 Checking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role')
      .limit(1);
    
    if (profilesError) {
      console.error('❌ Error accessing profiles:', profilesError.message);
    } else {
      console.log('✅ Profiles table accessible');
    }
    
    console.log('\n✨ Connection test complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Supabase Project URL:', supabaseUrl);
    console.log('Connection Status: ACTIVE');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message);
  }
}

testConnection();