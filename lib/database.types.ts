// Database types for Taskline
// These match the Supabase schema from the web application

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          company_name: string | null;
          company_type: string | null;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          company_name?: string | null;
          company_type?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          company_name?: string | null;
          company_type?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          phone: string | null;
          company: string | null;
          notes: string | null;
          onboarded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email: string;
          phone?: string | null;
          company?: string | null;
          notes?: string | null;
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          company?: string | null;
          notes?: string | null;
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          name: string;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          country: string | null;
          latitude: number | null;
          longitude: number | null;
          gate_code: string | null;
          lockbox_code: string | null;
          alarm_code: string | null;
          pets: string | null;
          hazards: string | null;
          square_footage: number | null;
          year_built: number | null;
          is_primary: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          name: string;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          gate_code?: string | null;
          lockbox_code?: string | null;
          alarm_code?: string | null;
          pets?: string | null;
          hazards?: string | null;
          square_footage?: number | null;
          year_built?: number | null;
          is_primary?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string;
          name?: string;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          gate_code?: string | null;
          lockbox_code?: string | null;
          alarm_code?: string | null;
          pets?: string | null;
          hazards?: string | null;
          square_footage?: number | null;
          year_built?: number | null;
          is_primary?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      property_equipment: {
        Row: {
          id: string;
          property_id: string;
          name: string;
          brand: string | null;
          model: string | null;
          serial_number: string | null;
          location: string | null;
          install_date: string | null;
          warranty_expiry: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          name: string;
          brand?: string | null;
          model?: string | null;
          serial_number?: string | null;
          location?: string | null;
          install_date?: string | null;
          warranty_expiry?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          name?: string;
          brand?: string | null;
          model?: string | null;
          serial_number?: string | null;
          location?: string | null;
          install_date?: string | null;
          warranty_expiry?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      requests: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          title: string;
          description: string | null;
          budget: string | null;
          deadline: string | null;
          status: 'new' | 'reviewing' | 'converted' | 'declined';
          files: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          title: string;
          description?: string | null;
          budget?: string | null;
          deadline?: string | null;
          status?: 'new' | 'reviewing' | 'converted' | 'declined';
          files?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string;
          title?: string;
          description?: string | null;
          budget?: string | null;
          deadline?: string | null;
          status?: 'new' | 'reviewing' | 'converted' | 'declined';
          files?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      request_messages: {
        Row: {
          id: string;
          request_id: string;
          sender_type: 'freelancer' | 'client';
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          sender_type: 'freelancer' | 'client';
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          sender_type?: 'freelancer' | 'client';
          message?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          request_id: string | null;
          name: string;
          description: string | null;
          status: 'active' | 'completed' | 'cancelled' | 'on_hold';
          start_date: string | null;
          deadline: string | null;
          estimated_duration_days: number | null;
          budget_total: number | null;
          approval_status: 'draft' | 'pending' | 'approved' | 'rejected';
          approval_token: string | null;
          approval_token_expires_at: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          request_id?: string | null;
          name: string;
          description?: string | null;
          status?: 'active' | 'completed' | 'cancelled' | 'on_hold';
          start_date?: string | null;
          deadline?: string | null;
          estimated_duration_days?: number | null;
          budget_total?: number | null;
          approval_status?: 'draft' | 'pending' | 'approved' | 'rejected';
          approval_token?: string | null;
          approval_token_expires_at?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string;
          request_id?: string | null;
          name?: string;
          description?: string | null;
          status?: 'active' | 'completed' | 'cancelled' | 'on_hold';
          start_date?: string | null;
          deadline?: string | null;
          estimated_duration_days?: number | null;
          budget_total?: number | null;
          approval_status?: 'draft' | 'pending' | 'approved' | 'rejected';
          approval_token?: string | null;
          approval_token_expires_at?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_line_items: {
        Row: {
          id: string;
          project_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          amount: number;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          description: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          description?: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
          order_index?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          status: 'todo' | 'in_progress' | 'completed';
          priority: 'low' | 'medium' | 'high';
          due_date: string | null;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          status?: 'todo' | 'in_progress' | 'completed';
          priority?: 'low' | 'medium' | 'high';
          due_date?: string | null;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string | null;
          status?: 'todo' | 'in_progress' | 'completed';
          priority?: 'low' | 'medium' | 'high';
          due_date?: string | null;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          property_id: string | null;
          title: string;
          description: string | null;
          start_time: string;
          end_time: string;
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          property_id?: string | null;
          title: string;
          description?: string | null;
          start_time: string;
          end_time: string;
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string;
          property_id?: string | null;
          title?: string;
          description?: string | null;
          start_time?: string;
          end_time?: string;
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scheduling_settings: {
        Row: {
          id: string;
          user_id: string;
          timezone: string;
          slot_duration_minutes: number;
          buffer_minutes: number;
          max_daily_bookings: number | null;
          advance_booking_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          timezone?: string;
          slot_duration_minutes?: number;
          buffer_minutes?: number;
          max_daily_bookings?: number | null;
          advance_booking_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          timezone?: string;
          slot_duration_minutes?: number;
          buffer_minutes?: number;
          max_daily_bookings?: number | null;
          advance_booking_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      availability_rules: {
        Row: {
          id: string;
          user_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_available: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_available?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          is_available?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      availability_blocks: {
        Row: {
          id: string;
          user_id: string;
          start_time: string;
          end_time: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_time: string;
          end_time: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          start_time?: string;
          end_time?: string;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      service_catalog: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          price: number | null;
          price_type: 'fixed' | 'hourly' | 'custom';
          duration_minutes: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          price?: number | null;
          price_type?: 'fixed' | 'hourly' | 'custom';
          duration_minutes?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          price?: number | null;
          price_type?: 'fixed' | 'hourly' | 'custom';
          duration_minutes?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          client_id: string | null;
          invoice_number: string;
          issue_date: string;
          due_date: string | null;
          status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
          subtotal: number;
          tax_rate: number;
          tax_amount: number;
          total: number;
          notes: string | null;
          payment_terms: string | null;
          payment_instructions: string | null;
          sent_at: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          client_id?: string | null;
          invoice_number: string;
          issue_date?: string;
          due_date?: string | null;
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
          subtotal?: number;
          tax_rate?: number;
          tax_amount?: number;
          total?: number;
          notes?: string | null;
          payment_terms?: string | null;
          payment_instructions?: string | null;
          sent_at?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          client_id?: string | null;
          invoice_number?: string;
          issue_date?: string;
          due_date?: string | null;
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
          subtotal?: number;
          tax_rate?: number;
          tax_amount?: number;
          total?: number;
          notes?: string | null;
          payment_terms?: string | null;
          payment_instructions?: string | null;
          sent_at?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          amount: number;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          description: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          description?: string;
          quantity?: number;
          unit_price?: number;
          amount?: number;
          order_index?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data: Record<string, unknown> | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data?: Record<string, unknown> | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          data?: Record<string, unknown> | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      request_status: 'new' | 'reviewing' | 'converted' | 'declined';
      project_status: 'active' | 'completed' | 'cancelled' | 'on_hold';
      approval_status: 'draft' | 'pending' | 'approved' | 'rejected';
      task_status: 'todo' | 'in_progress' | 'completed';
      task_priority: 'low' | 'medium' | 'high';
      invoice_status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
      booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
      sender_type: 'freelancer' | 'client';
      price_type: 'fixed' | 'hourly' | 'custom';
    };
  };
};

// Convenience types for use in components
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Client = Database['public']['Tables']['clients']['Row'];
export type ClientInsert = Database['public']['Tables']['clients']['Insert'];
export type ClientUpdate = Database['public']['Tables']['clients']['Update'];

export type Property = Database['public']['Tables']['properties']['Row'];
export type PropertyInsert = Database['public']['Tables']['properties']['Insert'];
export type PropertyUpdate = Database['public']['Tables']['properties']['Update'];

export type PropertyEquipment = Database['public']['Tables']['property_equipment']['Row'];
export type PropertyEquipmentInsert = Database['public']['Tables']['property_equipment']['Insert'];
export type PropertyEquipmentUpdate = Database['public']['Tables']['property_equipment']['Update'];

export type Request = Database['public']['Tables']['requests']['Row'];
export type RequestInsert = Database['public']['Tables']['requests']['Insert'];
export type RequestUpdate = Database['public']['Tables']['requests']['Update'];

export type RequestMessage = Database['public']['Tables']['request_messages']['Row'];
export type RequestMessageInsert = Database['public']['Tables']['request_messages']['Insert'];

export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export type ProjectLineItem = Database['public']['Tables']['project_line_items']['Row'];
export type ProjectLineItemInsert = Database['public']['Tables']['project_line_items']['Insert'];

export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

export type Booking = Database['public']['Tables']['bookings']['Row'];
export type BookingInsert = Database['public']['Tables']['bookings']['Insert'];
export type BookingUpdate = Database['public']['Tables']['bookings']['Update'];

export type SchedulingSettings = Database['public']['Tables']['scheduling_settings']['Row'];
export type SchedulingSettingsUpdate = Database['public']['Tables']['scheduling_settings']['Update'];

export type AvailabilityRule = Database['public']['Tables']['availability_rules']['Row'];
export type AvailabilityRuleInsert = Database['public']['Tables']['availability_rules']['Insert'];
export type AvailabilityRuleUpdate = Database['public']['Tables']['availability_rules']['Update'];

export type AvailabilityBlock = Database['public']['Tables']['availability_blocks']['Row'];
export type AvailabilityBlockInsert = Database['public']['Tables']['availability_blocks']['Insert'];
export type AvailabilityBlockUpdate = Database['public']['Tables']['availability_blocks']['Update'];

export type ServiceCatalogItem = Database['public']['Tables']['service_catalog']['Row'];
export type ServiceCatalogItemInsert = Database['public']['Tables']['service_catalog']['Insert'];
export type ServiceCatalogItemUpdate = Database['public']['Tables']['service_catalog']['Update'];

export type Invoice = Database['public']['Tables']['invoices']['Row'];
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];
export type InvoiceUpdate = Database['public']['Tables']['invoices']['Update'];

export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row'];
export type InvoiceItemInsert = Database['public']['Tables']['invoice_items']['Insert'];

export type Notification = Database['public']['Tables']['notifications']['Row'];

// Extended types with relations (matching web app patterns)
export type ClientWithProjects = Client & {
  projects?: Project[];
};

export type PropertyWithClient = Property & {
  client?: Client;
};

export type RequestWithClient = Request & {
  client?: Client;
  projects?: Project[];
};

export type RequestWithMessages = Request & {
  client?: Client;
  messages?: RequestMessage[];
};

export type ProjectWithRelations = Project & {
  client?: Client;
  tasks?: Task[];
  line_items?: ProjectLineItem[];
};

export type TaskWithProject = Task & {
  project?: Project & {
    client?: Client;
  };
};

export type BookingWithRelations = Booking & {
  client?: Client;
  property?: Property;
};

export type InvoiceWithRelations = Invoice & {
  project?: Project;
  client?: Client;
  items?: InvoiceItem[];
};
