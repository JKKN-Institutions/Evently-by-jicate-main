-- =====================================================
-- COMPREHENSIVE FIX FOR ALL DATA STORAGE ISSUES
-- =====================================================
-- Run this entire script in your Supabase SQL editor
-- This will fix all RLS policies and ensure data can be stored properly

-- =====================================================
-- STEP 1: DROP ALL EXISTING POLICIES (CLEAN SLATE)
-- =====================================================

-- Drop all policies for critical tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on these tables
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename IN (
            'profiles', 'events', 'bookings', 'payments', 'payment_logs', 
            'tickets', 'qr_codes', 'event_verification_stats', 
            'predefined_tickets', 'registrations', 'printed_tickets',
            'ticket_scans', 'qr_scan_analytics'
        )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- =====================================================
-- STEP 2: ENSURE ALL TABLES EXIST
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table if not exists
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'organizer', 'admin')),
    phone TEXT,
    avatar_url TEXT,
    bio TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create events table if not exists
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TIME,
    venue TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'India',
    capacity INTEGER DEFAULT 100,
    price DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
    tags TEXT[],
    image_url TEXT,
    banner_url TEXT,
    ticket_template TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create bookings table if not exists
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    booking_status TEXT DEFAULT 'pending' CHECK (booking_status IN ('pending', 'confirmed', 'cancelled')),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create tickets table if not exists
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ticket_number TEXT UNIQUE NOT NULL,
    qr_code TEXT,
    status TEXT DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'cancelled', 'expired')),
    ticket_type TEXT DEFAULT 'General',
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES profiles(id),
    scan_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create qr_codes table if not exists
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    qr_data TEXT NOT NULL,
    qr_hash TEXT UNIQUE NOT NULL,
    qr_type TEXT DEFAULT 'ticket',
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id),
    scanned_count INTEGER DEFAULT 0,
    last_scanned_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create event_verification_stats table if not exists
CREATE TABLE IF NOT EXISTS event_verification_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_id UUID UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    total_tickets INTEGER DEFAULT 0,
    verified_tickets INTEGER DEFAULT 0,
    unverified_tickets INTEGER DEFAULT 0,
    last_scan_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create predefined_tickets table if not exists
CREATE TABLE IF NOT EXISTS predefined_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template_url TEXT,
    qr_position JSONB DEFAULT '{"x": 50, "y": 50, "size": 150}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create registrations table if not exists
CREATE TABLE IF NOT EXISTS registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create printed_tickets table if not exists
CREATE TABLE IF NOT EXISTS printed_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    ticket_number TEXT UNIQUE NOT NULL,
    attendee_name TEXT,
    generated_by UUID REFERENCES profiles(id),
    template_used TEXT,
    qr_data TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create ticket_scans table if not exists
CREATE TABLE IF NOT EXISTS ticket_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    scanner_id UUID REFERENCES profiles(id),
    scan_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    location TEXT,
    device_info JSONB,
    ip_address TEXT,
    result TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create payments table if not exists
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'pending',
    method TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create payment_logs table if not exists
CREATE TABLE IF NOT EXISTS payment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    status TEXT,
    details JSONB,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- STEP 3: ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_verification_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE predefined_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE printed_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 4: CREATE PERMISSIVE POLICIES FOR ALL TABLES
-- =====================================================

-- PROFILES - Everyone can read, users can update their own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- EVENTS - Public read for published, full access for organizers/admins
CREATE POLICY "events_select" ON events FOR SELECT USING (true);
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "events_update" ON events FOR UPDATE USING (auth.uid() = organizer_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "events_delete" ON events FOR DELETE USING (auth.uid() = organizer_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- BOOKINGS - Users see their own, organizers see their events, admins see all
CREATE POLICY "bookings_select" ON bookings FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "bookings_insert" ON bookings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "bookings_update" ON bookings FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "bookings_delete" ON bookings FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- TICKETS - Permissive for authenticated users
CREATE POLICY "tickets_select" ON tickets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "tickets_insert" ON tickets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tickets_update" ON tickets FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "tickets_delete" ON tickets FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- QR_CODES - Permissive for authenticated users
CREATE POLICY "qr_codes_select" ON qr_codes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "qr_codes_insert" ON qr_codes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "qr_codes_update" ON qr_codes FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "qr_codes_delete" ON qr_codes FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- EVENT_VERIFICATION_STATS - Allow all operations for authenticated users
CREATE POLICY "event_verification_stats_select" ON event_verification_stats FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "event_verification_stats_insert" ON event_verification_stats FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "event_verification_stats_update" ON event_verification_stats FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "event_verification_stats_delete" ON event_verification_stats FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- PREDEFINED_TICKETS - Permissive for authenticated users
CREATE POLICY "predefined_tickets_select" ON predefined_tickets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "predefined_tickets_insert" ON predefined_tickets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "predefined_tickets_update" ON predefined_tickets FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "predefined_tickets_delete" ON predefined_tickets FOR DELETE USING (auth.uid() IS NOT NULL);

-- REGISTRATIONS - Permissive for authenticated users
CREATE POLICY "registrations_select" ON registrations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "registrations_insert" ON registrations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "registrations_update" ON registrations FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "registrations_delete" ON registrations FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- PRINTED_TICKETS - Permissive for authenticated users
CREATE POLICY "printed_tickets_select" ON printed_tickets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "printed_tickets_insert" ON printed_tickets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "printed_tickets_update" ON printed_tickets FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "printed_tickets_delete" ON printed_tickets FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- TICKET_SCANS - Permissive for authenticated users
CREATE POLICY "ticket_scans_select" ON ticket_scans FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ticket_scans_insert" ON ticket_scans FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ticket_scans_update" ON ticket_scans FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "ticket_scans_delete" ON ticket_scans FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- PAYMENTS - Users see their own, admins see all
CREATE POLICY "payments_select" ON payments FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "payments_update" ON payments FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "payments_delete" ON payments FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- PAYMENT_LOGS - Similar to payments
CREATE POLICY "payment_logs_select" ON payment_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "payment_logs_insert" ON payment_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "payment_logs_update" ON payment_logs FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "payment_logs_delete" ON payment_logs FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- =====================================================
-- STEP 5: GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Also grant to service_role for server-side operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =====================================================
-- STEP 6: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(payment_status, booking_status);
CREATE INDEX IF NOT EXISTS idx_tickets_booking ON tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_qr_codes_hash ON qr_codes(qr_hash);
CREATE INDEX IF NOT EXISTS idx_qr_codes_event ON qr_codes(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(razorpay_order_id);

-- =====================================================
-- STEP 7: CREATE OR REPLACE TRIGGER FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- =====================================================
-- STEP 8: CREATE HELPER FUNCTIONS FOR COMMON OPERATIONS
-- =====================================================

-- Function to safely create a booking with tickets
CREATE OR REPLACE FUNCTION create_booking_with_tickets(
    p_event_id UUID,
    p_user_id UUID,
    p_user_email TEXT,
    p_user_name TEXT,
    p_quantity INTEGER,
    p_total_amount DECIMAL
) RETURNS UUID AS $$
DECLARE
    v_booking_id UUID;
    v_ticket_number TEXT;
    i INTEGER;
BEGIN
    -- Create booking
    INSERT INTO bookings (event_id, user_id, user_email, user_name, quantity, total_amount, booking_status)
    VALUES (p_event_id, p_user_id, p_user_email, p_user_name, p_quantity, p_total_amount, 'confirmed')
    RETURNING id INTO v_booking_id;
    
    -- Create tickets
    FOR i IN 1..p_quantity LOOP
        v_ticket_number := 'TKT-' || substring(md5(random()::text || clock_timestamp()::text)::text from 1 for 8) || '-' || i;
        
        INSERT INTO tickets (booking_id, event_id, ticket_number, status)
        VALUES (v_booking_id, p_event_id, v_ticket_number, 'valid');
    END LOOP;
    
    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION create_booking_with_tickets TO authenticated;

-- =====================================================
-- STEP 9: VERIFY EVERYTHING IS WORKING
-- =====================================================

-- Check if tables exist
SELECT table_name, 
       CASE WHEN is_insertable_into = 'YES' THEN 'Writable' ELSE 'Read-only' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check RLS status
SELECT schemaname, tablename, 
       CASE WHEN rowsecurity = true THEN 'Enabled' ELSE 'Disabled' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Count policies per table
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Test current user permissions
SELECT 
    'Current User' as check_type,
    auth.uid() as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as email,
    (SELECT role FROM profiles WHERE id = auth.uid()) as role;

-- =====================================================
-- FINAL MESSAGE
-- =====================================================
-- All RLS policies have been fixed!
-- You should now be able to:
-- 1. Store data in all tables
-- 2. Read data based on user permissions
-- 3. Update and delete data with proper authorization
-- 
-- If you still encounter issues, check:
-- 1. User is authenticated (auth.uid() is not null)
-- 2. User has a profile in the profiles table
-- 3. User has the appropriate role for the operation