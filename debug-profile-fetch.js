// Run this in browser console to check the profile fetch
async function debugProfileFetch() {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Current user:', user);
  
  if (user) {
    // Try to fetch profile directly
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    console.log('Profile fetch result:', { profile, error });
    
    // Check auth metadata
    console.log('User metadata:', user.user_metadata);
    console.log('User app metadata:', user.app_metadata);
  }
}

debugProfileFetch();