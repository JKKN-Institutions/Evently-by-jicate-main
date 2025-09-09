-- =====================================================
-- FIX MISSING USER PROFILES
-- =====================================================
-- This script ensures all authenticated users have profiles
-- and sets the correct admin role for specific users

-- 1. Check which users don't have profiles
SELECT 
    au.id,
    au.email,
    au.created_at,
    p.id as profile_id
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- 2. Create profiles for all users who don't have them
INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        split_part(au.email, '@', 1)
    ) as full_name,
    CASE 
        WHEN au.email IN ('rojasundharam2000@gmail.com', 'piradeep.s@jkkn.ac.in', 'sroja@jkkn.ac.in') 
        THEN 'admin'
        ELSE 'user'
    END as role,
    NOW(),
    NOW()
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    updated_at = NOW();

-- 3. Update existing profiles to set admin role for specific users
UPDATE public.profiles
SET 
    role = 'admin',
    updated_at = NOW()
WHERE email IN ('rojasundharam2000@gmail.com', 'piradeep.s@jkkn.ac.in', 'sroja@jkkn.ac.in');

-- 4. Verify the profiles now exist with correct roles
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.created_at,
    p.updated_at
FROM profiles p
WHERE email IN ('rojasundharam2000@gmail.com', 'piradeep.s@jkkn.ac.in', 'sroja@jkkn.ac.in')
ORDER BY p.email;

-- 5. Count total users vs profiles
DO $$
DECLARE
    user_count INTEGER;
    profile_count INTEGER;
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM auth.users;
    SELECT COUNT(*) INTO profile_count FROM public.profiles;
    SELECT COUNT(*) INTO admin_count FROM public.profiles WHERE role = 'admin';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PROFILE FIX SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total auth users: %', user_count;
    RAISE NOTICE 'Total profiles: %', profile_count;
    RAISE NOTICE 'Admin users: %', admin_count;
    
    IF user_count = profile_count THEN
        RAISE NOTICE '✅ All users now have profiles!';
    ELSE
        RAISE NOTICE '⚠️ Profile count mismatch: % users but % profiles', user_count, profile_count;
    END IF;
    RAISE NOTICE '========================================';
END $$;