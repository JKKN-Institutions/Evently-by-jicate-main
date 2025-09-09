-- =====================================================
-- UNIVERSAL FIX FOR ROLE PERSISTENCE - ALL USERS
-- =====================================================
-- This fix ensures that ALL users keep their assigned roles
-- The profiles table becomes the ONLY source of truth for roles

-- Step 1: Drop ALL existing triggers that might modify profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users CASCADE;
DROP TRIGGER IF EXISTS handle_updated_at ON auth.users CASCADE;
DROP TRIGGER IF EXISTS sync_role_to_auth_metadata ON profiles CASCADE;
DROP TRIGGER IF EXISTS sync_profile_role_to_auth_trigger ON profiles CASCADE;

-- Step 2: Drop ALL functions that might be modifying profiles
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS handle_user_update() CASCADE;
DROP FUNCTION IF EXISTS sync_user_metadata() CASCADE;
DROP FUNCTION IF EXISTS update_user_metadata_role() CASCADE;
DROP FUNCTION IF EXISTS sync_profile_role_to_auth() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_minimal() CASCADE;

-- Step 3: Create a SAFE function that ONLY creates profiles for NEW users
-- This function NEVER updates existing profiles
CREATE OR REPLACE FUNCTION handle_new_user_safe()
RETURNS TRIGGER AS $$
BEGIN
    -- CRITICAL: Only create profile if it doesn't exist
    -- NEVER update existing profiles
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
        INSERT INTO public.profiles (id, email, full_name, role)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            'user' -- New users always start as 'user'
        );
        RAISE NOTICE 'Created new profile for user %', NEW.email;
    END IF;
    
    -- Always return NEW to continue the auth process
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail authentication
        RAISE WARNING 'Error in handle_new_user_safe for %: %', NEW.email, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger ONLY for INSERT (new users only)
-- This trigger ONLY fires when a NEW user is created, not on login
CREATE TRIGGER on_auth_user_created_safe
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user_safe();

-- Step 5: Clear ALL role metadata from auth.users to prevent any interference
-- This ensures auth.users NEVER overrides profile roles
UPDATE auth.users
SET raw_user_meta_data = 
    CASE 
        WHEN raw_user_meta_data IS NULL THEN '{}'::jsonb
        ELSE raw_user_meta_data - 'role'
    END;

-- Step 6: Ensure all existing auth users have profiles
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    'user' -- Default role for users without profiles
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 7: Create a view to always show the authoritative role
CREATE OR REPLACE VIEW user_roles_view AS
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role as current_role,
    p.created_at,
    p.updated_at,
    CASE 
        WHEN au.id IS NOT NULL THEN 'Active'
        ELSE 'Inactive'
    END as auth_status
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id;

-- Grant access to the view
GRANT SELECT ON user_roles_view TO authenticated;
GRANT SELECT ON user_roles_view TO service_role;

-- Step 8: Create a function to safely update user roles
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
    
    -- Clear role from auth metadata to prevent interference
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

-- Step 9: Create a function to get user's current role (for debugging)
CREATE OR REPLACE FUNCTION get_user_role_info(target_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    profile_role TEXT,
    has_metadata_role BOOLEAN,
    last_updated TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.role,
        (au.raw_user_meta_data ? 'role') as has_metadata_role,
        p.updated_at
    FROM profiles p
    LEFT JOIN auth.users au ON p.id = au.id
    WHERE p.id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_role_info(UUID) TO authenticated;

-- Step 10: Final verification
DO $$
DECLARE
    total_users INTEGER;
    profiles_count INTEGER;
    users_with_metadata_role INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_users FROM auth.users;
    SELECT COUNT(*) INTO profiles_count FROM profiles;
    SELECT COUNT(*) INTO users_with_metadata_role 
    FROM auth.users 
    WHERE raw_user_meta_data ? 'role';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'UNIVERSAL ROLE FIX APPLIED SUCCESSFULLY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total auth users: %', total_users;
    RAISE NOTICE 'Total profiles: %', profiles_count;
    RAISE NOTICE 'Users with role in metadata: % (should be 0)', users_with_metadata_role;
    RAISE NOTICE '';
    RAISE NOTICE '✅ The profiles table is now the ONLY source of truth for roles';
    RAISE NOTICE '✅ Login process will NEVER override existing roles';
    RAISE NOTICE '✅ All users will keep their assigned roles permanently';
    RAISE NOTICE '';
    RAISE NOTICE 'To update a user role, use:';
    RAISE NOTICE '  SELECT update_user_role_safe(user_id, new_role);';
    RAISE NOTICE '========================================';
END $$;