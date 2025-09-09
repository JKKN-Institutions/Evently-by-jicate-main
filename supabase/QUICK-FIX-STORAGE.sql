-- QUICK FIX: Just create the bucket without policies (since they already exist)
-- Run this simpler version if you get policy errors

-- Create or update the event-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images', 
  true, -- Make it public so images can be viewed
  5242880, -- 5MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- That's it! The bucket should now be created and working.
-- The policies already exist, so we don't need to recreate them.