-- Create page_controllers table
CREATE TABLE IF NOT EXISTS public.page_controllers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_page_id UUID NOT NULL REFERENCES public.event_pages(id) ON DELETE CASCADE,
    controller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES public.profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    permissions JSONB DEFAULT '{"can_edit": true, "can_delete": false, "can_manage_controllers": false}'::jsonb,
    UNIQUE(event_page_id, controller_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_page_controllers_event_page_id ON public.page_controllers(event_page_id);
CREATE INDEX IF NOT EXISTS idx_page_controllers_controller_id ON public.page_controllers(controller_id);
CREATE INDEX IF NOT EXISTS idx_page_controllers_assigned_by ON public.page_controllers(assigned_by);
CREATE INDEX IF NOT EXISTS idx_page_controllers_assigned_at ON public.page_controllers(assigned_at DESC);

-- Enable Row Level Security
ALTER TABLE public.page_controllers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all page controllers" ON public.page_controllers;
DROP POLICY IF EXISTS "Admins can create page controllers" ON public.page_controllers;
DROP POLICY IF EXISTS "Admins can update page controllers" ON public.page_controllers;
DROP POLICY IF EXISTS "Admins can delete page controllers" ON public.page_controllers;
DROP POLICY IF EXISTS "Controllers can view their assignments" ON public.page_controllers;
DROP POLICY IF EXISTS "Organizers can view controllers for their events" ON public.page_controllers;

-- RLS Policies

-- Admin policies (full access)
CREATE POLICY "Admins can view all page controllers" ON public.page_controllers
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can create page controllers" ON public.page_controllers
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can update page controllers" ON public.page_controllers
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete page controllers" ON public.page_controllers
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Controllers can view their own assignments
CREATE POLICY "Controllers can view their assignments" ON public.page_controllers
    FOR SELECT
    TO authenticated
    USING (controller_id = auth.uid());

-- Organizers can view controllers for event pages they created
CREATE POLICY "Organizers can view controllers for their event pages" ON public.page_controllers
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.event_pages ep
            WHERE ep.id = page_controllers.event_page_id
            AND ep.created_by = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT ALL ON public.page_controllers TO authenticated;
GRANT ALL ON public.page_controllers TO service_role;

-- Add comment to table
COMMENT ON TABLE public.page_controllers IS 'Stores page controller assignments for event pages';
COMMENT ON COLUMN public.page_controllers.event_page_id IS 'The event page being controlled';
COMMENT ON COLUMN public.page_controllers.controller_id IS 'The user assigned as controller';
COMMENT ON COLUMN public.page_controllers.assigned_by IS 'The admin who assigned this controller';
COMMENT ON COLUMN public.page_controllers.assigned_at IS 'When the controller was assigned';
COMMENT ON COLUMN public.page_controllers.permissions IS 'JSON object containing controller permissions';