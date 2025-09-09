-- =====================================================
-- PERMANENT SOLUTION: Store Event Images in Database
-- =====================================================
-- This bypasses storage bucket permissions completely
-- Images are stored as base64 in the database

-- 1. Check and add columns to store image data (only if they don't exist)
DO $$
BEGIN
    -- Add image_data column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='events' AND column_name='image_data') THEN
        ALTER TABLE events ADD COLUMN image_data TEXT;
    END IF;
    
    -- Add image_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='events' AND column_name='image_type') THEN
        ALTER TABLE events ADD COLUMN image_type VARCHAR(50);
    END IF;
    
    -- Add image_size column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='events' AND column_name='image_size') THEN
        ALTER TABLE events ADD COLUMN image_size INTEGER;
    END IF;
END $$;

-- 2. Create a separate table for large images (better performance)
CREATE TABLE IF NOT EXISTS event_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL, -- Base64 encoded image
    image_type VARCHAR(50) NOT NULL, -- MIME type (image/jpeg, image/png, etc.)
    image_size INTEGER NOT NULL, -- Size in bytes
    thumbnail_data TEXT, -- Smaller version for lists
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id)
);

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_event_images_event_id ON event_images(event_id);

-- 4. Create function to validate image size (max 5MB for base64)
CREATE OR REPLACE FUNCTION validate_image_size()
RETURNS TRIGGER AS $$
BEGIN
    -- Base64 increases size by ~33%, so 5MB image = ~6.6MB base64
    -- Character count for 5MB base64 ≈ 6990506 characters
    IF LENGTH(NEW.image_data) > 6990506 THEN
        RAISE EXCEPTION 'Image too large. Maximum size is 5MB';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to validate image size
DROP TRIGGER IF EXISTS validate_event_image_size ON event_images;
CREATE TRIGGER validate_event_image_size
BEFORE INSERT OR UPDATE ON event_images
FOR EACH ROW
EXECUTE FUNCTION validate_image_size();

-- 6. Create function to store image
CREATE OR REPLACE FUNCTION store_event_image(
    p_event_id UUID,
    p_image_data TEXT,
    p_image_type VARCHAR(50)
)
RETURNS JSON AS $$
DECLARE
    v_image_size INTEGER;
    v_result JSON;
BEGIN
    -- Calculate approximate size
    v_image_size := LENGTH(p_image_data);
    
    -- Delete existing image if any
    DELETE FROM event_images WHERE event_id = p_event_id;
    
    -- Insert new image
    INSERT INTO event_images (event_id, image_data, image_type, image_size)
    VALUES (p_event_id, p_image_data, p_image_type, v_image_size);
    
    -- Update events table with reference
    UPDATE events 
    SET 
        image_data = SUBSTRING(p_image_data, 1, 100), -- Store preview only
        image_type = p_image_type,
        image_size = v_image_size
    WHERE id = p_event_id;
    
    v_result := json_build_object(
        'success', true,
        'message', 'Image stored successfully',
        'size', v_image_size,
        'type', p_image_type
    );
    
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to get image
CREATE OR REPLACE FUNCTION get_event_image(p_event_id UUID)
RETURNS TABLE(
    image_data TEXT,
    image_type VARCHAR(50),
    image_size INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT ei.image_data, ei.image_type, ei.image_size
    FROM event_images ei
    WHERE ei.event_id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- 8. RLS Policies for event_images table
ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view images (public events)
CREATE POLICY "Public can view event images" ON event_images
    FOR SELECT USING (true);

-- Allow event organizers to manage their event images
CREATE POLICY "Organizers can manage event images" ON event_images
    FOR ALL USING (
        event_id IN (
            SELECT id FROM events WHERE organizer_id = auth.uid()
        )
    );

-- 9. Grant permissions
GRANT ALL ON event_images TO authenticated;
GRANT SELECT ON event_images TO anon;
GRANT EXECUTE ON FUNCTION store_event_image TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_image TO anon, authenticated;

-- 10. Create view for events with images (with column checking)
DROP VIEW IF EXISTS events_with_images;

-- Create the view dynamically based on existing columns
DO $$
DECLARE
    v_columns TEXT;
BEGIN
    -- Build column list dynamically based on what exists in events table
    SELECT string_agg(
        'e.' || column_name, 
        ', '
        ORDER BY ordinal_position
    ) INTO v_columns
    FROM information_schema.columns
    WHERE table_name = 'events' 
    AND table_schema = 'public'
    AND column_name NOT IN ('image_data', 'image_type', 'image_size'); -- Exclude these if they exist in events
    
    -- Create the view with dynamic columns
    EXECUTE format('
        CREATE VIEW events_with_images AS
        SELECT 
            %s,
            ei.image_data as stored_image_data,
            ei.image_type as stored_image_type,
            ei.image_size as stored_image_size,
            CASE 
                WHEN ei.image_data IS NOT NULL THEN true
                ELSE false
            END as has_stored_image
        FROM events e
        LEFT JOIN event_images ei ON e.id = ei.event_id
    ', v_columns);
    
    RAISE NOTICE 'View events_with_images created successfully';
END $$;

-- Grant access to view
GRANT SELECT ON events_with_images TO anon, authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ SUCCESS: Database image storage is configured!';
    RAISE NOTICE '📸 Images will now be stored directly in the database';
    RAISE NOTICE '🚀 No storage bucket permissions needed!';
    RAISE NOTICE '💾 Maximum image size: 5MB';
END $$;