-- =====================================================
-- CLEANUP ALL CONFLICTING PROFILE POLICIES
-- =====================================================
-- This will remove ALL existing policies and create clean ones

-- 1. First, drop ALL existing policies on profiles table
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- 2. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create clean, simple policies
-- Allow all authenticated users to read all profiles (needed for user management)
CREATE POLICY "authenticated_read_all_profiles" ON profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow users to update their own profile
CREATE POLICY "users_update_own_profile" ON profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow admins to update any profile
CREATE POLICY "admins_update_any_profile" ON profiles
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Allow users to insert their own profile (for new signups)
CREATE POLICY "users_insert_own_profile" ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Service role bypass (for server-side operations)
CREATE POLICY "service_role_all_access" ON profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Verify the setup
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PROFILE RLS CLEANUP COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Number of policies on profiles table: %', policy_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Policies created:';
    RAISE NOTICE '✅ authenticated_read_all_profiles - All authenticated users can read profiles';
    RAISE NOTICE '✅ users_update_own_profile - Users can update their own profile';
    RAISE NOTICE '✅ admins_update_any_profile - Admins can update any profile';
    RAISE NOTICE '✅ users_insert_own_profile - Users can create their profile on signup';
    RAISE NOTICE '✅ service_role_all_access - Service role has full access';
    RAISE NOTICE '========================================';
END $$;