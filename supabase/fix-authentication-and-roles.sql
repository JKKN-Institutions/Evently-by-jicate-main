-- =====================================================
-- FIX AUTHENTICATION AND USER ROLES
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enhanced profiles read policy" ON profiles;
DROP POLICY IF EXISTS "Enhanced profiles update policy" ON profiles;
DROP POLICY IF EXISTS "evently_profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "evently_profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "evently_profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins can update any" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- =====================================================
-- RECREATE PROFILES TABLE WITH PROPER STRUCTURE
-- =====================================================
-- First, backup existing data if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        CREATE TEMP TABLE profiles_backup AS SELECT * FROM profiles;
    END IF;
END $$;

-- Drop the table if it exists and recreate it
DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'organizer', 'admin'))
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- =====================================================
-- CREATE PROPER HANDLE NEW USER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert the new user profile
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
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = NOW();
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the trigger
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CREATE UPDATED_AT TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RECREATE AUTH TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- ENABLE RLS
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE SIMPLE AND EFFECTIVE RLS POLICIES
-- =====================================================

-- 1. Everyone can view all profiles (needed for event organizers, etc.)
CREATE POLICY "profiles_select_all" ON profiles
    FOR SELECT USING (true);

-- 2. Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 4. Admins can update any profile
CREATE POLICY "profiles_admin_update" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 5. Service role can do anything (for backend operations)
CREATE POLICY "profiles_service_role" ON profiles
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- POPULATE PROFILES FOR EXISTING USERS
-- =====================================================
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
    id, 
    email,
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
    COALESCE(raw_user_meta_data->>'role', 'user')
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();

-- =====================================================
-- CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM profiles
    WHERE id = auth.uid();
    
    RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely get profile by email
CREATE OR REPLACE FUNCTION get_profile_by_email(user_email TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    role TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.full_name,
        p.role,
        p.avatar_url,
        p.created_at,
        p.updated_at
    FROM profiles p
    WHERE p.email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT NECESSARY PERMISSIONS
-- =====================================================
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_profile_by_email(TEXT) TO authenticated;

-- =====================================================
-- SET DEFAULT ADMIN USER (change email as needed)
-- =====================================================
-- Update this with your admin email
UPDATE profiles 
SET role = 'admin' 
WHERE email IN (
    'admin@evently.com',
    'admin@example.com'
);

-- =====================================================
-- VERIFY SETUP
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Authentication and roles setup completed!';
    RAISE NOTICE 'Total profiles: %', (SELECT COUNT(*) FROM profiles);
    RAISE NOTICE 'Admin users: %', (SELECT COUNT(*) FROM profiles WHERE role = 'admin');
    RAISE NOTICE 'Organizer users: %', (SELECT COUNT(*) FROM profiles WHERE role = 'organizer');
    RAISE NOTICE 'Regular users: %', (SELECT COUNT(*) FROM profiles WHERE role = 'user');
END $$;