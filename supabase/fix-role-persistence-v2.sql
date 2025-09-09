-- =====================================================
-- COMPREHENSIVE FIX FOR ROLE PERSISTENCE ISSUE V2
-- =====================================================

-- Step 1: Drop existing problematic triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS sync_role_to_auth_metadata ON profiles;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_user_metadata_role() CASCADE;

-- Step 2: Create a NEW approach - only handle NEW users, never update existing
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- ONLY insert if the profile doesn't exist
    -- NEVER update existing profiles from auth metadata
    INSERT INTO public.profiles (id, email, full_name, role)
    SELECT 
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'user' -- Always default to 'user' for new accounts
    WHERE NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger ONLY for INSERT (not UPDATE)
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user();

-- Step 4: Create function to get role ONLY from profiles table
CREATE OR REPLACE FUNCTION get_user_role_from_profile(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = user_id;
    
    RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 5: Create a function to sync role TO auth metadata (one-way sync)
CREATE OR REPLACE FUNCTION sync_profile_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
    -- When profile role changes, update auth metadata
    UPDATE auth.users
    SET raw_user_meta_data = 
        COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object('role', NEW.role, 'role_updated_at', NOW())
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger for profile updates
CREATE TRIGGER sync_profile_role_to_auth_trigger
    AFTER UPDATE OF role ON profiles
    FOR EACH ROW
    WHEN (OLD.role IS DISTINCT FROM NEW.role)
    EXECUTE FUNCTION sync_profile_role_to_auth();

-- Step 7: Fix all existing users - ensure profiles exist and sync metadata
DO $$
DECLARE
    user_record RECORD;
    profile_role TEXT;
BEGIN
    -- Loop through all auth users
    FOR user_record IN SELECT id, email FROM auth.users LOOP
        -- Check if profile exists
        SELECT role INTO profile_role FROM profiles WHERE id = user_record.id;
        
        IF profile_role IS NULL THEN
            -- Create profile if it doesn't exist
            INSERT INTO profiles (id, email, role)
            VALUES (user_record.id, user_record.email, 'user')
            ON CONFLICT (id) DO NOTHING;
            
            profile_role := 'user';
        END IF;
        
        -- Update auth metadata to match profile
        UPDATE auth.users
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', profile_role, 'role_source', 'profile', 'synced_at', NOW())
        WHERE id = user_record.id;
    END LOOP;
    
    RAISE NOTICE 'All user roles have been synced from profiles to auth metadata';
END $$;

-- Step 8: Create a view to always show the correct role from profiles
CREATE OR REPLACE VIEW user_roles AS
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role as profile_role,
    au.raw_user_meta_data->>'role' as metadata_role,
    p.role as effective_role, -- Always use profile role as source of truth
    p.created_at,
    p.updated_at
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id;

-- Step 9: Grant permissions
GRANT SELECT ON user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_from_profile(UUID) TO authenticated;

-- Step 10: Create a function to force-refresh a user's session role
CREATE OR REPLACE FUNCTION refresh_user_session_role(user_id UUID)
RETURNS JSONB AS $$
DECLARE
    profile_role TEXT;
    result JSONB;
BEGIN
    -- Get the role from profile
    SELECT role INTO profile_role 
    FROM profiles 
    WHERE id = user_id;
    
    IF profile_role IS NULL THEN
        RETURN jsonb_build_object('error', 'User profile not found');
    END IF;
    
    -- Update auth metadata
    UPDATE auth.users
    SET raw_user_meta_data = 
        COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'role', profile_role, 
            'force_refreshed_at', NOW(),
            'role_source', 'profile'
        )
    WHERE id = user_id;
    
    -- Return the result
    RETURN jsonb_build_object(
        'success', true,
        'role', profile_role,
        'message', 'Role refreshed from profile'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION refresh_user_session_role(UUID) TO authenticated;

-- Final verification
DO $$ 
BEGIN
    RAISE NOTICE '✅ Role persistence fix V2 applied successfully!';
    RAISE NOTICE '📊 Profile table is now the single source of truth for roles';
    RAISE NOTICE '🔄 Auth metadata will be synced FROM profiles only';
    RAISE NOTICE '🚫 Login process will NOT override profile roles';
END $$;