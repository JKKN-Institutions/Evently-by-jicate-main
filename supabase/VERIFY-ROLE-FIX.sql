-- =====================================================
-- VERIFY ROLE FIX IS WORKING
-- =====================================================

-- 1. Check current triggers on auth.users (should only be 1)
SELECT 
    tgname as trigger_name,
    p.proname as function_name
FROM pg_trigger t
LEFT JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'auth.users'::regclass 
AND t.tgisinternal = false;

-- 2. Check if any users still have role in metadata (should be 0)
SELECT 
    COUNT(*) as users_with_role_in_metadata,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ GOOD: No users have role in metadata'
        ELSE '❌ BAD: Some users still have role in metadata'
    END as status
FROM auth.users 
WHERE raw_user_meta_data ? 'role';

-- 3. Check all user profiles and their roles
SELECT 
    p.email,
    p.role,
    p.updated_at,
    CASE 
        WHEN au.raw_user_meta_data ? 'role' THEN '❌ Has metadata role: ' || (au.raw_user_meta_data->>'role')
        ELSE '✅ No metadata role'
    END as metadata_status
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
ORDER BY p.updated_at DESC
LIMIT 10;

-- 4. Test the update function (update a test user to organizer)
-- Replace 'test@example.com' with an actual user email
DO $$
DECLARE
    test_user_id UUID;
    result JSONB;
BEGIN
    -- Get a user to test with (not an admin)
    SELECT id INTO test_user_id 
    FROM profiles 
    WHERE role = 'user' 
    LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Try updating their role
        SELECT update_user_role_safe(test_user_id, 'organizer') INTO result;
        RAISE NOTICE 'Update test result: %', result;
        
        -- Revert back to user
        SELECT update_user_role_safe(test_user_id, 'user') INTO result;
        RAISE NOTICE 'Revert test result: %', result;
    ELSE
        RAISE NOTICE 'No test user found';
    END IF;
END $$;

-- 5. Check RLS policies on profiles table
SELECT 
    polname as policy_name,
    CASE polcmd 
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        ELSE 'ALL'
    END as operation
FROM pg_policy 
WHERE polrelid = 'public.profiles'::regclass;

-- 6. Final status summary
DO $$
DECLARE
    trigger_count INTEGER;
    metadata_role_count INTEGER;
    profile_count INTEGER;
    admin_count INTEGER;
    organizer_count INTEGER;
    user_count INTEGER;
BEGIN
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger 
    WHERE tgrelid = 'auth.users'::regclass 
    AND tgisinternal = false;
    
    -- Count users with role in metadata
    SELECT COUNT(*) INTO metadata_role_count
    FROM auth.users 
    WHERE raw_user_meta_data ? 'role';
    
    -- Count profiles by role
    SELECT COUNT(*) INTO profile_count FROM profiles;
    SELECT COUNT(*) INTO admin_count FROM profiles WHERE role = 'admin';
    SELECT COUNT(*) INTO organizer_count FROM profiles WHERE role = 'organizer';
    SELECT COUNT(*) INTO user_count FROM profiles WHERE role = 'user';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '         ROLE FIX VERIFICATION          ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 STATISTICS:';
    RAISE NOTICE '  Total profiles: %', profile_count;
    RAISE NOTICE '  Admins: %', admin_count;
    RAISE NOTICE '  Organizers: %', organizer_count;
    RAISE NOTICE '  Users: %', user_count;
    RAISE NOTICE '';
    RAISE NOTICE '🔧 SYSTEM STATUS:';
    RAISE NOTICE '  Triggers on auth.users: % (should be 1)', trigger_count;
    RAISE NOTICE '  Users with role in metadata: % (should be 0)', metadata_role_count;
    RAISE NOTICE '';
    
    IF trigger_count = 1 AND metadata_role_count = 0 THEN
        RAISE NOTICE '✅ SUCCESS: Role system is properly configured!';
        RAISE NOTICE '✅ Profiles table is the single source of truth';
        RAISE NOTICE '✅ Role updates will now persist correctly';
    ELSE
        RAISE NOTICE '⚠️  WARNING: Some issues detected';
        IF trigger_count > 1 THEN
            RAISE NOTICE '  - Too many triggers on auth.users';
        END IF;
        IF metadata_role_count > 0 THEN
            RAISE NOTICE '  - Some users still have role in metadata';
        END IF;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;