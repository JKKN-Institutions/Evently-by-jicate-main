-- Quick admin role update for admin users
-- Run this in your Supabase SQL Editor

-- Update director@jkkn.ac.in
UPDATE profiles 
SET role = 'admin', updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users 
  WHERE email = 'director@jkkn.ac.in'
);

-- Update sroja@jkkn.ac.in
UPDATE profiles 
SET role = 'admin', updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users 
  WHERE email = 'sroja@jkkn.ac.in'
);

-- If the profile doesn't exist for director@jkkn.ac.in, create it
INSERT INTO profiles (id, email, role, full_name, created_at, updated_at)
SELECT 
  id,
  email,
  'admin',
  'Director',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'director@jkkn.ac.in'
  AND NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.users.id
  );

-- If the profile doesn't exist for sroja@jkkn.ac.in, create it
INSERT INTO profiles (id, email, role, full_name, created_at, updated_at)
SELECT 
  id,
  email,
  'admin',
  'Admin',
  NOW(),
  NOW()
FROM auth.users 
WHERE email = 'sroja@jkkn.ac.in'
  AND NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.users.id
  );

-- Verify the results
SELECT 
  u.email,
  p.role,
  p.full_name,
  'Admin role updated successfully' as status
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email IN ('director@jkkn.ac.in', 'sroja@jkkn.ac.in');
