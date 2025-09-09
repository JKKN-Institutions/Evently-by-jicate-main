-- =====================================================
-- FORCE FIX - ABSOLUTE SOLUTION
-- =====================================================

-- Step 1: Completely disable ALL triggers first
ALTER TABLE auth.users DISABLE TRIGGER ALL;
ALTER TABLE public.profiles DISABLE TRIGGER ALL;

-- Step 2: Drop EVERYTHING related to user handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created_v3 ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created_safe ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created_minimal ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users CASCADE;

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_v3() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_safe() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_minimal() CASCADE;
DROP FUNCTION IF EXISTS handle_user_update() CASCADE;

-- Step 3: Re-enable system triggers but NOT our custom ones
ALTER TABLE auth.users ENABLE TRIGGER ALL;
ALTER TABLE public.profiles ENABLE TRIGGER ALL;

-- Step 4: Force update the specific user to admin
UPDATE profiles 
SET role = 'admin', updated_at = NOW()
WHERE email = 'rojasundharam2000@gmail.com';

-- Step 5: Clear ALL metadata completely for this user
UPDATE auth.users
SET raw_user_meta_data = '{}'::jsonb
WHERE email = 'rojasundharam2000@gmail.com';

-- Step 6: Create a MINIMAL trigger that does NOTHING for existing users
CREATE OR REPLACE FUNCTION handle_new_user_minimal_v4()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is REALLY a new user (not an update)
    IF TG_OP = 'INSERT' THEN
        -- Only insert if profile doesn't exist
        INSERT INTO public.profiles (id, email, full_name, role)
        SELECT 
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            'user'
        WHERE NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create trigger ONLY for INSERT, not UPDATE
CREATE TRIGGER on_auth_user_created_minimal_v4
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user_minimal_v4();

-- Step 8: Verify the specific user
DO $$
DECLARE
    user_id UUID;
    profile_role TEXT;
    auth_metadata JSONB;
BEGIN
    -- Get user info
    SELECT p.id, p.role INTO user_id, profile_role
    FROM profiles p
    WHERE p.email = 'rojasundharam2000@gmail.com';
    
    -- Get auth metadata
    SELECT raw_user_meta_data INTO auth_metadata
    FROM auth.users
    WHERE id = user_id;
    
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'USER STATUS: rojasundharam2000@gmail.com';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Profile Role: %', profile_role;
    RAISE NOTICE 'Has metadata role: %', auth_metadata ? 'role';
    RAISE NOTICE 'Metadata: %', auth_metadata;
    
    -- List all triggers
    RAISE NOTICE '';
    RAISE NOTICE 'Active triggers on auth.users:';
    FOR trigger_rec IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'auth.users'::regclass 
        AND tgisinternal = false
    LOOP
        RAISE NOTICE '  - %', trigger_rec.tgname;
    END LOOP;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ FORCE FIX APPLIED';
    RAISE NOTICE '===========================================';
END $$;