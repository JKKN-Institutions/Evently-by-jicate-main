-- =====================================================
-- STORAGE FIX - NO OWNER PERMISSIONS REQUIRED
-- =====================================================
-- Run this in Supabase Dashboard > Storage section, NOT SQL Editor

-- This script works around permission issues by using Supabase Dashboard

-- =====================================================
-- MANUAL STEPS IN SUPABASE DASHBOARD:
-- =====================================================

-- 1. Go to Storage section in Supabase Dashboard
-- 2. Click "New bucket" button
-- 3. Create bucket with these settings:
--    - Name: event-images
--    - Public bucket: YES (toggle ON) ← IMPORTANT!
--    - File size limit: 10MB
--    - Allowed MIME types: image/*
-- 4. Click "Create bucket"

-- IF BUCKET ALREADY EXISTS:
-- 1. Go to Storage > event-images bucket
-- 2. Click Settings (gear icon)
-- 3. Make sure "Public bucket" is toggled ON
-- 4. Save changes

-- =====================================================
-- ALTERNATIVE: Use RPC function to create bucket
-- =====================================================
-- If you can run SQL, try this simpler approach:

-- Check if bucket exists and create if not
DO $$
BEGIN
    -- Try to insert bucket (will fail silently if exists)
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('event-images', 'event-images', true, 10485760)
    ON CONFLICT (id) DO UPDATE 
    SET public = true,
        file_size_limit = 10485760;
    
    RAISE NOTICE 'Bucket configuration updated successfully';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Cannot modify bucket directly. Please use Supabase Dashboard instead.';
    WHEN OTHERS THEN
        RAISE NOTICE 'Bucket might already exist or other error: %', SQLERRM;
END $$;

-- =====================================================
-- VERIFICATION QUERY - RUN THIS TO CHECK STATUS:
-- =====================================================
SELECT 
    id as bucket_name,
    public as is_public,
    CASE 
        WHEN public = true THEN '✅ PUBLIC - Images will work!'
        ELSE '❌ PRIVATE - Images won''t display!'
    END as status,
    file_size_limit / 1024 / 1024 || ' MB' as max_size
FROM storage.buckets 
WHERE id = 'event-images';

-- If no results, bucket doesn't exist - create it in Dashboard!
-- If is_public = false, edit bucket in Dashboard and make it public!