-- =====================================================
-- ORGANIZER PROFILES SCHEMA FOR EVENTLY APPLICATION
-- =====================================================
-- Run this in your Supabase SQL editor to add organizer profiles

-- Create organizer_profiles table
CREATE TABLE IF NOT EXISTS organizer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Company Information
    company_name TEXT NOT NULL,
    company_description TEXT NOT NULL,
    company_website TEXT,
    
    -- Contact Information
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT,
    country TEXT NOT NULL,
    
    -- Experience & Expertise
    experience_years INTEGER NOT NULL CHECK (experience_years >= 0),
    event_types TEXT[] NOT NULL DEFAULT '{}',
    previous_events TEXT,
    
    -- Social Media
    social_media JSONB DEFAULT '{}',
    
    -- Status & Verification
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES profiles(id),
    
    -- Additional fields
    logo_url TEXT,
    banner_url TEXT,
    rating DECIMAL(3,2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
    total_events INTEGER DEFAULT 0 CHECK (total_events >= 0),
    total_revenue DECIMAL(12,2) DEFAULT 0.00 CHECK (total_revenue >= 0),
    
    UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organizer_profiles_user_id ON organizer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_profiles_status ON organizer_profiles(status);
CREATE INDEX IF NOT EXISTS idx_organizer_profiles_city ON organizer_profiles(city);
CREATE INDEX IF NOT EXISTS idx_organizer_profiles_country ON organizer_profiles(country);
CREATE INDEX IF NOT EXISTS idx_organizer_profiles_event_types ON organizer_profiles USING GIN(event_types);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_organizer_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organizer_profiles_updated_at
    BEFORE UPDATE ON organizer_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_organizer_profiles_updated_at();

-- Add event categories table
CREATE TABLE IF NOT EXISTS event_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT, -- Icon name for UI
    color TEXT DEFAULT '#0b6d41', -- Hex color for category
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0
);

-- Insert default event categories
INSERT INTO event_categories (name, description, icon, color, sort_order) VALUES
('Conferences', 'Professional conferences and seminars', 'presentation', '#0b6d41', 1),
('Workshops', 'Educational workshops and training sessions', 'wrench', '#f59e0b', 2),
('Concerts', 'Music concerts and performances', 'music', '#ef4444', 3),
('Sports', 'Sports events and competitions', 'trophy', '#10b981', 4),
('Festivals', 'Cultural festivals and celebrations', 'star', '#8b5cf6', 5),
('Corporate', 'Corporate events and meetings', 'building', '#6b7280', 6),
('Weddings', 'Wedding ceremonies and receptions', 'heart', '#ec4899', 7),
('Parties', 'Private parties and social gatherings', 'party-popper', '#f97316', 8),
('Exhibitions', 'Trade shows and exhibitions', 'eye', '#06b6d4', 9),
('Networking', 'Professional networking events', 'users', '#84cc16', 10)
ON CONFLICT (name) DO NOTHING;

-- Update events table to use category reference
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES event_categories(id);

-- Create index for category lookup
CREATE INDEX IF NOT EXISTS idx_events_category_id ON events(category_id);

-- Row Level Security (RLS) policies
ALTER TABLE organizer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;

-- Organizer profiles policies
CREATE POLICY "Users can view approved organizer profiles" ON organizer_profiles
    FOR SELECT USING (status = 'approved');

CREATE POLICY "Users can view their own organizer profile" ON organizer_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own organizer profile" ON organizer_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own organizer profile" ON organizer_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all organizer profiles" ON organizer_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Event categories policies
CREATE POLICY "Everyone can view active categories" ON event_categories
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage categories" ON event_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create view for organizer dashboard stats
CREATE OR REPLACE VIEW organizer_dashboard AS
SELECT 
    op.user_id,
    op.company_name,
    op.status as organizer_status,
    COUNT(e.id) as total_events,
    COUNT(CASE WHEN e.status = 'published' THEN 1 END) as published_events,
    COUNT(CASE WHEN e.status = 'draft' THEN 1 END) as draft_events,
    COALESCE(SUM(e.current_attendees), 0) as total_attendees,
    COALESCE(SUM(b.total_amount), 0) as total_revenue,
    COUNT(DISTINCT b.id) as total_bookings
FROM organizer_profiles op
LEFT JOIN events e ON e.organizer_id = op.user_id
LEFT JOIN bookings b ON b.event_id = e.id AND b.payment_status = 'completed'
GROUP BY op.user_id, op.company_name, op.status;

-- Grant access to the view
GRANT SELECT ON organizer_dashboard TO authenticated;

-- Create RLS policy for the view
CREATE POLICY "Users can view their own organizer dashboard" ON organizer_dashboard
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all organizer dashboards" ON organizer_dashboard
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
