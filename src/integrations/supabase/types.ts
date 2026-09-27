export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      event_staff: {
        Row: {
          added_by: string | null
          created_at: string
          email: string | null
          event_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email?: string | null
          event_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string | null
          event_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string
          city: string
          cover_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_featured: boolean
          organizer_id: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          summary: string | null
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          category?: string
          city?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_featured?: boolean
          organizer_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          summary?: string | null
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          category?: string
          city?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_featured?: boolean
          organizer_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          summary?: string | null
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      mpesa_config: {
        Row: {
          b2c_command_id: string
          b2c_consumer_key: string | null
          b2c_consumer_secret: string | null
          b2c_initiator_name: string | null
          b2c_security_credential: string | null
          b2c_shortcode: string | null
          callback_base_url: string | null
          callback_token: string
          consumer_key: string | null
          consumer_secret: string | null
          created_at: string
          environment: string
          id: string
          is_active: boolean
          party_b: string | null
          passkey: string | null
          shortcode: string | null
          transaction_type: string
          updated_at: string
        }
        Insert: {
          b2c_command_id?: string
          b2c_consumer_key?: string | null
          b2c_consumer_secret?: string | null
          b2c_initiator_name?: string | null
          b2c_security_credential?: string | null
          b2c_shortcode?: string | null
          callback_base_url?: string | null
          callback_token?: string
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string
          environment: string
          id?: string
          is_active?: boolean
          party_b?: string | null
          passkey?: string | null
          shortcode?: string | null
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          b2c_command_id?: string
          b2c_consumer_key?: string | null
          b2c_consumer_secret?: string | null
          b2c_initiator_name?: string | null
          b2c_security_credential?: string | null
          b2c_shortcode?: string | null
          callback_base_url?: string | null
          callback_token?: string
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          party_b?: string | null
          passkey?: string | null
          shortcode?: string | null
          transaction_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_email: string | null
          buyer_id: string | null
          buyer_name: string | null
          checkout_request_id: string | null
          created_at: string
          environment: string | null
          event_id: string
          id: string
          merchant_request_id: string | null
          mpesa_phone: string | null
          mpesa_receipt: string | null
          mpesa_reference: string | null
          paid_at: string | null
          quantity: number
          result_code: number | null
          result_desc: string | null
          status: Database["public"]["Enums"]["order_status"]
          ticket_type_id: string
          total_kes: number
          updated_at: string
        }
        Insert: {
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          checkout_request_id?: string | null
          created_at?: string
          environment?: string | null
          event_id: string
          id?: string
          merchant_request_id?: string | null
          mpesa_phone?: string | null
          mpesa_receipt?: string | null
          mpesa_reference?: string | null
          paid_at?: string | null
          quantity?: number
          result_code?: number | null
          result_desc?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          ticket_type_id: string
          total_kes?: number
          updated_at?: string
        }
        Update: {
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          checkout_request_id?: string | null
          created_at?: string
          environment?: string | null
          event_id?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_phone?: string | null
          mpesa_receipt?: string | null
          mpesa_reference?: string | null
          paid_at?: string | null
          quantity?: number
          result_code?: number | null
          result_desc?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          ticket_type_id?: string
          total_kes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_kes: number
          conversation_id: string | null
          created_at: string
          environment: string | null
          id: string
          mpesa_receipt: string | null
          organizer_id: string
          originator_conversation_id: string | null
          phone: string
          result_code: number | null
          result_desc: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_kes: number
          conversation_id?: string | null
          created_at?: string
          environment?: string | null
          id?: string
          mpesa_receipt?: string | null
          organizer_id: string
          originator_conversation_id?: string | null
          phone: string
          result_code?: number | null
          result_desc?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kes?: number
          conversation_id?: string | null
          created_at?: string
          environment?: string | null
          id?: string
          mpesa_receipt?: string | null
          organizer_id?: string
          originator_conversation_id?: string | null
          phone?: string
          result_code?: number | null
          result_desc?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_types: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          name: string
          price_kes: number
          quantity: number
          sold: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          name: string
          price_kes?: number
          quantity?: number
          sold?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          price_kes?: number
          quantity?: number
          sold?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          checked_in_at: string | null
          code: string
          created_at: string
          event_id: string
          holder_id: string | null
          id: string
          order_id: string
          ticket_type_id: string
        }
        Insert: {
          checked_in_at?: string | null
          code?: string
          created_at?: string
          event_id: string
          holder_id?: string | null
          id?: string
          order_id: string
          ticket_type_id: string
        }
        Update: {
          checked_in_at?: string | null
          code?: string
          created_at?: string
          event_id?: string
          holder_id?: string | null
          id?: string
          order_id?: string
          ticket_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_event_owner: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_event_staff: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "organizer" | "attendee"
      event_status: "draft" | "published" | "cancelled" | "completed"
      order_status: "pending" | "paid" | "failed" | "refunded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "organizer", "attendee"],
      event_status: ["draft", "published", "cancelled", "completed"],
      order_status: ["pending", "paid", "failed", "refunded"],
    },
  },
} as const
