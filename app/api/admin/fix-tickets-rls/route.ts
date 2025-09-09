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

    // Check if we can see tickets with service role
    const { count: actualCount } = await supabase
      .from("tickets")
      .select("*", { count: 'exact', head: true });

    // SQL to fix tickets table RLS
    const fixSQL = `
-- Fix RLS policies on tickets table

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Event organizers can view event tickets" ON tickets;
DROP POLICY IF EXISTS "Allow authenticated users to view tickets" ON tickets;

-- 2. Create permissive SELECT policy for authenticated users
CREATE POLICY "Anyone can view all tickets" ON tickets
    FOR SELECT
    USING (true);

-- 3. Create policy for authenticated users to manage tickets
CREATE POLICY "Authenticated can insert tickets" ON tickets
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update tickets" ON tickets
    FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- 4. Grant permissions
GRANT ALL ON tickets TO authenticated;
GRANT SELECT ON tickets TO anon;
`;

    return NextResponse.json({
      success: true,
      message: "Tickets RLS fix SQL generated",
      actual_ticket_count: actualCount || 0,
      instruction: "Run this SQL in your Supabase SQL Editor to fix ticket visibility:",
      sql: fixSQL,
      next_steps: [
        "1. Go to Supabase Dashboard > SQL Editor",
        "2. Run the SQL above",
        "3. Refresh http://localhost:3000/api/test-tickets",
        "4. Check http://localhost:3000/admin/analytics"
      ]
    });

  } catch (error: any) {
    console.error("RLS fix generation error:", error);
    return NextResponse.json({ 
      error: "Failed to generate RLS fix",
      details: error.message 
    }, { status: 500 });
  }
}