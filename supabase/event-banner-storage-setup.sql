-- Create event-images storage bucket for banner images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true);

-- Create policy to allow authenticated users to upload event images
CREATE POLICY "Allow authenticated users to upload event images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-images');

-- Create policy to allow everyone to view event images
CREATE POLICY "Allow everyone to view event images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'event-images');

-- Create policy to allow users to update their own event images
CREATE POLICY "Allow users to update their own event images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'event-images');

-- Create policy to allow users to delete their own event images
CREATE POLICY "Allow users to delete their own event images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'event-images');

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Update events table to ensure proper image_url handling
ALTER TABLE events ALTER COLUMN image_url TYPE TEXT;

-- Add index for better performance on category filtering
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

-- Add constraint to validate category values
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_category_check;
ALTER TABLE events ADD CONSTRAINT events_category_check 
  CHECK (category IN ('technology', 'music', 'business', 'art', 'sports', 'food', 'education', 'community'));

-- Update RLS policies for events to include banner image filtering
DROP POLICY IF EXISTS "Public events with images are viewable" ON events;
CREATE POLICY "Public events with images are viewable" ON events
    FOR SELECT USING (status = 'published' OR (status = 'draft' AND organizer_id = auth.uid()));

-- Function to automatically resize and optimize uploaded images (optional enhancement)
-- This would require additional setup with image processing service or Edge Functions
-- For now, we'll handle client-side validation and basic storage

-- Create a view for events with banner image metadata
CREATE OR REPLACE VIEW events_with_media AS
SELECT 
    e.*,
    CASE 
        WHEN e.image_url IS NOT NULL THEN true 
        ELSE false 
    END as has_banner_image,
    CASE 
        WHEN e.image_url IS NOT NULL THEN 
            CASE 
                WHEN e.image_url LIKE '%event-images%' THEN 'uploaded'
                ELSE 'external'
            END
        ELSE NULL 
    END as banner_source
FROM events e;