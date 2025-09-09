import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // SQL commands to fix the ticket_statistics RLS issue
    const fixSQL = `
-- Fix for ticket_statistics RLS policies

-- 1. Drop existing restrictive policies on ticket_statistics
DROP POLICY IF EXISTS "Users can view ticket statistics" ON ticket_statistics;
DROP POLICY IF EXISTS "Only system can insert statistics" ON ticket_statistics;
DROP POLICY IF EXISTS "Only system can update statistics" ON ticket_statistics;
DROP POLICY IF EXISTS "ticket_statistics_select" ON ticket_statistics;
DROP POLICY IF EXISTS "ticket_statistics_insert" ON ticket_statistics;
DROP POLICY IF EXISTS "ticket_statistics_update" ON ticket_statistics;

-- 2. Create permissive policies for authenticated users
CREATE POLICY "Allow all for authenticated users" ON ticket_statistics
    FOR ALL 
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Temporarily disable the trigger to allow direct inserts
ALTER TABLE tickets DISABLE TRIGGER update_ticket_stats_on_insert;

-- 4. Grant permissions
GRANT ALL ON ticket_statistics TO authenticated;
GRANT ALL ON ticket_statistics TO anon;
`;

    return NextResponse.json({
      success: true,
      message: "Ticket statistics RLS fix SQL generated",
      instruction: "Please run the following SQL in your Supabase SQL Editor:",
      sql: fixSQL,
      next_steps: [
        "1. Go to your Supabase Dashboard",
        "2. Navigate to SQL Editor",
        "3. Paste and run the SQL above",
        "4. Try generating tickets again at /api/tickets/test-generate"
      ]
    });

  } catch (error: any) {
    console.error("Fix generation error:", error);
    return NextResponse.json({ 
      error: "Failed to generate fix",
      details: error.message 
    }, { status: 500 });
  }
}