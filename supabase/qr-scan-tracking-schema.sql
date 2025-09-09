-- =====================================================
-- QR CODE SCAN TRACKING SCHEMA
-- =====================================================
-- Run this in your Supabase SQL editor to add scan tracking

-- =====================================================
-- 1. QR CODES TABLE - Store generated QR codes
-- =====================================================
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- QR Code Data
    qr_data TEXT NOT NULL UNIQUE, -- The actual QR code content
    qr_hash TEXT NOT NULL UNIQUE, -- SHA256 hash of the QR data for quick lookup
    
    -- Associated Data (optional - for ticket QRs)
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    
    -- QR Code Properties
    qr_type TEXT DEFAULT 'generic' CHECK (qr_type IN ('generic', 'ticket', 'event', 'custom')),
    description TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- 2. QR SCAN RECORDS TABLE - Track all scans
-- =====================================================
CREATE TABLE IF NOT EXISTS qr_scan_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- QR Code Reference
    qr_code_id UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
    qr_data_hash TEXT NOT NULL, -- Store hash for quick validation
    
    -- Scan Details
    scan_result TEXT DEFAULT 'success' CHECK (scan_result IN ('success', 'already_scanned', 'invalid', 'expired', 'error')),
    scan_message TEXT,
    
    -- Scanner Information
    scanned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    scanner_device_info JSONB DEFAULT '{}'::jsonb,
    scan_location TEXT, -- Optional location info
    
    -- Event Context (for ticket scans)
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    
    -- Additional Data
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_qr_codes_hash ON qr_codes(qr_hash);
CREATE INDEX IF NOT EXISTS idx_qr_codes_ticket ON qr_codes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_event ON qr_codes(event_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_type ON qr_codes(qr_type);
CREATE INDEX IF NOT EXISTS idx_qr_codes_active ON qr_codes(is_active);

CREATE INDEX IF NOT EXISTS idx_qr_scan_records_qr_code ON qr_scan_records(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_hash ON qr_scan_records(qr_data_hash);
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_event ON qr_scan_records(event_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_ticket ON qr_scan_records(ticket_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_result ON qr_scan_records(scan_result);
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_scanned_by ON qr_scan_records(scanned_by);

-- =====================================================
-- 4. FUNCTIONS FOR QR CODE OPERATIONS
-- =====================================================

-- Function to generate QR hash
CREATE OR REPLACE FUNCTION generate_qr_hash(qr_data TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN encode(digest(qr_data, 'sha256'), 'hex');
END;
$$;

-- Function to check if QR code was already scanned
CREATE OR REPLACE FUNCTION is_qr_already_scanned(qr_data_input TEXT)
RETURNS TABLE (
    already_scanned BOOLEAN,
    last_scan_time TIMESTAMP WITH TIME ZONE,
    scan_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    qr_hash_input TEXT;
BEGIN
    qr_hash_input := generate_qr_hash(qr_data_input);
    
    RETURN QUERY
    SELECT 
        COUNT(*) > 0 as already_scanned,
        MAX(created_at) as last_scan_time,
        COUNT(*) as scan_count
    FROM qr_scan_records 
    WHERE qr_data_hash = qr_hash_input 
    AND scan_result = 'success';
END;
$$;

-- Function to record QR scan
CREATE OR REPLACE FUNCTION record_qr_scan(
    qr_data_input TEXT,
    scanner_id UUID DEFAULT NULL,
    scan_result_input TEXT DEFAULT 'success',
    scan_message_input TEXT DEFAULT NULL,
    event_id_input UUID DEFAULT NULL,
    ticket_id_input UUID DEFAULT NULL,
    device_info_input JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    qr_hash_input TEXT;
    qr_code_record_id UUID;
    scan_record_id UUID;
BEGIN
    qr_hash_input := generate_qr_hash(qr_data_input);
    
    -- Find or create QR code record
    SELECT id INTO qr_code_record_id 
    FROM qr_codes 
    WHERE qr_hash = qr_hash_input;
    
    IF qr_code_record_id IS NULL THEN
        INSERT INTO qr_codes (qr_data, qr_hash, qr_type, event_id, ticket_id, created_by)
        VALUES (qr_data_input, qr_hash_input, 
                CASE WHEN ticket_id_input IS NOT NULL THEN 'ticket' 
                     WHEN event_id_input IS NOT NULL THEN 'event' 
                     ELSE 'generic' END,
                event_id_input, ticket_id_input, scanner_id)
        RETURNING id INTO qr_code_record_id;
    END IF;
    
    -- Record the scan
    INSERT INTO qr_scan_records (
        qr_code_id, qr_data_hash, scan_result, scan_message, 
        scanned_by, scanner_device_info, event_id, ticket_id
    ) VALUES (
        qr_code_record_id, qr_hash_input, scan_result_input, scan_message_input,
        scanner_id, device_info_input, event_id_input, ticket_id_input
    ) RETURNING id INTO scan_record_id;
    
    RETURN scan_record_id;
END;
$$;

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scan_records ENABLE ROW LEVEL SECURITY;

-- QR Codes policies
CREATE POLICY "Users can view their own QR codes" ON qr_codes
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create QR codes" ON qr_codes
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins and organizers can view all QR codes" ON qr_codes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'organizer')
        )
    );

-- QR Scan Records policies
CREATE POLICY "Users can view their own scan records" ON qr_scan_records
    FOR SELECT USING (scanned_by = auth.uid());

CREATE POLICY "Users can create scan records" ON qr_scan_records
    FOR INSERT WITH CHECK (scanned_by = auth.uid());

CREATE POLICY "Admins and organizers can view scan records" ON qr_scan_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'organizer')
        )
    );

-- =====================================================
-- 6. TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_qr_codes_updated_at 
    BEFORE UPDATE ON qr_codes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. SAMPLE DATA AND TESTING
-- =====================================================

-- Test the functions
DO $$
DECLARE
    test_qr_data TEXT := 'TEST-QR-' || extract(epoch from now())::text;
    scan_id UUID;
    scan_check RECORD;
BEGIN
    -- Test recording a scan
    SELECT record_qr_scan(test_qr_data, auth.uid(), 'success', 'Test scan') INTO scan_id;
    RAISE NOTICE 'Created scan record: %', scan_id;
    
    -- Test checking if already scanned
    SELECT * INTO scan_check FROM is_qr_already_scanned(test_qr_data);
    RAISE NOTICE 'Already scanned: %, Count: %', scan_check.already_scanned, scan_check.scan_count;
END;
$$;

-- Show table counts
SELECT 
    'QR Codes' as table_name, 
    COUNT(*) as record_count 
FROM qr_codes
UNION ALL
SELECT 
    'Scan Records' as table_name, 
    COUNT(*) as record_count 
FROM qr_scan_records;

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================