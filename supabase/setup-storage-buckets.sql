-- =====================================================
-- SETUP STORAGE BUCKETS FOR EVENTLY
-- =====================================================

-- Create event-images bucket for event banner images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create organizer-logos bucket for organizer profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organizer-logos',
  'organizer-logos',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create user-avatars bucket for user profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  1048576, -- 1MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- STORAGE POLICIES FOR EVENT IMAGES
-- =====================================================

-- Allow public read access to event images
CREATE POLICY "Public read access for event images" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-images');

-- Allow authenticated users to upload event images
CREATE POLICY "Authenticated users can upload event images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'event-images' AND
    auth.uid() IS NOT NULL
  );

-- Allow users to update their own uploaded images
CREATE POLICY "Users can update their own event images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'event-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own uploaded images
CREATE POLICY "Users can delete their own event images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'event-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================
-- STORAGE POLICIES FOR ORGANIZER LOGOS
-- =====================================================

-- Allow public read access to organizer logos
CREATE POLICY "Public read access for organizer logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'organizer-logos');

-- Allow authenticated users to upload organizer logos
CREATE POLICY "Authenticated users can upload organizer logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'organizer-logos' AND
    auth.uid() IS NOT NULL
  );

-- Allow users to update their own organizer logos
CREATE POLICY "Users can update their own organizer logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'organizer-logos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own organizer logos
CREATE POLICY "Users can delete their own organizer logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'organizer-logos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================
-- STORAGE POLICIES FOR USER AVATARS
-- =====================================================

-- Allow public read access to user avatars
CREATE POLICY "Public read access for user avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-avatars');

-- Allow authenticated users to upload user avatars
CREATE POLICY "Authenticated users can upload user avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-avatars' AND
    auth.uid() IS NOT NULL
  );

-- Allow users to update their own avatars
CREATE POLICY "Users can update their own avatars" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'user-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatars" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================
-- HELPER FUNCTIONS FOR STORAGE
-- =====================================================

-- Function to get file extension
CREATE OR REPLACE FUNCTION get_file_extension(filename TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(substring(filename from '\.([^.]*)$'));
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique filename
CREATE OR REPLACE FUNCTION generate_unique_filename(
    user_id UUID,
    original_filename TEXT,
    prefix TEXT DEFAULT ''
)
RETURNS TEXT AS $$
DECLARE
    extension TEXT;
    timestamp_str TEXT;
    random_str TEXT;
BEGIN
    extension := get_file_extension(original_filename);
    timestamp_str := extract(epoch from now())::text;
    random_str := substr(md5(random()::text), 1, 8);
    
    RETURN CASE 
        WHEN prefix != '' THEN prefix || '/' || user_id::text || '/' || timestamp_str || '-' || random_str || '.' || extension
        ELSE user_id::text || '/' || timestamp_str || '-' || random_str || '.' || extension
    END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
DECLARE
    bucket_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Check if buckets were created
    SELECT COUNT(*) INTO bucket_count 
    FROM storage.buckets 
    WHERE id IN ('event-images', 'organizer-logos', 'user-avatars');
    
    IF bucket_count = 3 THEN
        RAISE NOTICE 'All storage buckets created successfully';
    ELSE
        RAISE WARNING 'Only % out of 3 buckets were created', bucket_count;
    END IF;
    
    -- Check if policies were created
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND policyname LIKE '%event images%' 
    OR policyname LIKE '%organizer logos%' 
    OR policyname LIKE '%user avatars%';
    
    IF policy_count > 0 THEN
        RAISE NOTICE 'Storage policies created successfully (% policies)', policy_count;
    ELSE
        RAISE WARNING 'No storage policies were created';
    END IF;
    
    RAISE NOTICE 'Storage setup completed';
END $$;
