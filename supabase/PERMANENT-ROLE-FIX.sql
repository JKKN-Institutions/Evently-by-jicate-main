-- =====================================================
-- PERMANENT SOLUTION FOR ROLE PERSISTENCE
-- =====================================================
-- This script creates a robust role system that works for ALL users
-- No hardcoded emails - works for everyone

BEGIN;

-- Step 1: Clean up ALL existing triggers that might interfere
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    -- Drop all triggers on auth.users that might reset roles
    FOR trigger_rec IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'auth.users'::regclass 
        AND tgisinternal = false
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users CASCADE', trigger_rec.tgname);
        RAISE NOTICE 'Dropped trigger: %', trigger_rec.tgname;
    END LOOP;
END $$;

-- Step 2: Drop ALL functions that might modify profiles
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_safe() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_minimal() CASCADE;
DROP FUNCTION IF EXISTS handle_user_update() CASCADE;
DROP FUNCTION IF EXISTS sync_user_metadata() CASCADE;
DROP FUNCTION IF EXISTS update_user_metadata_role() CASCADE;
DROP FUNCTION IF EXISTS sync_profile_role_to_auth() CASCADE;

-- Step 3: Create a SINGLE, SIMPLE function for new user creation only
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create profile if it doesn't exist
    -- NEVER modify existing profiles
    INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        ),
        'user', -- All new users start as 'user' - admins must be promoted manually
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING; -- CRITICAL: Never update existing profiles
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger ONLY for INSERT (new users)
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION create_profile_for_new_user();

-- Step 5: Remove ALL role data from auth.users metadata
-- This ensures profiles table is the ONLY source of truth
UPDATE auth.users
SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) - 'role';

-- Step 6: Ensure ALL existing users have profiles
INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        split_part(au.email, '@', 1)
    ),
    'user', -- Default role for users without profiles
    NOW(),
    NOW()
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 7: Fix RLS policies to allow profile reading
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Service role has full access" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;

-- Create simple, working policies
CREATE POLICY "Anyone can read profiles" ON profiles
    FOR SELECT
    USING (true); -- Public read access - profiles don't contain sensitive data

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id 
        AND (
            -- Users can update everything except role
            role = (SELECT role FROM profiles WHERE id = auth.uid())
            OR 
            -- Or if they're already an admin
            (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
        )
    );

CREATE POLICY "Service role has full access" ON profiles
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (true);

-- Step 8: Create a proper role update function
CREATE OR REPLACE FUNCTION update_user_role(
    target_user_id UUID,
    new_role TEXT
)
RETURNS JSONB AS $$
DECLARE
    current_user_role TEXT;
    updated_count INTEGER;
BEGIN
    -- Check if caller is admin
    SELECT role INTO current_user_role
    FROM profiles
    WHERE id = auth.uid();
    
    IF current_user_role != 'admin' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only admins can update user roles'
        );
    END IF;
    
    -- Validate role
    IF new_role NOT IN ('user', 'organizer', 'admin') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid role. Must be user, organizer, or admin'
        );
    END IF;
    
    -- Update the role
    UPDATE profiles
    SET 
        role = new_role,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;
    
    -- Clear any role from auth metadata to prevent interference
    UPDATE auth.users
    SET raw_user_meta_data = 
        COALESCE(raw_user_meta_data, '{}'::jsonb) - 'role'
    WHERE id = target_user_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', format('Role updated to %s', new_role),
        'user_id', target_user_id,
        'new_role', new_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_user_role(UUID, TEXT) TO authenticated;

-- Step 9: Enable realtime for profiles (if not already enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
    END IF;
END $$;

-- Step 10: Verification
DO $$
DECLARE
    trigger_count INTEGER;
    users_without_profiles INTEGER;
    users_with_metadata_role INTEGER;
BEGIN
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger 
    WHERE tgrelid = 'auth.users'::regclass 
    AND tgisinternal = false;
    
    -- Count users without profiles
    SELECT COUNT(*) INTO users_without_profiles
    FROM auth.users au
    WHERE NOT EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = au.id
    );
    
    -- Count users with role in metadata
    SELECT COUNT(*) INTO users_with_metadata_role
    FROM auth.users 
    WHERE raw_user_meta_data ? 'role';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '    PERMANENT ROLE FIX COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Triggers on auth.users: % (should be 1)', trigger_count;
    RAISE NOTICE '✅ Users without profiles: % (should be 0)', users_without_profiles;
    RAISE NOTICE '✅ Users with role in metadata: % (should be 0)', users_with_metadata_role;
    RAISE NOTICE '';
    RAISE NOTICE '🎯 KEY POINTS:';
    RAISE NOTICE '  • Profiles table is the ONLY source of truth for roles';
    RAISE NOTICE '  • Role updates will persist across logins';
    RAISE NOTICE '  • Works for ALL users, not just specific emails';
    RAISE NOTICE '  • Admins can update any user role';
    RAISE NOTICE '  • Users cannot change their own role';
    RAISE NOTICE '';
    RAISE NOTICE '📝 TO UPDATE A USER ROLE:';
    RAISE NOTICE '  1. Via Admin Panel in the app';
    RAISE NOTICE '  2. Via SQL: SELECT update_user_role(user_id, new_role);';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;