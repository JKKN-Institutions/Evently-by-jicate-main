-- =====================================================
-- FIX TICKETS TABLE - Add scan_count column
-- =====================================================

-- Add scan_count column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'scan_count') THEN
        ALTER TABLE tickets ADD COLUMN scan_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added scan_count column to tickets table';
    ELSE
        RAISE NOTICE 'scan_count column already exists in tickets table';
    END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_scan_count ON tickets(scan_count);

-- Update existing tickets to have scan_count based on their status
UPDATE tickets 
SET scan_count = CASE 
    WHEN status = 'used' AND scan_count IS NULL THEN 1
    WHEN scan_count IS NULL THEN 0
    ELSE scan_count
END
WHERE scan_count IS NULL;

-- Grant permissions
GRANT ALL ON tickets TO authenticated;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Tickets table scan_count column fixed successfully!';
END $$;