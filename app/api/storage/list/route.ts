import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // List all files in the event-images bucket
    const { data: files, error } = await supabase.storage
      .from('event-images')
      .list('', {
        limit: 100,
        offset: 0
      })
    
    if (error) {
      console.error('Error listing storage files:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Also try to list in 'events' folder
    const { data: eventFiles } = await supabase.storage
      .from('event-images')
      .list('events', {
        limit: 100,
        offset: 0
      })
    
    return NextResponse.json({
      rootFiles: files || [],
      eventsFolderFiles: eventFiles || [],
      totalFiles: (files?.length || 0) + (eventFiles?.length || 0)
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Failed to list storage files' }, { status: 500 })
  }
}