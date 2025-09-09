-- Create ticket tiers table
CREATE TABLE IF NOT EXISTS public.event_ticket_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  early_bird_price DECIMAL(10,2),
  quantity INTEGER NOT NULL DEFAULT 100,
  max_per_person INTEGER DEFAULT 5,
  description TEXT,
  perks TEXT[],
  icon VARCHAR(50),
  color VARCHAR(100),
  available BOOLEAN DEFAULT true,
  sold_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for event_id
CREATE INDEX idx_event_ticket_tiers_event_id ON public.event_ticket_tiers(event_id);

-- Add ticket_tiers JSON column to events table for backward compatibility
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS ticket_tiers JSONB;

-- Add RLS policies
ALTER TABLE public.event_ticket_tiers ENABLE ROW LEVEL SECURITY;

-- Policy for reading ticket tiers (public access)
CREATE POLICY "Anyone can view ticket tiers" ON public.event_ticket_tiers
  FOR SELECT
  USING (true);

-- Policy for inserting ticket tiers (event organizers only)
CREATE POLICY "Event organizers can create ticket tiers" ON public.event_ticket_tiers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_ticket_tiers.event_id
      AND events.organizer_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Policy for updating ticket tiers (event organizers only)
CREATE POLICY "Event organizers can update their ticket tiers" ON public.event_ticket_tiers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_ticket_tiers.event_id
      AND events.organizer_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_ticket_tiers.event_id
      AND events.organizer_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Policy for deleting ticket tiers (event organizers only)
CREATE POLICY "Event organizers can delete their ticket tiers" ON public.event_ticket_tiers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_ticket_tiers.event_id
      AND events.organizer_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Create a function to automatically update sold_count
CREATE OR REPLACE FUNCTION update_ticket_tier_sold_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_tier_id IS NOT NULL THEN
    UPDATE public.event_ticket_tiers
    SET sold_count = sold_count + 1
    WHERE id = NEW.ticket_tier_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add ticket_tier_id to tickets table
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS ticket_tier_id UUID REFERENCES public.event_ticket_tiers(id);

-- Create trigger for updating sold count
CREATE TRIGGER update_tier_sold_count_trigger
AFTER INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION update_ticket_tier_sold_count();

-- Add additional event fields that were missing
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS min_attendees INTEGER,
ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) DEFAULT 'in-person',
ADD COLUMN IF NOT EXISTS meeting_link TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT,
ADD COLUMN IF NOT EXISTS speaker_info TEXT,
ADD COLUMN IF NOT EXISTS agenda TEXT,
ADD COLUMN IF NOT EXISTS sponsors TEXT,
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS registration_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS registration_deadline DATE,
ADD COLUMN IF NOT EXISTS refund_policy TEXT,
ADD COLUMN IF NOT EXISTS parking_info TEXT,
ADD COLUMN IF NOT EXISTS accessibility_info TEXT,
ADD COLUMN IF NOT EXISTS dress_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS age_restriction VARCHAR(50),
ADD COLUMN IF NOT EXISTS prerequisites TEXT,
ADD COLUMN IF NOT EXISTS materials_provided TEXT,
ADD COLUMN IF NOT EXISTS recording_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS certificate_provided BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'English',
ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(50);

-- Create view for ticket tiers with availability
CREATE OR REPLACE VIEW public.ticket_tiers_availability AS
SELECT 
  t.*,
  t.quantity - COALESCE(t.sold_count, 0) as available_quantity,
  CASE 
    WHEN t.quantity - COALESCE(t.sold_count, 0) <= 0 THEN false
    ELSE t.available
  END as is_available
FROM public.event_ticket_tiers t;

-- Grant access to the view
GRANT SELECT ON public.ticket_tiers_availability TO authenticated;
GRANT SELECT ON public.ticket_tiers_availability TO anon;