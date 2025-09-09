-- Update director@jkkn.ac.in to admin role
-- This script will find the user by email and update their role to admin

-- First, let's check if the user exists and their current role
SELECT 
  u.id,
  u.email,
  p.role,
  p.full_name,
  p.created_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'director@jkkn.ac.in';

-- Update the user's role to admin
-- If the profile doesn't exist, this will create it
INSERT INTO profiles (id, email, role, full_name, updated_at)
SELECT 
  u.id,
  u.email,
  'admin',
  COALESCE(u.raw_user_meta_data->>'full_name', 'Director'),
  NOW()
FROM auth.users u
WHERE u.email = 'director@jkkn.ac.in'
ON CONFLICT (id) 
DO UPDATE SET 
  role = 'admin',
  updated_at = NOW();

-- Verify the update
SELECT 
  u.id,
  u.email,
  p.role,
  p.full_name,
  p.updated_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'director@jkkn.ac.in';

-- Show confirmation message
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM auth.users u 
      JOIN profiles p ON u.id = p.id 
      WHERE u.email = 'director@jkkn.ac.in' AND p.role = 'admin'
    ) 
    THEN 'SUCCESS: director@jkkn.ac.in has been updated to admin role'
    ELSE 'ERROR: User not found or update failed'
  END as status;
