// Event Pages System Types

export interface EventPage {
  id: string
  title: string
  slug: string
  description?: string
  banner_image?: string
  location?: string
  start_date?: string
  end_date?: string
  status: 'draft' | 'published' | 'archived'
  created_by?: string
  created_at: string
  updated_at: string
  
  // Relations
  child_events?: ChildEvent[]
  page_controller?: RoleAssignment
}

export interface ChildEvent {
  id: string
  title: string
  description?: string
  date: string
  time: string
  venue: string
  location?: string
  price: number
  max_attendees: number
  event_page_id?: string // Reference to parent Event Page
  is_child_event: boolean
  
  // Relations
  event_page?: EventPage
  event_controller?: RoleAssignment
}

export interface RoleAssignment {
  id: string
  user_id: string
  role_type: 'page_controller' | 'event_controller'
  event_page_id?: string
  event_id?: string
  assigned_by: string
  assigned_at: string
  is_active: boolean
  
  // Relations
  user?: {
    id: string
    email: string
    full_name: string
    avatar_url?: string
  }
  assigned_by_user?: {
    id: string
    full_name: string
  }
}

export interface PageControllerView {
  id: string
  user_id: string
  controller_name: string
  controller_email: string
  event_page_id: string
  page_title: string
  assigned_at: string
  assigned_by: string
  assigned_by_name: string
}

export interface EventControllerView {
  id: string
  user_id: string
  controller_name: string
  controller_email: string
  event_id: string
  event_title: string
  event_page_id?: string
  page_title?: string
  assigned_at: string
  assigned_by: string
  assigned_by_name: string
}

export type UserPermission = 'admin' | 'page_controller' | 'event_controller' | 'none'

export interface RoleAuditLog {
  id: string
  action: 'assigned' | 'removed' | 'updated'
  user_id: string
  target_user_id: string
  role_type: string
  event_page_id?: string
  event_id?: string
  details?: any
  created_at: string
}