-- =====================================================
-- SIMPLIFY ROLE MANAGEMENT
-- =====================================================
-- This script simplifies the role management by removing 
-- the fragile syncing mechanism between auth.users and profiles.
-- The profiles table becomes the single source of truth for user roles.

-- Step 1: Drop existing triggers and functions related to role syncing.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS sync_role_to_auth_metadata ON profiles;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_user_metadata_role();

-- Step 2: Create a simplified and secure function to handle new users.
-- This function creates a profile with a default 'user' role.
-- It does NOT trust raw_user_meta_data for the role.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'user' -- Always default to 'user' role.
    )
    ON CONFLICT (id) DO NOTHING; -- If profile already exists, do nothing.

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Recreate the trigger on auth.users.
-- This trigger now only fires on INSERT.
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user();

-- Step 4: Grant permissions.
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;

-- Step 5: (Optional but recommended) Clean up raw_user_meta_data.
-- Remove the 'role' key from all users' metadata to avoid confusion.
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role';

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Role management has been simplified successfully!';
    RAISE NOTICE 'The profiles table is now the single source of truth for roles.';
END $$;
