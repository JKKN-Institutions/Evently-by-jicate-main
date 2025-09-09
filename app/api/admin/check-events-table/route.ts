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

    // Try different queries to diagnose the issue
    const tests = [];

    // Test 1: Basic select all
    const { data: test1, error: error1 } = await supabase
      .from('events')
      .select('*')
      .limit(1);
    
    tests.push({
      test: 'Select all columns',
      success: !error1,
      data: test1,
      error: error1?.message
    });

    // Test 2: Select only id and title
    const { data: test2, error: error2 } = await supabase
      .from('events')
      .select('id, title')
      .limit(1);
    
    tests.push({
      test: 'Select id and title',
      success: !error2,
      data: test2,
      error: error2?.message
    });

    // Test 3: Try with different date columns
    const { data: test3, error: error3 } = await supabase
      .from('events')
      .select('id, title, start_date')
      .limit(1);
    
    tests.push({
      test: 'Select with start_date',
      success: !error3,
      data: test3,
      error: error3?.message
    });

    // Test 4: Try original query
    const { data: test4, error: error4 } = await supabase
      .from('events')
      .select('id, title, date, venue')
      .limit(1);
    
    tests.push({
      test: 'Original query (id, title, date, venue)',
      success: !error4,
      data: test4,
      error: error4?.message
    });

    // Get all events to see structure
    const { data: allEvents, error: allError } = await supabase
      .from('events')
      .select('*')
      .limit(3);

    // Check table structure (if we got any data)
    let tableColumns = null;
    if (allEvents && allEvents.length > 0) {
      tableColumns = Object.keys(allEvents[0]);
    }

    return NextResponse.json({
      success: true,
      message: "Events table diagnostic results",
      table_columns: tableColumns,
      event_count: allEvents?.length || 0,
      sample_event: allEvents?.[0] || null,
      tests,
      recommendation: !error4 
        ? "Table structure is correct" 
        : "Check which columns exist in your events table and update the analytics query"
    });

  } catch (error: any) {
    console.error("Diagnostic error:", error);
    return NextResponse.json({ 
      error: "Failed to run diagnostics",
      details: error.message 
    }, { status: 500 });
  }
}