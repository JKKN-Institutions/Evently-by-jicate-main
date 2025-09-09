-- Create qr_codes table if it doesn't exist
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qr_data TEXT NOT NULL,
    qr_hash VARCHAR(64) NOT NULL UNIQUE,
    qr_type VARCHAR(50) NOT NULL DEFAULT 'ticket',
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    ticket_id UUID,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_qr_codes_hash ON qr_codes(qr_hash);
CREATE INDEX IF NOT EXISTS idx_qr_codes_event_id ON qr_codes(event_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_ticket_id ON qr_codes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_type ON qr_codes(qr_type);

-- Create qr_scan_records table if it doesn't exist
CREATE TABLE IF NOT EXISTS qr_scan_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qr_code_id UUID REFERENCES qr_codes(id) ON DELETE CASCADE,
    qr_data_hash VARCHAR(64),
    scan_result VARCHAR(50) NOT NULL,
    scan_message TEXT,
    scanned_by UUID REFERENCES auth.users(id),
    scanner_device_info JSONB,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    ticket_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for scan records
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_qr_code_id ON qr_scan_records(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_event_id ON qr_scan_records(event_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_scanned_by ON qr_scan_records(scanned_by);
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_created_at ON qr_scan_records(created_at DESC);

-- Enable RLS
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scan_records ENABLE ROW LEVEL SECURITY;

-- Create policies for qr_codes
-- Allow authenticated users to view QR codes for events they organize or admin
CREATE POLICY "View QR codes" ON qr_codes
    FOR SELECT USING (
        auth.uid() IN (
            SELECT organizer_id FROM events WHERE id = event_id
            UNION
            SELECT id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer')
        )
    );

-- Allow authenticated users to create QR codes for events they organize
CREATE POLICY "Create QR codes" ON qr_codes
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT organizer_id FROM events WHERE id = event_id
            UNION
            SELECT id FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Allow authenticated users to update QR codes for events they organize
CREATE POLICY "Update QR codes" ON qr_codes
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT organizer_id FROM events WHERE id = event_id
            UNION
            SELECT id FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create policies for qr_scan_records
-- Allow authenticated users to view scan records for events they organize
CREATE POLICY "View scan records" ON qr_scan_records
    FOR SELECT USING (
        auth.uid() IN (
            SELECT organizer_id FROM events WHERE id = event_id
            UNION
            SELECT id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer')
        )
    );

-- Allow authenticated users to create scan records
CREATE POLICY "Create scan records" ON qr_scan_records
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- Grant permissions
GRANT ALL ON qr_codes TO authenticated;
GRANT ALL ON qr_scan_records TO authenticated;