const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseDatabaseIssue() {
  console.log('🔍 DIAGNOSING SUPABASE DATABASE ISSUE\n');

  try {
    // Check current profile state
    console.log('=== CURRENT PROFILE STATE ===');
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'rojasundharam2000@gmail.com')
      .single();
    
    console.log('Profile:', JSON.stringify(profile, null, 2));

    // Check auth metadata
    if (profile?.id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
      console.log('Auth Metadata:', JSON.stringify(authUser?.user?.user_metadata, null, 2));
    }

    // Try to execute diagnostic queries using different approaches
    console.log('\n=== ATTEMPTING DATABASE DIAGNOSTICS ===');

    // Method 1: Try using a custom function
    const diagnosticSQL = `
      CREATE OR REPLACE FUNCTION get_database_diagnostics()
      RETURNS JSON AS $$
      DECLARE
        result JSON;
        trigger_info JSON;
        function_info JSON;
        policy_info JSON;
      BEGIN
        -- Get triggers on auth.users
        SELECT json_agg(
          json_build_object(
            'trigger_name', tgname,
            'table_name', 'auth.users',
            'function_name', p.proname
          )
        ) INTO trigger_info
        FROM pg_trigger t
        LEFT JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE t.tgrelid = 'auth.users'::regclass 
        AND t.tgisinternal = false;

        -- Get functions that might affect profiles
        SELECT json_agg(
          json_build_object(
            'function_name', proname,
            'function_definition', prosrc
          )
        ) INTO function_info
        FROM pg_proc 
        WHERE proname LIKE '%user%' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

        -- Get RLS policies on profiles
        SELECT json_agg(
          json_build_object(
            'policy_name', polname,
            'table_name', 'profiles',
            'policy_cmd', polcmd,
            'policy_roles', polroles::text
          )
        ) INTO policy_info
        FROM pg_policy 
        WHERE polrelid = 'public.profiles'::regclass;

        result := json_build_object(
          'triggers', COALESCE(trigger_info, '[]'::json),
          'functions', COALESCE(function_info, '[]'::json),
          'policies', COALESCE(policy_info, '[]'::json),
          'timestamp', NOW()
        );

        RETURN result;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Create the diagnostic function
    const { error: createError } = await supabase.rpc('exec', { sql: diagnosticSQL }).catch(() => null);

    if (createError) {
      console.log('Could not create diagnostic function:', createError.message);
    } else {
      // Call the diagnostic function
      const { data: diagnostics, error: diagError } = await supabase.rpc('get_database_diagnostics');

      if (diagError) {
        console.log('Could not run diagnostics:', diagError.message);
      } else {
        console.log('\n=== DATABASE DIAGNOSTICS RESULTS ===');
        console.log(JSON.stringify(diagnostics, null, 2));
      }
    }

    // Method 2: Direct queries to system tables (if we have access)
    console.log('\n=== ATTEMPTING DIRECT QUERIES ===');
    
    // Try to query pg_trigger directly
    const { data: triggers, error: triggerError } = await supabase
      .from('pg_trigger')
      .select('tgname, tgrelid, tgfoid')
      .eq('tgrelid', 1259); // This would be the OID for auth.users, but we don't know it

    if (triggerError) {
      console.log('Cannot access pg_trigger directly:', triggerError.message);
    } else {
      console.log('Triggers found:', triggers);
    }

    // Method 3: Test role updates in real-time
    console.log('\n=== TESTING ROLE UPDATES ===');
    
    console.log('Setting role to admin...');
    const { error: updateError1 } = await supabase
      .from('profiles')
      .update({ role: 'admin', updated_at: new Date().toISOString() })
      .eq('email', 'rojasundharam2000@gmail.com');

    if (updateError1) {
      console.log('Failed to update to admin:', updateError1.message);
    } else {
      console.log('✅ Updated to admin');
      
      // Wait a bit and check again
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: checkProfile } = await supabase
        .from('profiles')
        .select('role, updated_at')
        .eq('email', 'rojasundharam2000@gmail.com')
        .single();
      
      console.log('Role after 1 second:', checkProfile?.role);
      console.log('Updated at:', checkProfile?.updated_at);
      
      if (checkProfile?.role !== 'admin') {
        console.log('🚨 ROLE WAS CHANGED BACK BY SOMETHING!');
      }
    }

    // Method 4: Check for any scheduled functions or cron jobs
    console.log('\n=== CHECKING FOR SCHEDULED FUNCTIONS ===');
    
    const { data: cronJobs, error: cronError } = await supabase
      .from('cron.job')
      .select('*')
      .catch(() => ({ data: null, error: 'No access to cron jobs' }));

    if (cronError) {
      console.log('Cannot check cron jobs:', cronError.message);
    } else if (cronJobs && cronJobs.length > 0) {
      console.log('Found cron jobs:', cronJobs);
    } else {
      console.log('No cron jobs found');
    }

  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  }

  console.log('\n=== RECOMMENDATION ===');
  console.log('If role keeps reverting, there is likely:');
  console.log('1. A database trigger on auth.users or profiles table');
  console.log('2. A webhook/edge function that modifies roles');
  console.log('3. Row Level Security policy that prevents updates');
  console.log('4. A cron job or scheduled function');
  console.log('\nNext step: Check your Supabase Dashboard > Database > Triggers');
  console.log('And also check: Dashboard > Edge Functions for any role-related functions');
}

diagnoseDatabaseIssue();