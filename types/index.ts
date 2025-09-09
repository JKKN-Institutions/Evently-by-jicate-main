import { Database } from './supabase'

export type Event = Database['public']['Tables']['events']['Row']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type EventUpdate = Database['public']['Tables']['events']['Update']

export type Booking = Database['public']['Tables']['bookings']['Row']
export type BookingInsert = Database['public']['Tables']['bookings']['Insert']
export type BookingUpdate = Database['public']['Tables']['bookings']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Payment = Database['public']['Tables']['payments']['Row']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']
export type PaymentUpdate = Database['public']['Tables']['payments']['Update']

export type PaymentLog = Database['public']['Tables']['payment_logs']['Row']
export type PaymentLogInsert = Database['public']['Tables']['payment_logs']['Insert']

export type Ticket = Database['public']['Tables']['tickets']['Row']
export type TicketInsert = Database['public']['Tables']['tickets']['Insert']
export type TicketUpdate = Database['public']['Tables']['tickets']['Update']

export type CheckIn = Database['public']['Tables']['check_ins']['Row']
export type CheckInInsert = Database['public']['Tables']['check_ins']['Insert']

export type EventStaff = Database['public']['Tables']['event_staff']['Row']
export type EventStaffInsert = Database['public']['Tables']['event_staff']['Insert']

export type RolePermission = Database['public']['Tables']['role_permissions']['Row']
export type RolePermissionInsert = Database['public']['Tables']['role_permissions']['Insert']
export type RolePermissionUpdate = Database['public']['Tables']['role_permissions']['Update']

export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']
export type AuditLogUpdate = Database['public']['Tables']['audit_logs']['Update']

export type OrganizerDashboard = Database['public']['Views']['organizer_dashboard']['Row']
export type AdminAnalytics = Database['public']['Views']['admin_analytics']['Row']

export interface EventWithOrganizer extends Event {
  profiles: Profile
}

export interface BookingWithEvent extends Booking {
  events: Event
}

export interface CreateEventInput {
  title: string
  description: string
  date: string
  time: string
  venue: string
  location: string
  price: number
  max_attendees: number
  category: string
  image_url?: string
}

export interface CreateBookingInput {
  event_id: string
  user_name: string
  user_email: string
  user_phone: string
  quantity: number
}

// Role-based types
export type UserRole = 'user' | 'organizer' | 'admin'

export interface UserEventStats {
  total_events_created: number
  total_bookings_made: number
  total_amount_spent: number
  upcoming_events: number
}

export interface RoleBasedPermissions {
  canCreateEvents: boolean
  canManageAllEvents: boolean
  canViewAllBookings: boolean
  canManageUsers: boolean
  canViewAnalytics: boolean
  canPromoteUsers: boolean
}

export interface ProfileWithRole extends Profile {
  permissions?: RoleBasedPermissions
}

export interface EventWithBookingStats extends Event {
  total_bookings: number
  total_revenue: number
  paid_bookings: number
}
