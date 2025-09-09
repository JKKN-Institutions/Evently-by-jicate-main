const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyRolePersistenceFix() {
  console.log('🔧 Applying role persistence fix...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'supabase', 'fix-role-persistence.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    }).single();

    if (error) {
      // If exec_sql doesn't exist, try direct execution (this might not work with all SQL)
      console.log('⚠️  exec_sql function not available, please run the SQL manually in Supabase SQL Editor');
      console.log('\n📋 SQL file location: supabase/fix-role-persistence.sql');
      console.log('\nTo apply the fix:');
      console.log('1. Go to your Supabase Dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the contents of the SQL file');
      console.log('4. Run the query');
      return;
    }

    console.log('✅ Role persistence fix applied successfully!');
    console.log('\n📊 Summary:');
    console.log('- Updated handle_new_user trigger to preserve existing roles');
    console.log('- Added trigger to sync role changes to auth metadata');
    console.log('- Synced all existing user roles to auth metadata');
    console.log('\n✨ Users will now keep their updated roles even after logging out and back in!');

  } catch (error) {
    console.error('❌ Error applying fix:', error.message);
    console.log('\n💡 Please run the SQL manually:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of supabase/fix-role-persistence.sql');
    console.log('4. Run the query');
  }
}

// Run the fix
applyRolePersistenceFix();