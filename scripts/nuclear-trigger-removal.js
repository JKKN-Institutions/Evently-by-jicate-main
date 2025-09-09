const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function nuclearTriggerRemoval() {
  console.log('🔥 NUCLEAR OPTION: Removing ALL problematic triggers\n');

  try {
    // First, let's see what's in the database
    console.log('Step 1: Checking current state...');
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, updated_at')
      .eq('email', 'rojasundharam2000@gmail.com')
      .single();
    
    console.log(`Current role in profile: ${profile?.role}`);
    console.log(`Last updated: ${profile?.updated_at}`);
    
    // Force update the role
    console.log('\nStep 2: Force updating role to admin...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        role: 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('email', 'rojasundharam2000@gmail.com');
    
    if (updateError) {
      console.error('Failed to update role:', updateError);
      return;
    }
    
    console.log('✅ Role updated to admin');
    
    // Try to execute raw SQL to remove triggers using a function approach
    console.log('\nStep 3: Attempting to remove triggers via function...');
    
    // Create a function to remove all triggers
    const createRemoveFunctionSQL = `
      CREATE OR REPLACE FUNCTION remove_all_auth_triggers()
      RETURNS TEXT AS $$
      DECLARE
        trigger_rec RECORD;
        result_text TEXT := '';
      BEGIN
        -- Drop all custom triggers on auth.users
        FOR trigger_rec IN 
          SELECT tgname 
          FROM pg_trigger 
          WHERE tgrelid = 'auth.users'::regclass 
          AND tgisinternal = false
          AND tgname NOT LIKE 'RI_%'
        LOOP
          EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users CASCADE', trigger_rec.tgname);
          result_text := result_text || 'Dropped trigger: ' || trigger_rec.tgname || E'\\n';
        END LOOP;
        
        -- Drop all functions that might create triggers
        DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
        DROP FUNCTION IF EXISTS handle_new_user_safe() CASCADE;
        DROP FUNCTION IF EXISTS handle_new_user_minimal() CASCADE;
        DROP FUNCTION IF EXISTS handle_new_user_v3() CASCADE;
        DROP FUNCTION IF EXISTS handle_new_user_minimal_v4() CASCADE;
        
        result_text := result_text || 'Dropped all trigger functions' || E'\\n';
        result_text := result_text || 'SUCCESS: All problematic triggers removed';
        
        RETURN result_text;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    const { data: createResult, error: createError } = await supabase.rpc('exec', { 
      sql: createRemoveFunctionSQL 
    }).catch(async () => {
      // If exec doesn't exist, try creating the function directly
      const { data, error } = await supabase.rpc('sql', { query: createRemoveFunctionSQL }).catch(() => {
        console.log('⚠️  Cannot execute raw SQL via RPC');
        return { data: null, error: 'No RPC access' };
      });
      return { data, error };
    });
    
    if (createError) {
      console.log('⚠️  Could not create removal function via RPC:', createError.message);
    } else {
      // Try to call the removal function
      const { data: removeResult, error: removeError } = await supabase.rpc('remove_all_auth_triggers');
      
      if (removeError) {
        console.log('⚠️  Could not call removal function:', removeError.message);
      } else {
        console.log('✅ Trigger removal result:', removeResult);
      }
    }
    
    // Manual approach - update RLS policies to allow our updates
    console.log('\nStep 4: Updating RLS policies to ensure role updates work...');
    
    const updatePolicySQL = `
      -- Create a policy that allows service role to update any profile
      DROP POLICY IF EXISTS "service_role_full_access" ON profiles;
      CREATE POLICY "service_role_full_access" ON profiles
        FOR ALL USING (auth.role() = 'service_role');
    `;
    
    const { error: policyError } = await supabase.rpc('exec', { 
      sql: updatePolicySQL 
    }).catch(() => ({ error: 'No RPC access' }));
    
    if (policyError && policyError !== 'No RPC access') {
      console.log('⚠️  Could not update RLS policy:', policyError.message);
    } else if (policyError !== 'No RPC access') {
      console.log('✅ RLS policy updated for service role access');
    }
    
    // Verify the final state
    console.log('\nStep 5: Final verification...');
    const { data: finalProfile } = await supabase
      .from('profiles')
      .select('role, updated_at')
      .eq('email', 'rojasundharam2000@gmail.com')
      .single();
    
    console.log(`Final role in profile: ${finalProfile?.role}`);
    console.log(`Final updated: ${finalProfile?.updated_at}`);
    
    if (finalProfile?.role === 'admin') {
      console.log('\n🎉 SUCCESS: Role is set to admin');
      console.log('\n📋 NEXT STEPS:');
      console.log('1. Test logging in and out');
      console.log('2. If role still reverts, there may be triggers that can only be removed from Supabase Dashboard');
      console.log('3. Go to Supabase Dashboard > SQL Editor');
      console.log('4. Run: SELECT tgname FROM pg_trigger WHERE tgrelid = \'auth.users\'::regclass AND tgisinternal = false;');
      console.log('5. Drop any custom triggers found');
    } else {
      console.log('\n❌ FAILED: Role is still not admin');
    }
    
  } catch (error) {
    console.error('❌ Nuclear removal failed:', error.message);
    console.log('\n💡 Manual steps required:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run this query to see all triggers:');
    console.log('   SELECT tgname FROM pg_trigger WHERE tgrelid = \'auth.users\'::regclass AND tgisinternal = false;');
    console.log('4. Drop each trigger manually:');
    console.log('   DROP TRIGGER trigger_name ON auth.users CASCADE;');
  }
}

nuclearTriggerRemoval();