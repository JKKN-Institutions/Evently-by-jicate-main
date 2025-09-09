-- =====================================================
-- FIX PROFILE CREATION CONFLICTS AND RLS POLICIES
-- =====================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
DROP POLICY IF EXISTS "profiles_service_role" ON profiles;

-- =====================================================
-- CREATE COMPREHENSIVE RLS POLICIES
-- =====================================================

-- 1. Everyone can view all profiles (needed for event organizers, etc.)
CREATE POLICY "profiles_select_policy" ON profiles
    FOR SELECT USING (true);

-- 2. Users can insert their own profile OR service role can insert
CREATE POLICY "profiles_insert_policy" ON profiles
    FOR INSERT WITH CHECK (
        auth.uid() = id OR 
        auth.role() = 'service_role'
    );

-- 3. Users can update their own profile
CREATE POLICY "profiles_update_own_policy" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 4. Admins can update any profile
CREATE POLICY "profiles_admin_update_policy" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 5. Service role can do anything (for backend operations and triggers)
CREATE POLICY "profiles_service_role_policy" ON profiles
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- IMPROVE HANDLE NEW USER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert the new user profile with proper conflict handling
    INSERT INTO public.profiles (id, email, full_name, role, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name', 
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        ),
        CASE 
            WHEN NEW.email = 'sroja@jkkn.ac.in' THEN 'admin'
            ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'user')
        END,
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        role = CASE 
            WHEN EXCLUDED.email = 'sroja@jkkn.ac.in' THEN 'admin'
            ELSE COALESCE(EXCLUDED.role, profiles.role)
        END,
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at = NOW();
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the trigger
        RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RECREATE TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- ENSURE ADMIN USER EXISTS WITH CORRECT ROLE
-- =====================================================
DO $$
BEGIN
    -- Update admin user if exists
    UPDATE profiles 
    SET role = 'admin', updated_at = NOW()
    WHERE email = 'sroja@jkkn.ac.in' AND role != 'admin';
    
    -- Log the result
    IF FOUND THEN
        RAISE NOTICE 'Updated admin role for sroja@jkkn.ac.in';
    ELSE
        RAISE NOTICE 'Admin user sroja@jkkn.ac.in not found or already has admin role';
    END IF;
END $$;

-- =====================================================
-- GRANT NECESSARY PERMISSIONS
-- =====================================================
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;

-- =====================================================
-- CREATE HELPER FUNCTION FOR ROLE CHECKING
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM profiles 
        WHERE id = user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFY SETUP
-- =====================================================
DO $$
BEGIN
    -- Check if RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS is not enabled on profiles table';
    END IF;
    
    -- Check if policies exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles'
    ) THEN
        RAISE EXCEPTION 'No RLS policies found for profiles table';
    END IF;
    
    RAISE NOTICE 'Profile creation conflict fix completed successfully';
END $$;
