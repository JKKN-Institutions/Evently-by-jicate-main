export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          title: string
          description: string
          date: string
          time: string
          venue: string
          location: string
          price: number
          max_attendees: number
          current_attendees: number
          image_url: string | null
          organizer_id: string
          category: string
          status: 'draft' | 'published' | 'cancelled'
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          title: string
          description: string
          date: string
          time: string
          venue: string
          location: string
          price: number
          max_attendees: number
          current_attendees?: number
          image_url?: string | null
          organizer_id: string
          category: string
          status?: 'draft' | 'published' | 'cancelled'
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          title?: string
          description?: string
          date?: string
          time?: string
          venue?: string
          location?: string
          price?: number
          max_attendees?: number
          current_attendees?: number
          image_url?: string | null
          organizer_id?: string
          category?: string
          status?: 'draft' | 'published' | 'cancelled'
        }
      }
      bookings: {
        Row: {
          id: string
          created_at: string
          event_id: string
          user_id: string
          user_email: string
          user_name: string
          user_phone: string
          quantity: number
          total_amount: number
          payment_id: string | null
          payment_status: 'pending' | 'completed' | 'failed' | 'refunded'
          booking_status: 'confirmed' | 'cancelled'
        }
        Insert: {
          id?: string
          created_at?: string
          event_id: string
          user_id: string
          user_email: string
          user_name: string
          user_phone: string
          quantity: number
          total_amount: number
          payment_id?: string | null
          payment_status?: 'pending' | 'completed' | 'failed' | 'refunded'
          booking_status?: 'confirmed' | 'cancelled'
        }
        Update: {
          id?: string
          created_at?: string
          event_id?: string
          user_id?: string
          user_email?: string
          user_name?: string
          user_phone?: string
          quantity?: number
          total_amount?: number
          payment_id?: string | null
          payment_status?: 'pending' | 'completed' | 'failed' | 'refunded'
          booking_status?: 'confirmed' | 'cancelled'
        }
      }
      payments: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          booking_id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          amount: number
          currency: string
          status: 'created' | 'authorized' | 'captured' | 'failed' | 'pending' | 'refund_initiated' | 'refunded' | 'partially_refunded'
          payment_method: string | null
          error_code: string | null
          error_description: string | null
          error_source: string | null
          error_step: string | null
          error_reason: string | null
          attempts: number
          notes: Json | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          booking_id: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          amount: number
          currency?: string
          status?: 'created' | 'authorized' | 'captured' | 'failed' | 'pending' | 'refund_initiated' | 'refunded' | 'partially_refunded'
          payment_method?: string | null
          error_code?: string | null
          error_description?: string | null
          error_source?: string | null
          error_step?: string | null
          error_reason?: string | null
          attempts?: number
          notes?: Json | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          booking_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          amount?: number
          currency?: string
          status?: 'created' | 'authorized' | 'captured' | 'failed' | 'pending' | 'refund_initiated' | 'refunded' | 'partially_refunded'
          payment_method?: string | null
          error_code?: string | null
          error_description?: string | null
          error_source?: string | null
          error_step?: string | null
          error_reason?: string | null
          attempts?: number
          notes?: Json | null
          metadata?: Json | null
        }
      }
      tickets: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          booking_id: string
          event_id: string
          ticket_number: string
          qr_code: string
          status: 'valid' | 'used' | 'cancelled' | 'expired'
          checked_in_at: string | null
          checked_in_by: string | null
          seat_number: string | null
          ticket_type: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          booking_id: string
          event_id: string
          ticket_number: string
          qr_code: string
          status?: 'valid' | 'used' | 'cancelled' | 'expired'
          checked_in_at?: string | null
          checked_in_by?: string | null
          seat_number?: string | null
          ticket_type?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          booking_id?: string
          event_id?: string
          ticket_number?: string
          qr_code?: string
          status?: 'valid' | 'used' | 'cancelled' | 'expired'
          checked_in_at?: string | null
          checked_in_by?: string | null
          seat_number?: string | null
          ticket_type?: string
          metadata?: Json | null
        }
      }
      check_ins: {
        Row: {
          id: string
          created_at: string
          ticket_id: string
          event_id: string
          scanned_by: string
          scan_result: 'success' | 'already_used' | 'invalid' | 'expired' | 'wrong_event'
          device_info: Json | null
          location: string | null
          ip_address: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          ticket_id: string
          event_id: string
          scanned_by: string
          scan_result: 'success' | 'already_used' | 'invalid' | 'expired' | 'wrong_event'
          device_info?: Json | null
          location?: string | null
          ip_address?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          ticket_id?: string
          event_id?: string
          scanned_by?: string
          scan_result?: 'success' | 'already_used' | 'invalid' | 'expired' | 'wrong_event'
          device_info?: Json | null
          location?: string | null
          ip_address?: string | null
        }
      }
      event_staff: {
        Row: {
          id: string
          created_at: string
          event_id: string
          user_id: string
          role: 'scanner' | 'manager' | 'admin'
          permissions: Json
        }
        Insert: {
          id?: string
          created_at?: string
          event_id: string
          user_id: string
          role?: 'scanner' | 'manager' | 'admin'
          permissions?: Json
        }
        Update: {
          id?: string
          created_at?: string
          event_id?: string
          user_id?: string
          role?: 'scanner' | 'manager' | 'admin'
          permissions?: Json
        }
      }
      payment_logs: {
        Row: {
          id: string
          created_at: string
          payment_id: string | null
          booking_id: string | null
          event_type: string
          event_data: Json | null
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          payment_id?: string | null
          booking_id?: string | null
          event_type: string
          event_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          payment_id?: string | null
          booking_id?: string | null
          event_type?: string
          event_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: 'user' | 'organizer' | 'admin'
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'user' | 'organizer' | 'admin'
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'user' | 'organizer' | 'admin'
        }
      }
      role_permissions: {
        Row: {
          id: string
          created_at: string
          role: 'user' | 'organizer' | 'admin'
          permission: string
          resource: string
          description: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          role: 'user' | 'organizer' | 'admin'
          permission: string
          resource: string
          description?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          role?: 'user' | 'organizer' | 'admin'
          permission?: string
          resource?: string
          description?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          created_at: string
          user_id: string | null
          action: string
          table_name: string
          record_id: string | null
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id?: string | null
          action: string
          table_name: string
          record_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string | null
          action?: string
          table_name?: string
          record_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
        }
      }
    }
    Views: {
      organizer_dashboard: {
        Row: {
          id: string
          title: string
          date: string
          status: 'draft' | 'published' | 'cancelled'
          max_attendees: number
          current_attendees: number
          total_bookings: number
          total_revenue: number
          paid_bookings: number
        }
      }
      admin_analytics: {
        Row: {
          total_events: number
          total_users: number
          total_bookings: number
          total_revenue: number
          total_organizers: number
        }
      }
    }
    Functions: {
      get_user_role: {
        Args: { user_id?: string }
        Returns: 'user' | 'organizer' | 'admin'
      }
      is_admin: {
        Args: { user_id?: string }
        Returns: boolean
      }
      is_organizer_or_admin: {
        Args: { user_id?: string }
        Returns: boolean
      }
      has_permission: {
        Args: {
          user_role: 'user' | 'organizer' | 'admin'
          required_permission: string
          required_resource: string
        }
        Returns: boolean
      }
      promote_to_organizer: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      get_user_event_stats: {
        Args: { user_id?: string }
        Returns: Json
      }
      check_event_capacity: {
        Args: {
          event_id: string
          requested_quantity: number
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_table_name: string
          p_record_id: string
          p_old_values?: Json
          p_new_values?: Json
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
