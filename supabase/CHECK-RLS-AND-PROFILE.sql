-- =====================================================
-- CHECK RLS AND PROFILE ISSUES
-- =====================================================

-- 1. Check the actual profile data in the database
SELECT id, email, role, updated_at 
FROM profiles 
WHERE email IN ('rojasundharam2000@gmail.com', 'piradeep.s@jkkn.ac.in')
ORDER BY updated_at DESC;

-- 2. Check if RLS is enabled on profiles table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- 3. List all RLS policies on profiles table
SELECT 
    polname as policy_name,
    polcmd as command,
    pg_get_expr(polqual, polrelid) as using_expression,
    pg_get_expr(polwithcheck, polrelid) as with_check_expression,
    polroles::regrole[] as roles
FROM pg_policy 
WHERE polrelid = 'public.profiles'::regclass;

-- 4. Check if there are any UPDATE triggers on profiles
SELECT 
    tgname as trigger_name,
    p.proname as function_name,
    tgtype
FROM pg_trigger t
LEFT JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'public.profiles'::regclass 
AND t.tgisinternal = false;

-- 5. Force update the profile to admin (using service role)
UPDATE profiles 
SET role = 'admin', 
    updated_at = NOW() 
WHERE email IN ('rojasundharam2000@gmail.com', 'piradeep.s@jkkn.ac.in');

-- 6. Verify the update
SELECT id, email, role, updated_at 
FROM profiles 
WHERE email IN ('rojasundharam2000@gmail.com', 'piradeep.s@jkkn.ac.in');

-- 7. Test if a regular SELECT would return the correct role
-- This simulates what the client would see
DO $$
DECLARE
    test_role TEXT;
    test_user_id UUID;
BEGIN
    -- Get user ID
    SELECT id INTO test_user_id 
    FROM profiles 
    WHERE email = 'piradeep.s@jkkn.ac.in' 
    LIMIT 1;
    
    -- Simulate a client query
    SELECT role INTO test_role 
    FROM profiles 
    WHERE id = test_user_id;
    
    RAISE NOTICE 'Profile role for piradeep.s@jkkn.ac.in: %', test_role;
    
    IF test_role = 'admin' THEN
        RAISE NOTICE '✅ Role is correctly set to admin in database';
    ELSE
        RAISE NOTICE '❌ Role is NOT admin in database: %', test_role;
    END IF;
END $$;