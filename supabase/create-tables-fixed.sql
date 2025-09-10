-- First, ensure event_pages table exists (if not already created)
CREATE TABLE IF NOT EXISTS public.event_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    banner_image VARCHAR(500),
    location VARCHAR(255),
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on event_pages
ALTER TABLE public.event_pages ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for event_pages
CREATE POLICY "Anyone can view published event pages" ON public.event_pages
    FOR SELECT
    TO authenticated
    USING (status = 'published' OR created_by = auth.uid());

CREATE POLICY "Admins can manage all event pages" ON public.event_pages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Now create page_controllers table
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

-- RLS Policies for page_controllers

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

-- Grant necessary permissions
GRANT ALL ON public.page_controllers TO authenticated;
GRANT ALL ON public.page_controllers TO service_role;

-- Add comments
COMMENT ON TABLE public.page_controllers IS 'Stores page controller assignments for event pages';
COMMENT ON COLUMN public.page_controllers.event_page_id IS 'The event page being controlled';
COMMENT ON COLUMN public.page_controllers.controller_id IS 'The user assigned as controller';
COMMENT ON COLUMN public.page_controllers.assigned_by IS 'The admin who assigned this controller';
COMMENT ON COLUMN public.page_controllers.assigned_at IS 'When the controller was assigned';
COMMENT ON COLUMN public.page_controllers.permissions IS 'JSON object containing controller permissions';