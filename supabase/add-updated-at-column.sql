-- =====================================================
-- ADD UPDATED_AT COLUMN TO EVENTS TABLE (IF NOT EXISTS)
-- =====================================================

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE events 
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        
        -- Update existing rows to have updated_at same as created_at
        UPDATE events 
        SET updated_at = created_at 
        WHERE updated_at IS NULL;
        
        RAISE NOTICE '✅ Added updated_at column to events table';
    ELSE
        RAISE NOTICE '✅ updated_at column already exists';
    END IF;
END $$;

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

RAISE NOTICE '🎉 Updated_at column setup completed!';
