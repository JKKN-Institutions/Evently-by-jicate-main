-- Supabase Storage Setup Script for Evently
-- Run this in your Supabase SQL Editor

-- Create the event-images storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Set up RLS policies for the event-images bucket

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload images" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'event-images');

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update their own images" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'event-images' AND auth.uid()::text = owner)
WITH CHECK (bucket_id = 'event-images');

-- Allow authenticated users to delete their own images  
CREATE POLICY "Users can delete their own images" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'event-images' AND auth.uid()::text = owner);

-- Allow public to view images
CREATE POLICY "Public can view images" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'event-images');

-- Note: After running this script, you should be able to upload images to the event-images bucket