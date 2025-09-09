import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get all events with their image URLs
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, image_url')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Analyze image URLs
    const analysis = events?.map(event => ({
      id: event.id,
      title: event.title,
      hasImage: !!event.image_url,
      imageType: event.image_url ? 
        (event.image_url.startsWith('data:') ? 'base64' : 
         event.image_url.startsWith('http') ? 'url' : 
         'other') : 'none',
      imagePreview: event.image_url ? 
        event.image_url.substring(0, 100) + (event.image_url.length > 100 ? '...' : '') : 
        null
    }))

    return NextResponse.json({ 
      totalEvents: events?.length || 0,
      events: analysis,
      summary: {
        withImages: analysis?.filter(e => e.hasImage).length || 0,
        base64Images: analysis?.filter(e => e.imageType === 'base64').length || 0,
        urlImages: analysis?.filter(e => e.imageType === 'url').length || 0,
        noImages: analysis?.filter(e => e.imageType === 'none').length || 0,
      }
    })
    
  } catch (error) {
    console.error('Debug check-images error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}