const { createClient } = require('@supabase/supabase-js');
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

async function applyUniversalRoleFix() {
  console.log('🔧 Applying Universal Role Persistence Fix...\n');

  try {
    // Since we can't execute raw SQL directly, we'll use the Supabase Admin API
    // to fix the immediate issue for all users
    
    console.log('Step 1: Fetching all users with profiles...');
    
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, role');
    
    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }
    
    console.log(`Found ${profiles.length} user profiles\n`);
    
    console.log('Step 2: Clearing role metadata from all users...');
    
    let clearedCount = 0;
    let errorCount = 0;
    
    for (const profile of profiles) {
      try {
        // Get user data
        const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(profile.id);
        
        if (getUserError) {
          console.warn(`  ⚠️  Could not get user ${profile.email}: ${getUserError.message}`);
          errorCount++;
          continue;
        }
        
        if (userData?.user) {
          const currentMetadata = userData.user.user_metadata || {};
          
          // Only update if role exists in metadata
          if (currentMetadata.role) {
            delete currentMetadata.role;
            
            // Update user metadata without role
            const { error: updateError } = await supabase.auth.admin.updateUserById(
              profile.id,
              { user_metadata: currentMetadata }
            );
            
            if (updateError) {
              console.warn(`  ⚠️  Could not update metadata for ${profile.email}: ${updateError.message}`);
              errorCount++;
            } else {
              console.log(`  ✅ Cleared role metadata for ${profile.email} (Profile role: ${profile.role})`);
              clearedCount++;
            }
          } else {
            console.log(`  ✔️  ${profile.email} has no role in metadata (Profile role: ${profile.role})`);
          }
        }
      } catch (err) {
        console.error(`  ❌ Error processing ${profile.email}:`, err.message);
        errorCount++;
      }
    }
    
    console.log('\n========================================');
    console.log('UNIVERSAL ROLE FIX RESULTS:');
    console.log('========================================');
    console.log(`✅ Cleared metadata for ${clearedCount} users`);
    console.log(`📊 Total profiles processed: ${profiles.length}`);
    if (errorCount > 0) {
      console.log(`⚠️  Errors encountered: ${errorCount}`);
    }
    console.log('========================================\n');
    
    console.log('⚠️  IMPORTANT: You still need to run the SQL fix in Supabase Dashboard!');
    console.log('📋 SQL file location: supabase/UNIVERSAL-fix-role-persistence.sql');
    console.log('\nThe SQL fix will:');
    console.log('1. Remove problematic database triggers');
    console.log('2. Ensure roles never get overwritten on login');
    console.log('3. Make the fix permanent\n');
    
    console.log('To apply the SQL fix:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the SQL from the file above');
    console.log('4. Run the query\n');
    
    // Test specific user
    console.log('Testing specific user: rojasundharam2000@gmail.com');
    const { data: testProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('email', 'rojasundharam2000@gmail.com')
      .single();
    
    if (testProfile) {
      console.log(`Current role in profile: ${testProfile.role}`);
      
      // Ensure it's set to admin if needed
      if (testProfile.role !== 'admin') {
        const { error: updateRoleError } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('email', 'rojasundharam2000@gmail.com');
        
        if (!updateRoleError) {
          console.log('✅ Updated rojasundharam2000@gmail.com to admin role');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error applying fix:', error.message);
    console.log('\n💡 Manual fix required:');
    console.log('Please run the SQL fix manually in your Supabase Dashboard');
  }
}

// Run the fix
applyUniversalRoleFix();