-- Create event-images storage bucket for Supabase Storage
-- Run this script in Supabase SQL editor to set up the storage bucket

-- Step 1: Insert the bucket into storage.buckets table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images', 
  true, -- Make it public so images can be viewed
  5242880, -- 5MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'] -- Allowed image types
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- Step 2: Create RLS policies for the bucket (with IF NOT EXISTS handling)

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own event images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view event images" ON storage.objects;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload event images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-images');

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update own event images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'event-images');

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete own event images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public to view images (since bucket is public)
CREATE POLICY "Public can view event images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'event-images');

-- Step 3: Create a function to check/create storage bucket (for runtime use)
CREATE OR REPLACE FUNCTION create_storage_bucket_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Check if bucket exists
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'event-images') THEN
    -- Create the bucket
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'event-images',
      'event-images',
      true,
      5242880,
      ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function to ensure bucket exists
SELECT create_storage_bucket_if_not_exists();

-- Step 4: Grant necessary permissions
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;

-- Optional: Create a placeholder images bucket for fallback images
INSERT INTO storage.buckets (id, name, public)
VALUES ('placeholders', 'placeholders', true)
ON CONFLICT (id) DO NOTHING;

-- Note: After running this script, you should:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Verify that 'event-images' bucket appears
-- 3. Upload a placeholder image to the 'placeholders' bucket if needed
-- 4. The bucket should now be ready for use