-- Add ticket_type field to predefined_tickets and tickets tables
-- This allows tracking of Gold, Silver, Bronze ticket types

-- Add ticket_type to predefined_tickets table
ALTER TABLE predefined_tickets 
ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'Bronze' 
CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze'));

-- Update existing predefined tickets to have a default type
UPDATE predefined_tickets 
SET ticket_type = 'Bronze' 
WHERE ticket_type IS NULL;

-- Modify tickets table to include more specific ticket types
ALTER TABLE tickets 
DROP CONSTRAINT IF EXISTS tickets_ticket_type_check;

ALTER TABLE tickets 
ALTER COLUMN ticket_type SET DEFAULT 'Bronze';

ALTER TABLE tickets 
ADD CONSTRAINT tickets_ticket_type_check 
CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze', 'general', 'vip', 'standard'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_type ON predefined_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(ticket_type);

-- Add ticket_type to printed_tickets table as well
ALTER TABLE printed_tickets 
ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'Bronze' 
CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze'));

-- Create a view for ticket analytics by type
CREATE OR REPLACE VIEW ticket_analytics_by_type AS
SELECT 
    event_id,
    ticket_type,
    COUNT(*) as total_tickets,
    COUNT(CASE WHEN status = 'used' THEN 1 END) as checked_in_tickets,
    COUNT(CASE WHEN status = 'valid' THEN 1 END) as available_tickets,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_tickets
FROM tickets
GROUP BY event_id, ticket_type;

-- Grant permissions
GRANT SELECT ON ticket_analytics_by_type TO authenticated;