-- =====================================================
-- SIMPLIFY AND FIX PROFILE RLS POLICIES
-- =====================================================
-- This script replaces the complex and inefficient profile RLS policies
-- with a simpler, more performant setup that uses the get_user_role() function.

-- 1. Drop all existing policies on the profiles table to ensure a clean slate.
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

-- 2. Ensure RLS is enabled.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

-- 3. Create new, efficient policies.

-- POLICY: Authenticated users can read all profiles.
-- This is useful for features where users might need to see organizer profiles.
-- Supabase automatically optimizes this on the server.
CREATE POLICY "Allow authenticated read access to all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- POLICY: Users can update their own profile.
CREATE POLICY "Allow individual users to update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- POLICY: Admins can update any profile.
-- This uses the optimized get_user_role() function instead of a slow subquery.
CREATE POLICY "Allow admins to update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (get_user_role(auth.uid()) = 'admin')
WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- POLICY: The handle_new_user trigger needs to be able to insert profiles.
-- The trigger function runs with the permissions of the user who defined it,
-- but RLS for INSERT is still checked. Since our trigger runs with SECURITY DEFINER,
-- it assumes the role of the definer, but the policy needs to allow the initial user action.
-- This policy allows any authenticated user to insert their own profile.
CREATE POLICY "Allow individual users to insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);


-- 4. Final verification message.
DO $$ 
BEGIN
    RAISE NOTICE 'SUCCESS: Profile RLS policies have been simplified and fixed.';
END $$;
