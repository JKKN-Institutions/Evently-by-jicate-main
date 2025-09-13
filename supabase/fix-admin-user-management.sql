-- =====================================================
-- FIX ADMIN USER MANAGEMENT POLICIES
-- =====================================================
-- This ensures admins can properly fetch and manage users

-- 1. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- 2. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create comprehensive policies

-- Allow authenticated users to read their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Allow admins to read ALL profiles (this is critical for user management)
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow admins to update all profiles
CREATE POLICY "Admins can update all profiles" ON profiles
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

-- Allow admins to insert profiles (for creating new users)
CREATE POLICY "Admins can create profiles" ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Allow service role full access (for server-side operations)
CREATE POLICY "Service role full access" ON profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Create a function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Test the policies
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ADMIN USER MANAGEMENT FIX COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Number of policies on profiles table: %', policy_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Users can view their own profile';
    RAISE NOTICE '✅ Admins can view ALL profiles';
    RAISE NOTICE '✅ Users can update their own profile';
    RAISE NOTICE '✅ Admins can update ALL profiles';
    RAISE NOTICE '✅ Admins can create new profiles';
    RAISE NOTICE '✅ Service role has full access';
    RAISE NOTICE '========================================';
END $$;

-- 6. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;