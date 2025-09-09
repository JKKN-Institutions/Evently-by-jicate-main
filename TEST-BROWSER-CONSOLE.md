# Browser Console Debug Commands

Open your browser console (F12) and run these commands to debug:

```javascript
// 1. Check if there's a session
const checkSession = async () => {
  const { createClient } = await import('/lib/supabase/client');
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  console.log('Session:', session);
  return session;
};
checkSession();

// 2. Check localStorage for auth data
console.log('Auth localStorage keys:', Object.keys(localStorage).filter(k => k.includes('supabase')));

// 3. Get the current user
const getUser = async () => {
  const { createClient } = await import('/lib/supabase/client');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Current user:', user);
  return user;
};
getUser();

// 4. Directly fetch profile
const fetchProfile = async () => {
  const { createClient } = await import('/lib/supabase/client');
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    console.log('Profile fetch:', { data, error });
    return data;
  }
};
fetchProfile();
```

Please run these commands and share what you see in the console.