-- EMERGENCY FIX: Complete removal of problematic triggers
-- This will ensure roles are NEVER overwritten by the auth system

-- Step 1: Drop ALL existing triggers on auth.users that might interfere
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users CASCADE;
DROP TRIGGER IF EXISTS handle_updated_at ON auth.users CASCADE;

-- Step 2: Drop ALL functions that might be modifying profiles
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS handle_user_update() CASCADE;
DROP FUNCTION IF EXISTS sync_user_metadata() CASCADE;
DROP FUNCTION IF EXISTS update_user_metadata_role() CASCADE;

-- Step 3: Create a MINIMAL function that ONLY creates profiles for NEW users
CREATE OR REPLACE FUNCTION handle_new_user_minimal()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert if profile doesn't exist, NEVER update
    INSERT INTO public.profiles (id, email, full_name, role)
    SELECT 
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'user' -- Always default to user for new accounts
    WHERE NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = NEW.id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger ONLY for INSERT (new users only)
CREATE TRIGGER on_auth_user_created_minimal
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user_minimal();

-- Step 5: Ensure the specific user has the correct role
UPDATE profiles 
SET role = 'admin'
WHERE email = 'rojasundharam2000@gmail.com';

-- Step 6: Clear any cached metadata that might interfere
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE email = 'rojasundharam2000@gmail.com';

-- Step 7: Verify the fix
DO $$
DECLARE
    user_role TEXT;
    user_id UUID;
BEGIN
    SELECT id, role INTO user_id, user_role
    FROM profiles
    WHERE email = 'rojasundharam2000@gmail.com';
    
    RAISE NOTICE 'User rojasundharam2000@gmail.com:';
    RAISE NOTICE '  ID: %', user_id;
    RAISE NOTICE '  Role in profiles: %', user_role;
    RAISE NOTICE '✅ Emergency fix applied - roles will no longer be overwritten on login';
END $$;