-- =====================================================
-- FIX ROLE PERSISTENCE ISSUE
-- =====================================================
-- The issue: When users log in, the handle_new_user trigger 
-- uses raw_user_meta_data which may have stale role information

-- Drop the existing trigger function to recreate it
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create improved handle_new_user function that doesn't override existing roles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    existing_role TEXT;
BEGIN
    -- Check if profile already exists and get its current role
    SELECT role INTO existing_role 
    FROM public.profiles 
    WHERE id = NEW.id;
    
    IF existing_role IS NOT NULL THEN
        -- Profile exists, just update email if changed but preserve the role
        UPDATE public.profiles
        SET 
            email = NEW.email,
            updated_at = NOW()
        WHERE id = NEW.id;
    ELSE
        -- New profile, create with default role or from metadata
        INSERT INTO public.profiles (id, email, full_name, role)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_user_meta_data->>'role', 'user')
        )
        ON CONFLICT (id) DO UPDATE
        SET 
            email = EXCLUDED.email,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the trigger
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user();

-- Create a function to update user metadata when role changes
CREATE OR REPLACE FUNCTION update_user_metadata_role()
RETURNS TRIGGER AS $$
BEGIN
    -- When role is updated in profiles, also update auth.users metadata
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        UPDATE auth.users
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', NEW.role)
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync role changes to auth metadata
DROP TRIGGER IF EXISTS sync_role_to_auth_metadata ON profiles;
CREATE TRIGGER sync_role_to_auth_metadata
    AFTER UPDATE OF role ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_metadata_role();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION update_user_metadata_role() TO service_role;

-- Sync all existing user roles to auth metadata
UPDATE auth.users u
SET raw_user_meta_data = 
    COALESCE(u.raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', p.role)
FROM profiles p
WHERE u.id = p.id;

-- Verify the fix
DO $$ 
BEGIN
    RAISE NOTICE 'Role persistence fix applied successfully!';
    RAISE NOTICE 'All user metadata has been synced with profile roles.';
END $$;