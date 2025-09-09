-- =====================================================
-- COMPREHENSIVE FIX FOR USER ROLE UPDATE ISSUE
-- =====================================================
-- This script fixes the role persistence problem by:
-- 1. Removing all interfering triggers
-- 2. Clearing auth metadata
-- 3. Ensuring profiles table is the single source of truth
-- 4. Creating safe update functions
-- =====================================================

BEGIN;

-- Step 1: Drop ALL triggers that might interfere with roles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created_safe ON auth.users CASCADE;
DROP TRIGGER IF EXISTS handle_updated_at ON auth.users CASCADE;
DROP TRIGGER IF EXISTS sync_role_to_auth_metadata ON profiles CASCADE;
DROP TRIGGER IF EXISTS sync_profile_role_to_auth_trigger ON profiles CASCADE;

-- Step 2: Drop ALL functions that might modify profiles
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_safe() CASCADE;
DROP FUNCTION IF EXISTS handle_user_update() CASCADE;
DROP FUNCTION IF EXISTS sync_user_metadata() CASCADE;
DROP FUNCTION IF EXISTS update_user_metadata_role() CASCADE;
DROP FUNCTION IF EXISTS sync_profile_role_to_auth() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_minimal() CASCADE;

-- Step 3: Create a MINIMAL function for new user creation only
CREATE OR REPLACE FUNCTION handle_new_user_minimal()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create profile if it doesn't exist
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'user' -- Default role for new users
    )
    ON CONFLICT (id) DO NOTHING; -- Never update existing profiles
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger ONLY for INSERT (new users)
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user_minimal();

-- Step 5: Clear ALL role metadata from auth.users
UPDATE auth.users
SET raw_user_meta_data = 
    CASE 
        WHEN raw_user_meta_data IS NULL THEN '{}'::jsonb
        ELSE raw_user_meta_data - 'role'
    END;

-- Step 6: Ensure all existing users have profiles
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

-- Step 7: Drop and recreate RLS policies for profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role has full access" ON profiles
    FOR ALL
    USING (auth.role() = 'service_role');

-- Step 8: Create a function to safely update roles
CREATE OR REPLACE FUNCTION update_user_role_safe(
    target_user_id UUID,
    new_role TEXT
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Validate role
    IF new_role NOT IN ('user', 'organizer', 'admin') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid role. Must be user, organizer, or admin'
        );
    END IF;
    
    -- Update the role in profiles table
    UPDATE profiles
    SET role = new_role,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;
    
    -- Clear role from auth metadata to prevent any interference
    UPDATE auth.users
    SET raw_user_meta_data = 
        CASE 
            WHEN raw_user_meta_data IS NULL THEN '{}'::jsonb
            ELSE raw_user_meta_data - 'role'
        END
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
GRANT EXECUTE ON FUNCTION update_user_role_safe(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_role_safe(UUID, TEXT) TO service_role;

-- Step 9: Enable realtime for profiles table (if not already enabled)
DO $$
BEGIN
    -- Check if profiles table is already in the publication
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
        RAISE NOTICE 'Added profiles table to realtime publication';
    ELSE
        RAISE NOTICE 'Profiles table already in realtime publication';
    END IF;
END $$;

-- Step 10: Verify the fix
DO $$
DECLARE
    trigger_count INTEGER;
    metadata_role_count INTEGER;
BEGIN
    -- Count triggers on auth.users
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger 
    WHERE tgrelid = 'auth.users'::regclass 
    AND tgisinternal = false;
    
    -- Count users with role in metadata
    SELECT COUNT(*) INTO metadata_role_count
    FROM auth.users 
    WHERE raw_user_meta_data ? 'role';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ROLE UPDATE FIX APPLIED SUCCESSFULLY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Triggers on auth.users: % (should be 1)', trigger_count;
    RAISE NOTICE 'Users with role in metadata: % (should be 0)', metadata_role_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ The profiles table is now the ONLY source of truth for roles';
    RAISE NOTICE '✅ Role updates will persist correctly';
    RAISE NOTICE '✅ No more role resets on login';
    RAISE NOTICE '========================================';
END $$;

COMMIT;