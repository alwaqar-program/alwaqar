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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          beginner_id: string | null
          companion_id: string | null
          created_at: string
          date: string
          id: string
          is_deleted: boolean | null
          late_reason: string | null
          late_reason_other: string | null
          period: string
          recorded_by: string | null
          status: string
          student_id: string | null
        }
        Insert: {
          beginner_id?: string | null
          companion_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_deleted?: boolean | null
          late_reason?: string | null
          late_reason_other?: string | null
          period: string
          recorded_by?: string | null
          status: string
          student_id?: string | null
        }
        Update: {
          beginner_id?: string | null
          companion_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_deleted?: boolean | null
          late_reason?: string | null
          late_reason_other?: string | null
          period?: string
          recorded_by?: string | null
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_juz: {
        Row: {
          branch_id: string
          from_page: number
          id: string
          juz_name: string | null
          juz_number: number
          sort_order: number
          to_page: number
        }
        Insert: {
          branch_id: string
          from_page: number
          id?: string
          juz_name?: string | null
          juz_number: number
          sort_order?: number
          to_page: number
        }
        Update: {
          branch_id?: string
          from_page?: number
          id?: string
          juz_name?: string | null
          juz_number?: number
          sort_order?: number
          to_page?: number
        }
        Relationships: [
          {
            foreignKeyName: "branch_juz_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          branch_name: string
          created_at: string
          expected_daily_pages: number
          id: string
          is_active: boolean
          juz_count: number
          program_end_date: string | null
          program_start_date: string | null
          updated_at: string
        }
        Insert: {
          branch_name: string
          created_at?: string
          expected_daily_pages?: number
          id?: string
          is_active?: boolean
          juz_count?: number
          program_end_date?: string | null
          program_start_date?: string | null
          updated_at?: string
        }
        Update: {
          branch_name?: string
          created_at?: string
          expected_daily_pages?: number
          id?: string
          is_active?: boolean
          juz_count?: number
          program_end_date?: string | null
          program_start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      circles: {
        Row: {
          branch_id: string
          circle_name: string
          circle_type: string
          created_at: string
          id: string
          is_active: boolean
          period: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          circle_name: string
          circle_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          period: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          circle_name?: string
          circle_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string
          date: string
          evaluator_name: string | null
          id: string
          notes: string | null
          result: string | null
          score: number | null
          student_id: string
          type: string
        }
        Insert: {
          created_at?: string
          date?: string
          evaluator_name?: string | null
          id?: string
          notes?: string | null
          result?: string | null
          score?: number | null
          student_id: string
          type: string
        }
        Update: {
          created_at?: string
          date?: string
          evaluator_name?: string | null
          id?: string
          notes?: string | null
          result?: string | null
          score?: number | null
          student_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          date: string
          errors_section_1: number | null
          errors_section_2: number | null
          errors_section_3: number | null
          errors_section_4: number | null
          exam_type: string
          examiner_name: string | null
          id: string
          is_deleted: boolean | null
          max_score: number | null
          notes: string | null
          recorded_by: string | null
          segment_changes: number | null
          student_id: string
          total_errors: number | null
          total_score: number | null
        }
        Insert: {
          created_at?: string
          date?: string
          errors_section_1?: number | null
          errors_section_2?: number | null
          errors_section_3?: number | null
          errors_section_4?: number | null
          exam_type: string
          examiner_name?: string | null
          id?: string
          is_deleted?: boolean | null
          max_score?: number | null
          notes?: string | null
          recorded_by?: string | null
          segment_changes?: number | null
          student_id: string
          total_errors?: number | null
          total_score?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          errors_section_1?: number | null
          errors_section_2?: number | null
          errors_section_3?: number | null
          errors_section_4?: number | null
          exam_type?: string
          examiner_name?: string | null
          id?: string
          is_deleted?: boolean | null
          max_score?: number | null
          notes?: string | null
          recorded_by?: string | null
          segment_changes?: number | null
          student_id?: string
          total_errors?: number | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exams_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          beginner_id: string | null
          companion_id: string | null
          created_at: string
          end_date: string | null
          id: string
          leave_type: string
          notes: string | null
          reason: string | null
          start_date: string
          status: string
          student_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          beginner_id?: string | null
          companion_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          leave_type: string
          notes?: string | null
          reason?: string | null
          start_date?: string
          status?: string
          student_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          beginner_id?: string | null
          companion_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          leave_type?: string
          notes?: string | null
          reason?: string | null
          start_date?: string
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "companions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_beginner_id_fkey"
            columns: ["beginner_id"]
            isOneToOne: false
            referencedRelation: "beginners"
            referencedColumns: ["id"]
          },
        ]
      }
      mushaf_reference: {
        Row: {
          cumulative_completion_pct: number | null
          hizb_number: number
          id: string
          juz_number: number
          page_number: number
          position_label: string | null
          sort_order: number
          surah_name: string
          surah_number: number
          verse_end: number
          verse_start: number
        }
        Insert: {
          cumulative_completion_pct?: number | null
          hizb_number: number
          id?: string
          juz_number: number
          page_number: number
          position_label?: string | null
          sort_order: number
          surah_name: string
          surah_number: number
          verse_end: number
          verse_start: number
        }
        Update: {
          cumulative_completion_pct?: number | null
          hizb_number?: number
          id?: string
          juz_number?: number
          page_number?: number
          position_label?: string | null
          sort_order?: number
          surah_name?: string
          surah_number?: number
          verse_end?: number
          verse_start?: number
        }
        Relationships: []
      }
      pledges: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          pledge_text: string | null
          pledge_type: string
          signed: boolean
          signed_date: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          pledge_text?: string | null
          pledge_type: string
          signed?: boolean
          signed_date?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          pledge_text?: string | null
          pledge_type?: string
          signed?: boolean
          signed_date?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pledges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recitation_log: {
        Row: {
          beginner_id: string | null
          circle_id: string
          companion_id: string | null
          created_at: string
          date: string
          deleted_at: string | null
          deleted_by: string | null
          error_count: number
          from_page: number | null
          from_sort_order: number | null
          from_surah: string | null
          from_verse: number | null
          grade: string | null
          id: string
          is_deleted: boolean | null
          hifz_confirmed: boolean | null
          is_extra_memorization: boolean | null
          lahn_count: number | null
          pages_recited: number | null
          period: string
          recorded_by: string | null
          reciter_id: string | null
          score: number | null
          student_id: string | null
          teacher_id: string | null
          thabit_confirmed: boolean | null
          to_page: number | null
          to_sort_order: number | null
          to_surah: string | null
          to_verse: number | null
        }
        Insert: {
          beginner_id?: string | null
          circle_id: string
          companion_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          error_count?: number
          from_page?: number | null
          from_sort_order?: number | null
          from_surah?: string | null
          from_verse?: number | null
          grade?: string | null
          hifz_confirmed?: boolean | null
          id?: string
          is_deleted?: boolean | null
          is_extra_memorization?: boolean | null
          lahn_count?: number | null
          pages_recited?: number | null
          period: string
          recorded_by?: string | null
          reciter_id?: string | null
          score?: number | null
          student_id?: string | null
          teacher_id?: string | null
          thabit_confirmed?: boolean | null
          to_page?: number | null
          to_sort_order?: number | null
          to_surah?: string | null
          to_verse?: number | null
        }
        Update: {
          beginner_id?: string | null
          circle_id?: string
          companion_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          error_count?: number
          from_page?: number | null
          from_sort_order?: number | null
          from_surah?: string | null
          from_verse?: number | null
          grade?: string | null
          hifz_confirmed?: boolean | null
          id?: string
          is_deleted?: boolean | null
          is_extra_memorization?: boolean | null
          lahn_count?: number | null
          pages_recited?: number | null
          period?: string
          recorded_by?: string | null
          reciter_id?: string | null
          score?: number | null
          student_id?: string | null
          teacher_id?: string | null
          thabit_confirmed?: boolean | null
          to_page?: number | null
          to_sort_order?: number | null
          to_surah?: string | null
          to_verse?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recitation_log_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recitation_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recitation_log_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          building: string | null
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          room_number: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          building?: string | null
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          room_number: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          building?: string | null
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          room_number?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          companions_details: string | null
          created_at: string
          email: string | null
          has_companions: boolean
          id: string
          is_active: boolean
          national_id: string | null
          notes: string | null
          phone: string | null
          staff_name: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          companions_details?: string | null
          created_at?: string
          email?: string | null
          has_companions?: boolean
          id?: string
          is_active?: boolean
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          staff_name: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          companions_details?: string | null
          created_at?: string
          email?: string | null
          has_companions?: boolean
          id?: string
          is_active?: boolean
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          staff_name?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          admission_status: string
          agreement_date: string | null
          agreement_signed: boolean | null
          circle_id: string | null
          companion_count_adults: number | null
          companion_count_children: number | null
          created_at: string
          email: string | null
          from_surah: string | null
          full_name: string
          guardian_phone: string | null
          has_companions: boolean | null
          housing_type: string | null
          id: string
          is_active: boolean
          memorization_start_page: number | null
          national_id: string | null
          nationality: string | null
          notes: string | null
          phone: string | null
          qualification: string | null
          registration_date: string | null
          registration_source: string | null
          room_id: string | null
          to_surah: string | null
          updated_at: string
        }
        Insert: {
          admission_status?: string
          agreement_date?: string | null
          agreement_signed?: boolean | null
          circle_id?: string | null
          companion_count_adults?: number | null
          companion_count_children?: number | null
          created_at?: string
          email?: string | null
          from_surah?: string | null
          full_name: string
          guardian_phone?: string | null
          has_companions?: boolean | null
          housing_type?: string | null
          id?: string
          is_active?: boolean
          memorization_start_page?: number | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          qualification?: string | null
          registration_date?: string | null
          registration_source?: string | null
          room_id?: string | null
          to_surah?: string | null
          updated_at?: string
        }
        Update: {
          admission_status?: string
          agreement_date?: string | null
          agreement_signed?: boolean | null
          circle_id?: string | null
          companion_count_adults?: number | null
          companion_count_children?: number | null
          created_at?: string
          email?: string | null
          from_surah?: string | null
          full_name?: string
          guardian_phone?: string | null
          has_companions?: boolean | null
          housing_type?: string | null
          id?: string
          is_active?: boolean
          memorization_start_page?: number | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          qualification?: string | null
          registration_date?: string | null
          registration_source?: string | null
          room_id?: string | null
          to_surah?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          circle_id: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          period: string | null
          start_date: string
          teacher_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          period?: string | null
          start_date?: string
          teacher_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          period?: string | null
          start_date?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          national_id: string | null
          phone: string | null
          registration_date: string | null
          teacher_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          national_id?: string | null
          phone?: string | null
          registration_date?: string | null
          teacher_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          national_id?: string | null
          phone?: string | null
          registration_date?: string | null
          teacher_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      violations: {
        Row: {
          action_taken: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          recorded_by: string | null
          student_id: string
          violation_date: string
          violation_type: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          recorded_by?: string | null
          student_id: string
          violation_date?: string
          violation_type: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          recorded_by?: string | null
          student_id?: string
          violation_date?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "violations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      app_role:
        | "admin"
        | "teacher"
        | "student_affairs"
        | "housing_supervisor"
        | "observer"
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
      app_role: [
        "admin",
        "teacher",
        "student_affairs",
        "housing_supervisor",
        "observer",
      ],
    },
  },
} as const
