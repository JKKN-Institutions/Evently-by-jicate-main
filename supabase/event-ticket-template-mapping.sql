-- =====================================================
-- EVENT-TICKET TEMPLATE MAPPING
-- Connect events directly to ticket templates
-- =====================================================

-- 1. Add ticket template fields to events table if not exists
DO $$ 
BEGIN
    -- Add default ticket template reference
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'ticket_template_id') THEN
        ALTER TABLE events 
        ADD COLUMN ticket_template_id UUID REFERENCES predefined_tickets(id) ON DELETE SET NULL;
    END IF;
    
    -- Add ticket types configuration (Gold, Silver, Bronze availability)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'available_ticket_types') THEN
        ALTER TABLE events 
        ADD COLUMN available_ticket_types JSONB DEFAULT '["Bronze"]'::jsonb;
    END IF;
    
    -- Add ticket pricing by type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'ticket_pricing') THEN
        ALTER TABLE events 
        ADD COLUMN ticket_pricing JSONB DEFAULT '{"Gold": 100, "Silver": 50, "Bronze": 25}'::jsonb;
    END IF;
END $$;

-- 2. Create event_ticket_templates junction table for multiple templates per event
CREATE TABLE IF NOT EXISTS event_ticket_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES predefined_tickets(id) ON DELETE CASCADE,
    ticket_type TEXT NOT NULL CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze')),
    max_quantity INTEGER DEFAULT 100,
    price DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(event_id, ticket_type)
);

-- 3. Update predefined_tickets to ensure event linkage
ALTER TABLE predefined_tickets 
DROP CONSTRAINT IF EXISTS predefined_tickets_event_id_fkey;

ALTER TABLE predefined_tickets 
ADD CONSTRAINT predefined_tickets_event_id_fkey 
FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- 4. Create function to get event's ticket template
CREATE OR REPLACE FUNCTION get_event_ticket_template(p_event_id UUID, p_ticket_type TEXT DEFAULT 'Bronze')
RETURNS TABLE (
    template_id UUID,
    template_name TEXT,
    template_url TEXT,
    qr_position JSONB,
    ticket_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.id as template_id,
        pt.name as template_name,
        pt.template_url,
        pt.qr_position,
        pt.ticket_type
    FROM predefined_tickets pt
    WHERE pt.event_id = p_event_id
    AND pt.ticket_type = p_ticket_type
    ORDER BY pt.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 5. Create view for event ticket statistics
CREATE OR REPLACE VIEW event_ticket_summary AS
SELECT 
    e.id as event_id,
    e.title as event_title,
    e.start_date as event_date,
    e.ticket_template_id,
    pt.name as template_name,
    pt.ticket_type as default_ticket_type,
    COUNT(DISTINCT t.id) as total_tickets_generated,
    COUNT(DISTINCT CASE WHEN t.ticket_type = 'Gold' THEN t.id END) as gold_tickets,
    COUNT(DISTINCT CASE WHEN t.ticket_type = 'Silver' THEN t.id END) as silver_tickets,
    COUNT(DISTINCT CASE WHEN t.ticket_type = 'Bronze' THEN t.id END) as bronze_tickets,
    COUNT(DISTINCT CASE WHEN t.status = 'used' THEN t.id END) as checked_in_tickets,
    COUNT(DISTINCT CASE WHEN t.scan_count > 0 THEN t.id END) as scanned_tickets
FROM events e
LEFT JOIN predefined_tickets pt ON e.ticket_template_id = pt.id
LEFT JOIN tickets t ON e.id = t.event_id
GROUP BY e.id, e.title, e.start_date, e.ticket_template_id, pt.name, pt.ticket_type;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_ticket_template_id ON events(ticket_template_id);
CREATE INDEX IF NOT EXISTS idx_event_ticket_templates_event_id ON event_ticket_templates(event_id);
CREATE INDEX IF NOT EXISTS idx_event_ticket_templates_template_id ON event_ticket_templates(template_id);

-- 7. RLS Policies
ALTER TABLE event_ticket_templates ENABLE ROW LEVEL SECURITY;

-- Admins and organizers can manage event ticket templates
CREATE POLICY "Admins and organizers can manage event ticket templates" ON event_ticket_templates
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_ticket_templates.event_id
            AND events.organizer_id = auth.uid()
        )
    );

-- 8. Grant permissions
GRANT ALL ON event_ticket_templates TO authenticated;
GRANT SELECT ON event_ticket_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_ticket_template TO authenticated;

-- 9. Migrate existing data - Connect templates to their events if not already connected
DO $$
BEGIN
    -- Update predefined_tickets that don't have event_id but have matching events
    UPDATE predefined_tickets pt
    SET event_id = (
        SELECT e.id 
        FROM events e 
        WHERE e.created_at::date = pt.created_at::date
        LIMIT 1
    )
    WHERE pt.event_id IS NULL;
    
    -- Set first template as default for events without template
    UPDATE events e
    SET ticket_template_id = (
        SELECT pt.id 
        FROM predefined_tickets pt 
        WHERE pt.event_id = e.id
        ORDER BY pt.created_at
        LIMIT 1
    )
    WHERE e.ticket_template_id IS NULL;
END $$;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Event-Ticket Template mapping created successfully!';
    RAISE NOTICE 'Events can now be directly linked to ticket templates.';
END $$;