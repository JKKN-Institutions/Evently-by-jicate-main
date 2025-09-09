-- Add ticket_types column to events table to support multiple ticket pricing
-- This stores different ticket types (Gold, Silver, Bronze, etc.) with their prices

-- Add ticket_types column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'ticket_types') THEN
        ALTER TABLE events 
        ADD COLUMN ticket_types JSONB DEFAULT '[]'::jsonb;
        
        COMMENT ON COLUMN events.ticket_types IS 'Array of ticket types with pricing. Format: [{name: "Gold", price: 100, quantity: 50, description: "VIP Access"}, ...]';
        
        RAISE NOTICE 'Added ticket_types column to events table';
    ELSE
        RAISE NOTICE 'ticket_types column already exists';
    END IF;
    
    -- Add use_multi_ticket_pricing flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'use_multi_ticket_pricing') THEN
        ALTER TABLE events 
        ADD COLUMN use_multi_ticket_pricing BOOLEAN DEFAULT FALSE;
        
        COMMENT ON COLUMN events.use_multi_ticket_pricing IS 'Flag to enable multiple ticket type pricing';
        
        RAISE NOTICE 'Added use_multi_ticket_pricing column to events table';
    END IF;
END $$;

-- Create index on ticket_types for better query performance
CREATE INDEX IF NOT EXISTS idx_events_ticket_types ON events USING GIN (ticket_types);

-- Example of how ticket_types data is structured:
/*
[
  {
    "name": "Gold",
    "price": 500,
    "quantity": 50,
    "description": "Premium seating with backstage access"
  },
  {
    "name": "Silver", 
    "price": 300,
    "quantity": 100,
    "description": "Reserved seating"
  },
  {
    "name": "Bronze",
    "price": 150,
    "quantity": 200,
    "description": "General admission"
  }
]
*/

-- Migration: Convert existing single price to ticket_types format
UPDATE events 
SET ticket_types = jsonb_build_array(
    jsonb_build_object(
        'name', 'General Admission',
        'price', price,
        'quantity', max_attendees,
        'description', 'Standard ticket'
    )
)
WHERE ticket_types = '[]'::jsonb 
  AND price IS NOT NULL 
  AND price > 0;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'Ticket types feature added successfully!';
END $$;