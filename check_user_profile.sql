-- Debug SQL queries to check user authentication and profile data
-- Run these queries in your Supabase SQL Editor to debug authentication issues

-- 1. Check if auth.users table has your user
SELECT 
    id,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    last_sign_in_at,
    role as auth_role
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE'; -- Replace with your actual email

-- 2. Check if profile exists in public.profiles table
SELECT 
    id,
    email,
    role as profile_role,
    first_name,
    last_name,
    created_at,
    updated_at
FROM public.profiles
WHERE email = 'YOUR_EMAIL_HERE'; -- Replace with your actual email

-- 3. Check for any profile without matching auth.users
SELECT 
    p.id,
    p.email,
    p.role,
    CASE 
        WHEN u.id IS NULL THEN 'No auth user found'
        ELSE 'Auth user exists'
    END as auth_status
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.email = 'YOUR_EMAIL_HERE'; -- Replace with your actual email

-- 4. Check all profiles and their roles
SELECT 
    id,
    email,
    role,
    created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;

-- 5. Fix missing profile (run only if profile doesn't exist)
-- This will create a profile for an existing auth user
INSERT INTO public.profiles (id, email, role, created_at, updated_at)
SELECT 
    id,
    email,
    'attendee', -- Default role
    now(),
    now()
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE' -- Replace with your actual email
    AND id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 6. Update existing profile role (if needed)
UPDATE public.profiles
SET 
    role = 'admin', -- Change to desired role: 'admin', 'organizer', or 'attendee'
    updated_at = now()
WHERE email = 'YOUR_EMAIL_HERE'; -- Replace with your actual email

-- 7. Check RLS policies on profiles table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 8. Verify profile trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles';

-- 9. Check for duplicate profiles
SELECT 
    email,
    COUNT(*) as count
FROM public.profiles
GROUP BY email
HAVING COUNT(*) > 1;

-- 10. Full diagnostic for a specific user
WITH user_data AS (
    SELECT 
        u.id,
        u.email,
        u.created_at as user_created,
        u.last_sign_in_at,
        u.raw_app_meta_data->>'provider' as auth_provider,
        p.id as profile_id,
        p.role as profile_role,
        p.created_at as profile_created
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    WHERE u.email = 'YOUR_EMAIL_HERE' -- Replace with your actual email
)
SELECT 
    *,
    CASE 
        WHEN profile_id IS NULL THEN 'ISSUE: Profile missing - needs creation'
        WHEN profile_role IS NULL THEN 'ISSUE: Role not set - needs update'
        WHEN profile_role NOT IN ('admin', 'organizer', 'attendee') THEN 'ISSUE: Invalid role value'
        ELSE 'OK: Profile exists with valid role'
    END as diagnosis
FROM user_data;