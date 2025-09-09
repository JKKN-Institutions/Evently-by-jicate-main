-- =====================================================
-- URGENT FIX FOR STORAGE ACCESS ERROR
-- Run this IMMEDIATELY in Supabase SQL Editor
-- =====================================================

-- Step 1: Drop existing problematic bucket
DROP POLICY IF EXISTS "allow_public_read" ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "allow_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "allow_bucket_read" ON storage.buckets;

DELETE FROM storage.buckets WHERE id = 'event-images';

-- Step 2: Create new bucket with correct configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'event-images',
    'event-images',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- Step 3: Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Step 4: Create simple, permissive policies
-- Public read access (no authentication needed)
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'event-images');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload" ON storage.objects 
FOR INSERT WITH CHECK (
    bucket_id = 'event-images' 
    AND auth.uid() IS NOT NULL
);

-- Authenticated users can update their uploads
CREATE POLICY "Users can update" ON storage.objects 
FOR UPDATE USING (
    bucket_id = 'event-images' 
    AND auth.uid() IS NOT NULL
);

-- Authenticated users can delete their uploads
CREATE POLICY "Users can delete" ON storage.objects 
FOR DELETE USING (
    bucket_id = 'event-images' 
    AND auth.uid() IS NOT NULL
);

-- Allow everyone to see buckets
CREATE POLICY "Public bucket access" ON storage.buckets 
FOR SELECT USING (true);

-- Step 5: Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT SELECT ON storage.buckets TO anon;

-- Step 6: Verify the setup
DO $$
DECLARE
    bucket_count INTEGER;
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO bucket_count FROM storage.buckets WHERE id = 'event-images';
    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
    
    RAISE NOTICE '==================================';
    RAISE NOTICE 'STORAGE SETUP VERIFICATION:';
    RAISE NOTICE '==================================';
    RAISE NOTICE 'Buckets created: %', bucket_count;
    RAISE NOTICE 'Policies created: %', policy_count;
    
    IF bucket_count > 0 AND policy_count >= 4 THEN
        RAISE NOTICE '✅ SUCCESS: Storage is configured!';
        RAISE NOTICE '';
        RAISE NOTICE 'YOUR PROJECT URL: https://sdkdimqmzunfmyawtqfy.supabase.co';
        RAISE NOTICE 'STORAGE URL: https://sdkdimqmzunfmyawtqfy.supabase.co/storage/v1/object/public/event-images/';
    ELSE
        RAISE WARNING '❌ FAILED: Please check the errors above';
    END IF;
END $$;

-- Show final status
SELECT 
    'event-images' as bucket_name,
    public as is_public,
    file_size_limit / 1024 / 1024 || ' MB' as max_file_size,
    array_length(allowed_mime_types, 1) || ' types' as allowed_types_count
FROM storage.buckets 
WHERE id = 'event-images';