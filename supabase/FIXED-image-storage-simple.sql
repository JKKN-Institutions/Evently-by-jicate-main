-- =====================================================
-- FIXED: Simple Image Storage Solution (No Errors)
-- =====================================================
-- Run this script to store event images in database
-- No storage permissions needed!

-- 1. Safely add columns to events table
DO $$
BEGIN
    -- Check and add each column individually
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'image_data'
    ) THEN
        ALTER TABLE events ADD COLUMN image_data TEXT;
        RAISE NOTICE 'Added image_data column to events table';
    ELSE
        RAISE NOTICE 'image_data column already exists';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'image_type'
    ) THEN
        ALTER TABLE events ADD COLUMN image_type VARCHAR(50);
        RAISE NOTICE 'Added image_type column to events table';
    ELSE
        RAISE NOTICE 'image_type column already exists';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'image_size'
    ) THEN
        ALTER TABLE events ADD COLUMN image_size INTEGER;
        RAISE NOTICE 'Added image_size column to events table';
    ELSE
        RAISE NOTICE 'image_size column already exists';
    END IF;
END $$;

-- 2. Create event_images table (if not exists)
CREATE TABLE IF NOT EXISTS event_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL,
    image_type VARCHAR(50) NOT NULL,
    image_size INTEGER NOT NULL,
    thumbnail_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id)
);

-- 3. Create index
CREATE INDEX IF NOT EXISTS idx_event_images_event_id ON event_images(event_id);

-- 4. Simple function to store image
CREATE OR REPLACE FUNCTION store_event_image(
    p_event_id UUID,
    p_image_data TEXT,
    p_image_type VARCHAR(50)
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Check image size (approximate)
    IF LENGTH(p_image_data) > 6990506 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Image too large. Maximum size is 5MB'
        );
    END IF;
    
    -- Delete existing image if any
    DELETE FROM event_images WHERE event_id = p_event_id;
    
    -- Insert new image
    INSERT INTO event_images (event_id, image_data, image_type, image_size)
    VALUES (p_event_id, p_image_data, p_image_type, LENGTH(p_image_data));
    
    -- Update events table
    UPDATE events 
    SET 
        image_data = SUBSTRING(p_image_data, 1, 100),
        image_type = p_image_type,
        image_size = LENGTH(p_image_data)
    WHERE id = p_event_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Image stored successfully'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- 5. Function to get image
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

-- 6. Enable RLS
ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;

-- 7. Create simple policies
DROP POLICY IF EXISTS "Public can view event images" ON event_images;
CREATE POLICY "Public can view event images" ON event_images
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Organizers can manage event images" ON event_images;
CREATE POLICY "Organizers can manage event images" ON event_images
    FOR ALL USING (
        event_id IN (
            SELECT id FROM events WHERE organizer_id = auth.uid()
        )
    );

-- 8. Grant permissions
GRANT ALL ON event_images TO authenticated;
GRANT SELECT ON event_images TO anon;
GRANT EXECUTE ON FUNCTION store_event_image TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_image TO anon, authenticated;

-- 9. Verification
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check if event_images table exists
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables 
    WHERE table_name = 'event_images';
    
    IF v_count > 0 THEN
        RAISE NOTICE '✅ SUCCESS: Image storage is configured!';
        RAISE NOTICE '📸 Images will be stored in the database';
        RAISE NOTICE '🚀 No storage bucket needed!';
        RAISE NOTICE '💾 Maximum image size: 5MB';
    ELSE
        RAISE WARNING '❌ FAILED: event_images table not created';
    END IF;
END $$;

-- 10. Show current status
SELECT 
    'event_images' as table_name,
    COUNT(*) as image_count,
    pg_size_pretty(pg_total_relation_size('event_images')) as table_size
FROM event_images;

-- Show columns in events table
SELECT 
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'events'
AND column_name IN ('image_data', 'image_type', 'image_size', 'image_url')
ORDER BY ordinal_position;