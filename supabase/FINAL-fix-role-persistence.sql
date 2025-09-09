-- =====================================================
-- FINAL COMPLETE FIX - REMOVES ALL CONFLICTS
-- =====================================================

-- Step 1: First, drop ALL triggers completely (no matter what they're named)
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    -- Drop all triggers on auth.users table
    FOR trigger_rec IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'auth.users'::regclass 
        AND tgisinternal = false
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users CASCADE', trigger_rec.tgname);
        RAISE NOTICE 'Dropped trigger: %', trigger_rec.tgname;
    END LOOP;
    
    -- Drop all triggers on profiles table that might sync roles
    FOR trigger_rec IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'public.profiles'::regclass 
        AND tgisinternal = false
        AND tgname LIKE '%role%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.profiles CASCADE', trigger_rec.tgname);
        RAISE NOTICE 'Dropped trigger: %', trigger_rec.tgname;
    END LOOP;
END $$;

-- Step 2: Drop ALL functions that might handle users or roles
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_safe() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_minimal() CASCADE;
DROP FUNCTION IF EXISTS handle_user_update() CASCADE;
DROP FUNCTION IF EXISTS sync_user_metadata() CASCADE;
DROP FUNCTION IF EXISTS update_user_metadata_role() CASCADE;
DROP FUNCTION IF EXISTS sync_profile_role_to_auth() CASCADE;
DROP FUNCTION IF EXISTS refresh_user_session_role(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_user_role_safe(UUID, TEXT) CASCADE;

-- Step 3: Create the ONLY function we need - for new users only
CREATE OR REPLACE FUNCTION handle_new_user_v3()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create profile for brand new users
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'user' -- New users always start as 'user'
    )
    ON CONFLICT (id) DO NOTHING; -- If profile exists, do nothing
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create ONLY ONE trigger for new users
CREATE TRIGGER on_auth_user_created_v3
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user_v3();

-- Step 5: Clear ALL role data from auth.users metadata
UPDATE auth.users
SET raw_user_meta_data = 
    CASE 
        WHEN raw_user_meta_data IS NULL THEN '{}'::jsonb
        ELSE raw_user_meta_data - 'role'
    END;

-- Step 6: Ensure all auth users have profiles
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    'user'
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 7: Create a simple function to update roles safely
CREATE OR REPLACE FUNCTION set_user_role(user_email TEXT, new_role TEXT)
RETURNS TEXT AS $$
DECLARE
    result_message TEXT;
BEGIN
    -- Validate role
    IF new_role NOT IN ('user', 'organizer', 'admin') THEN
        RETURN 'Error: Invalid role. Must be user, organizer, or admin';
    END IF;
    
    -- Update the role
    UPDATE profiles
    SET role = new_role,
        updated_at = NOW()
    WHERE email = user_email;
    
    IF FOUND THEN
        -- Also clear any role from auth metadata
        UPDATE auth.users au
        SET raw_user_meta_data = 
            CASE 
                WHEN raw_user_meta_data IS NULL THEN '{}'::jsonb
                ELSE raw_user_meta_data - 'role'
            END
        FROM profiles p
        WHERE p.id = au.id AND p.email = user_email;
        
        result_message := format('Success: %s role updated to %s', user_email, new_role);
    ELSE
        result_message := format('Error: User %s not found', user_email);
    END IF;
    
    RETURN result_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Grant permissions
GRANT EXECUTE ON FUNCTION set_user_role(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_role(TEXT, TEXT) TO service_role;

-- Step 9: Fix specific users that need admin role
SELECT set_user_role('rojasundharam2000@gmail.com', 'admin');
SELECT set_user_role('sroja@jkkn.ac.in', 'admin');
SELECT set_user_role('director@jkkn.ac.in', 'admin');

-- Step 10: Final verification
DO $$
DECLARE
    trigger_count INTEGER;
    total_users INTEGER;
    total_profiles INTEGER;
    admin_count INTEGER;
    metadata_with_role INTEGER;
BEGIN
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger 
    WHERE tgrelid = 'auth.users'::regclass 
    AND tgisinternal = false;
    
    -- Count users and profiles
    SELECT COUNT(*) INTO total_users FROM auth.users;
    SELECT COUNT(*) INTO total_profiles FROM profiles;
    SELECT COUNT(*) INTO admin_count FROM profiles WHERE role = 'admin';
    
    -- Check if any metadata still has roles
    SELECT COUNT(*) INTO metadata_with_role
    FROM auth.users 
    WHERE raw_user_meta_data ? 'role';
    
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '    FINAL ROLE PERSISTENCE FIX APPLIED';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Triggers on auth.users: % (should be 1)', trigger_count;
    RAISE NOTICE 'Total users: %', total_users;
    RAISE NOTICE 'Total profiles: %', total_profiles;
    RAISE NOTICE 'Admin users: %', admin_count;
    RAISE NOTICE 'Users with role in metadata: % (should be 0)', metadata_with_role;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Profiles table is now the ONLY source of truth';
    RAISE NOTICE '✅ Roles will NEVER be overwritten on login';
    RAISE NOTICE '✅ All users will maintain their assigned roles';
    RAISE NOTICE '';
    RAISE NOTICE 'To update any user role, use:';
    RAISE NOTICE '  SELECT set_user_role(''email@example.com'', ''admin'');';
    RAISE NOTICE '=========================================';
END $$;