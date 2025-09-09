-- =====================================================
-- ENSURE ALL AUTH USERS HAVE PROFILES
-- =====================================================

-- First, insert missing profiles for all auth users
INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    COALESCE(au.raw_user_meta_data->>'role', 'user'),
    au.created_at,
    NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Update existing profiles that have NULL or empty fields
UPDATE public.profiles
SET 
    full_name = COALESCE(full_name, split_part(email, '@', 1)),
    role = COALESCE(role, 'user'),
    updated_at = NOW()
WHERE 
    full_name IS NULL OR 
    full_name = '' OR 
    role IS NULL;

-- Create or replace the function to ensure profile exists
CREATE OR REPLACE FUNCTION ensure_profile_exists(user_id UUID, user_email TEXT)
RETURNS void AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        user_id,
        user_email,
        split_part(user_email, '@', 1),
        'user'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION ensure_profile_exists(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_profile_exists(UUID, TEXT) TO service_role;

-- Check results
SELECT 
    'Total auth users' as metric,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
    'Total profiles' as metric,
    COUNT(*) as count
FROM public.profiles
UNION ALL
SELECT 
    'Missing profiles' as metric,
    COUNT(*) as count
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- List any users still missing profiles
SELECT 
    au.id,
    au.email,
    au.created_at,
    'Missing profile' as status
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
LIMIT 10;