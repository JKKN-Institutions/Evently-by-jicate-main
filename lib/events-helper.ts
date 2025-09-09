import { createClient } from '@/lib/supabase/client'

export async function fetchEventsDirectly() {
  try {
    const supabase = createClient()
    
    // Simple direct query without complex joins
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .order('start_date', { ascending: true })
      .limit(20)
    
    if (error) {
      console.error('Direct Supabase query error:', error)
      return []
    }
    
    // Map start_date to date for frontend compatibility
    const formattedEvents = (events || []).map(event => ({
      ...event,
      date: event.start_date // Add date field for backward compatibility
    }))
    
    return formattedEvents
  } catch (error) {
    console.error('Error fetching events directly:', error)
    return []
  }
}

export function filterEventsByCategory(events: any[], category: string) {
  if (category === 'all') return events
  return events.filter(event => event.category === category)
}

export function searchEvents(events: any[], searchTerm: string) {
  if (!searchTerm) return events
  
  const term = searchTerm.toLowerCase()
  return events.filter(event => 
    event.title?.toLowerCase().includes(term) ||
    event.description?.toLowerCase().includes(term) ||
    event.venue?.toLowerCase().includes(term) ||
    event.location?.toLowerCase().includes(term)
  )
}