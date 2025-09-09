-- =====================================================
-- FIX EVENTS TABLE COLUMNS
-- Ensure all required columns exist
-- =====================================================

-- Check and add missing columns to events table
DO $$ 
BEGIN
    -- Add start_date if it doesn't exist (might be using 'date' instead)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'start_date') THEN
        -- Check if 'date' column exists and rename it
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'date') THEN
            ALTER TABLE events RENAME COLUMN date TO start_date;
        ELSE
            ALTER TABLE events ADD COLUMN start_date DATE DEFAULT CURRENT_DATE;
        END IF;
    END IF;
    
    -- Add end_date if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'end_date') THEN
        ALTER TABLE events ADD COLUMN end_date DATE;
        -- Set end_date to start_date if null
        UPDATE events SET end_date = start_date WHERE end_date IS NULL;
    END IF;
    
    -- Add venue if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'venue') THEN
        ALTER TABLE events ADD COLUMN venue TEXT;
    END IF;
    
    -- Add location if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'location') THEN
        ALTER TABLE events ADD COLUMN location TEXT;
    END IF;
    
    -- Add title if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'title') THEN
        ALTER TABLE events ADD COLUMN title TEXT;
    END IF;
    
    -- Add organizer_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'organizer_id') THEN
        ALTER TABLE events ADD COLUMN organizer_id UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Create events table if it doesn't exist at all
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    time TIME,
    venue TEXT,
    location TEXT,
    category TEXT,
    price DECIMAL(10,2) DEFAULT 0,
    max_attendees INTEGER DEFAULT 100,
    image_url TEXT,
    organizer_id UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);

-- Grant permissions
GRANT ALL ON events TO authenticated;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Events table structure fixed successfully!';
END $$;