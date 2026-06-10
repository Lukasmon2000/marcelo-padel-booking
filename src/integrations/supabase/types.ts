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
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_date: string
          class_slot_id: string
          class_type: string
          created_at: string
          confirmation_email_error: string | null
          confirmation_email_sent_at: string | null
          cancellation_email_error: string | null
          cancellation_email_sent_at: string | null
          reminder_4h_email_error: string | null
          reminder_4h_sent_at: string | null
          reminder_tomorrow_email_error: string | null
          reminder_tomorrow_sent_at: string | null
          daily_summary_email_error: string | null
          daily_summary_sent_at: string | null
          id: string
          level: Database["public"]["Enums"]["player_level"] | null
          monitor: string | null
          status: string
          user_id: string
        }
        Insert: {
          booking_date: string
          class_slot_id: string
          class_type?: string
          created_at?: string
          confirmation_email_error?: string | null
          confirmation_email_sent_at?: string | null
          cancellation_email_error?: string | null
          cancellation_email_sent_at?: string | null
          reminder_4h_email_error?: string | null
          reminder_4h_sent_at?: string | null
          reminder_tomorrow_email_error?: string | null
          reminder_tomorrow_sent_at?: string | null
          daily_summary_email_error?: string | null
          daily_summary_sent_at?: string | null
          id?: string
          level?: Database["public"]["Enums"]["player_level"] | null
          monitor?: string | null
          status?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          class_slot_id?: string
          class_type?: string
          created_at?: string
          confirmation_email_error?: string | null
          confirmation_email_sent_at?: string | null
          cancellation_email_error?: string | null
          cancellation_email_sent_at?: string | null
          reminder_4h_email_error?: string | null
          reminder_4h_sent_at?: string | null
          reminder_tomorrow_email_error?: string | null
          reminder_tomorrow_sent_at?: string | null
          daily_summary_email_error?: string | null
          daily_summary_sent_at?: string | null
          id?: string
          level?: Database["public"]["Enums"]["player_level"] | null
          monitor?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_class_slot_id_fkey"
            columns: ["class_slot_id"]
            isOneToOne: false
            referencedRelation: "class_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      class_slots: {
        Row: {
          court_name: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          level: Database["public"]["Enums"]["player_level"] | null
          max_players: number
          start_time: string
        }
        Insert: {
          court_name?: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["player_level"] | null
          max_players?: number
          start_time: string
        }
        Update: {
          court_name?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["player_level"] | null
          max_players?: number
          start_time?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          is_minor: boolean
          level: Database["public"]["Enums"]["player_level"]
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_minor?: boolean
          level?: Database["public"]["Enums"]["player_level"]
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_minor?: boolean
          level?: Database["public"]["Enums"]["player_level"]
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_bookings: {
        Row: {
          class_slot_id: string
          class_type: string
          created_at: string
          id: string
          is_active: boolean
          level: Database["public"]["Enums"]["player_level"] | null
          monitor: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          class_slot_id: string
          class_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["player_level"] | null
          monitor?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          class_slot_id?: string
          class_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["player_level"] | null
          monitor?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bookings_class_slot_id_fkey"
            columns: ["class_slot_id"]
            isOneToOne: false
            referencedRelation: "class_slots"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      waitlist: {
        Row: {
          booking_date: string
          class_slot_id: string
          created_at: string
          id: string
          position: number
          status: string
          user_id: string
        }
        Insert: {
          booking_date: string
          class_slot_id: string
          created_at?: string
          id?: string
          position?: number
          status?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          class_slot_id?: string
          created_at?: string
          id?: string
          position?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_class_slot_id_fkey"
            columns: ["class_slot_id"]
            isOneToOne: false
            referencedRelation: "class_slots"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "admin" | "user"
      gender: "hombre" | "mujer"
      player_level: "iniciacion" | "principiante" | "intermedio" | "avanzado"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
      gender: ["hombre", "mujer"],
      player_level: ["iniciacion", "principiante", "intermedio", "avanzado"],
    },
  },
} as const
