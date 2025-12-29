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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_group_permissions: {
        Row: {
          access_group_id: string
          created_at: string | null
          id: string
          permission_key: string
        }
        Insert: {
          access_group_id: string
          created_at?: string | null
          id?: string
          permission_key: string
        }
        Update: {
          access_group_id?: string
          created_at?: string | null
          id?: string
          permission_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_group_permissions_access_group_id_fkey"
            columns: ["access_group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      access_groups: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_groups_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_answers: {
        Row: {
          answer_option_ids: string[] | null
          answer_text: string | null
          created_at: string
          id: string
          question_id: string
          response_id: string
        }
        Insert: {
          answer_option_ids?: string[] | null
          answer_text?: string | null
          created_at?: string
          id?: string
          question_id: string
          response_id: string
        }
        Update: {
          answer_option_ids?: string[] | null
          answer_text?: string | null
          created_at?: string
          id?: string
          question_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "anamnese_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnese_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "anamnese_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_question_options: {
        Row: {
          id: string
          option_text: string
          order_index: number
          question_id: string
        }
        Insert: {
          id?: string
          option_text: string
          order_index?: number
          question_id: string
        }
        Update: {
          id?: string
          option_text?: string
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "anamnese_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_questions: {
        Row: {
          created_at: string
          id: string
          is_required: boolean | null
          order_index: number
          question_text: string
          question_type: string
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean | null
          order_index?: number
          question_text: string
          question_type: string
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean | null
          order_index?: number
          question_text?: string
          question_type?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_questions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "anamnese_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_responses: {
        Row: {
          clinic_id: string
          created_at: string
          filled_by_patient: boolean | null
          id: string
          patient_id: string
          professional_id: string | null
          public_token: string | null
          responsibility_accepted: boolean | null
          signature_data: string | null
          signed_at: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          filled_by_patient?: boolean | null
          id?: string
          patient_id: string
          professional_id?: string | null
          public_token?: string | null
          responsibility_accepted?: boolean | null
          signature_data?: string | null
          signed_at?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          filled_by_patient?: boolean | null
          id?: string
          patient_id?: string
          professional_id?: string | null
          public_token?: string | null
          responsibility_accepted?: boolean | null
          signature_data?: string | null
          signed_at?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_responses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnese_responses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnese_responses_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnese_responses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "anamnese_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_templates: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesis: {
        Row: {
          additional_notes: string | null
          alcohol: boolean | null
          allergies: string | null
          blood_type: string | null
          chronic_diseases: string | null
          clinic_id: string
          created_at: string
          current_medications: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          family_history: string | null
          filled_at: string
          id: string
          patient_id: string
          physical_activity: boolean | null
          previous_surgeries: string | null
          smoking: boolean | null
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          alcohol?: boolean | null
          allergies?: string | null
          blood_type?: string | null
          chronic_diseases?: string | null
          clinic_id: string
          created_at?: string
          current_medications?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          family_history?: string | null
          filled_at?: string
          id?: string
          patient_id: string
          physical_activity?: boolean | null
          previous_surgeries?: string | null
          smoking?: boolean | null
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          alcohol?: boolean | null
          allergies?: string | null
          blood_type?: string | null
          chronic_diseases?: string | null
          clinic_id?: string
          created_at?: string
          current_medications?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          family_history?: string | null
          filled_at?: string
          id?: string
          patient_id?: string
          physical_activity?: boolean | null
          previous_surgeries?: string | null
          smoking?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          api_key_hash: string
          api_key_preview: string
          clinic_id: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          permissions: Json | null
          updated_at: string | null
        }
        Insert: {
          api_key_hash: string
          api_key_preview: string
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Update: {
          api_key_hash?: string
          api_key_preview?: string
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      api_logs: {
        Row: {
          api_key_id: string | null
          clinic_id: string
          created_at: string | null
          duration_ms: number | null
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          request_body: Json | null
          response_body: Json | null
          response_status: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          clinic_id: string
          created_at?: string | null
          duration_ms?: number | null
          endpoint: string
          id?: string
          ip_address?: string | null
          method: string
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          clinic_id?: string
          created_at?: string | null
          duration_ms?: number | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          cancellation_reason: string | null
          cancelled_at: string | null
          clinic_id: string
          completed_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          end_time: string
          id: string
          notes: string | null
          patient_id: string
          procedure_id: string | null
          professional_id: string
          reminder_sent: boolean | null
          start_time: string
          started_at: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          type: Database["public"]["Enums"]["appointment_type"]
          updated_at: string
        }
        Insert: {
          appointment_date: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          clinic_id: string
          completed_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          end_time: string
          id?: string
          notes?: string | null
          patient_id: string
          procedure_id?: string | null
          professional_id: string
          reminder_sent?: boolean | null
          start_time: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          clinic_id?: string
          completed_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          end_time?: string
          id?: string
          notes?: string | null
          patient_id?: string
          procedure_id?: string | null
          professional_id?: string
          reminder_sent?: boolean | null
          start_time?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      attachment_access_logs: {
        Row: {
          accessed_at: string
          action: string
          attachment_id: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string
          action: string
          attachment_id: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string
          action?: string
          attachment_id?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachment_access_logs_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "patient_attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      automation_flows: {
        Row: {
          channel: string
          clinic_id: string
          created_at: string
          created_by: string | null
          delay_hours: number | null
          deleted_at: string | null
          execution_count: number | null
          id: string
          is_active: boolean
          last_executed_at: string | null
          message_template: string
          name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          channel: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          delay_hours?: number | null
          deleted_at?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          message_template: string
          name: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          channel?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          delay_hours?: number | null
          deleted_at?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          message_template?: string
          name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_flows_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_message_logs: {
        Row: {
          clinic_id: string
          created_at: string
          error_message: string | null
          id: string
          patient_id: string
          patient_name: string
          patient_phone: string
          sent_at: string
          success: boolean
        }
        Insert: {
          clinic_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          patient_id: string
          patient_name: string
          patient_phone: string
          sent_at?: string
          success?: boolean
        }
        Update: {
          clinic_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          patient_id?: string
          patient_name?: string
          patient_phone?: string
          sent_at?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "birthday_message_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_message_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channel: string
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          delivered_count: number | null
          description: string | null
          failed_count: number | null
          id: string
          message_template: string
          name: string
          scheduled_at: string | null
          segment_id: string | null
          sent_count: number | null
          status: string
          updated_at: string
        }
        Insert: {
          channel: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          id?: string
          message_template: string
          name: string
          scheduled_at?: string | null
          segment_id?: string | null
          sent_count?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          id?: string
          message_template?: string
          name?: string
          scheduled_at?: string | null
          segment_id?: string | null
          sent_count?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "patient_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          account_number: string | null
          agency: string | null
          bank_name: string | null
          clinic_id: string
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          clinic_id: string
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          clinic_id?: string
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transfers: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string | null
          from_register_id: string
          id: string
          to_register_id: string
          transfer_date: string
        }
        Insert: {
          amount: number
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          from_register_id: string
          id?: string
          to_register_id: string
          transfer_date?: string
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          from_register_id?: string
          id?: string
          to_register_id?: string
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transfers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transfers_from_register_id_fkey"
            columns: ["from_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transfers_to_register_id_fkey"
            columns: ["to_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string
          clinic_id: string
          created_at: string
          deleted_at: string | null
          full_path: string | null
          hierarchy_level: number
          id: string
          is_active: boolean
          is_synthetic: boolean
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: string
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          full_path?: string | null
          hierarchy_level?: number
          id?: string
          is_active?: boolean
          is_synthetic?: boolean
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          full_path?: string | null
          hierarchy_level?: number
          id?: string
          is_active?: boolean
          is_synthetic?: boolean
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          clinic_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          last_message_at: string | null
          sector_id: string | null
          sector_name: string | null
          status: string
          updated_at: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          clinic_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          sector_id?: string | null
          sector_name?: string | null
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          clinic_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          sector_id?: string | null
          sector_name?: string | null
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "chat_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          sender_id: string
          sender_name: string | null
          sender_type: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          sender_id: string
          sender_name?: string | null
          sender_type: string
        }
        Update: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          sender_id?: string
          sender_name?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_quick_responses: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          shortcut: string | null
          title: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          shortcut?: string | null
          title: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          shortcut?: string | null
          title?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      chat_sectors: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_settings: {
        Row: {
          auto_offline_message: string | null
          created_at: string
          id: string
          is_enabled: boolean
          manual_override: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          auto_offline_message?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          manual_override?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          auto_offline_message?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          manual_override?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_working_hours: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinic_holidays: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          holiday_date: string
          id: string
          is_recurring: boolean | null
          name: string
          recurring_day: number | null
          recurring_month: number | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          holiday_date: string
          id?: string
          is_recurring?: boolean | null
          name: string
          recurring_day?: number | null
          recurring_month?: number | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          holiday_date?: string
          id?: string
          is_recurring?: boolean | null
          name?: string
          recurring_day?: number | null
          recurring_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_holidays_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_notification_reads: {
        Row: {
          clinic_id: string
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_notification_reads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "system_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          birthday_enabled: boolean | null
          birthday_message: string | null
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          city: string | null
          closing_time: string | null
          cnpj: string | null
          created_at: string
          custom_map_embed_url: string | null
          email: string | null
          enforce_schedule_validation: boolean | null
          holidays_enabled: boolean | null
          id: string
          is_blocked: boolean | null
          is_maintenance: boolean | null
          logo_url: string | null
          maintenance_at: string | null
          maintenance_by: string | null
          maintenance_reason: string | null
          map_view_type: string | null
          name: string
          opening_time: string | null
          phone: string | null
          reminder_enabled: boolean | null
          reminder_hours: number | null
          restrict_one_appointment_per_cpf_month: boolean | null
          slug: string
          state_code: string | null
          updated_at: string
          whatsapp_header_image_url: string | null
        }
        Insert: {
          address?: string | null
          birthday_enabled?: boolean | null
          birthday_message?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          city?: string | null
          closing_time?: string | null
          cnpj?: string | null
          created_at?: string
          custom_map_embed_url?: string | null
          email?: string | null
          enforce_schedule_validation?: boolean | null
          holidays_enabled?: boolean | null
          id?: string
          is_blocked?: boolean | null
          is_maintenance?: boolean | null
          logo_url?: string | null
          maintenance_at?: string | null
          maintenance_by?: string | null
          maintenance_reason?: string | null
          map_view_type?: string | null
          name: string
          opening_time?: string | null
          phone?: string | null
          reminder_enabled?: boolean | null
          reminder_hours?: number | null
          restrict_one_appointment_per_cpf_month?: boolean | null
          slug: string
          state_code?: string | null
          updated_at?: string
          whatsapp_header_image_url?: string | null
        }
        Update: {
          address?: string | null
          birthday_enabled?: boolean | null
          birthday_message?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          city?: string | null
          closing_time?: string | null
          cnpj?: string | null
          created_at?: string
          custom_map_embed_url?: string | null
          email?: string | null
          enforce_schedule_validation?: boolean | null
          holidays_enabled?: boolean | null
          id?: string
          is_blocked?: boolean | null
          is_maintenance?: boolean | null
          logo_url?: string | null
          maintenance_at?: string | null
          maintenance_by?: string | null
          maintenance_reason?: string | null
          map_view_type?: string | null
          name?: string
          opening_time?: string | null
          phone?: string | null
          reminder_enabled?: boolean | null
          reminder_hours?: number | null
          restrict_one_appointment_per_cpf_month?: boolean | null
          slug?: string
          state_code?: string | null
          updated_at?: string
          whatsapp_header_image_url?: string | null
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          clinic_id: string
          code: string
          created_at: string
          deleted_at: string | null
          description: string | null
          hierarchy_level: number
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          code: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          hierarchy_level?: number
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          code?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          hierarchy_level?: number
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_settings: {
        Row: {
          attendance_template: string | null
          attendance_title: string | null
          certificate_template: string | null
          certificate_title: string | null
          clinic_id: string
          created_at: string
          custom_header_text: string | null
          exam_request_template: string | null
          exam_request_title: string | null
          footer_text: string | null
          id: string
          prescription_template: string | null
          prescription_title: string | null
          show_address: boolean | null
          show_cnpj: boolean | null
          show_footer: boolean | null
          show_logo: boolean | null
          show_phone: boolean | null
          updated_at: string
        }
        Insert: {
          attendance_template?: string | null
          attendance_title?: string | null
          certificate_template?: string | null
          certificate_title?: string | null
          clinic_id: string
          created_at?: string
          custom_header_text?: string | null
          exam_request_template?: string | null
          exam_request_title?: string | null
          footer_text?: string | null
          id?: string
          prescription_template?: string | null
          prescription_title?: string | null
          show_address?: boolean | null
          show_cnpj?: boolean | null
          show_footer?: boolean | null
          show_logo?: boolean | null
          show_phone?: boolean | null
          updated_at?: string
        }
        Update: {
          attendance_template?: string | null
          attendance_title?: string | null
          certificate_template?: string | null
          certificate_title?: string | null
          clinic_id?: string
          created_at?: string
          custom_header_text?: string | null
          exam_request_template?: string | null
          exam_request_title?: string | null
          footer_text?: string | null
          id?: string
          prescription_template?: string | null
          prescription_title?: string | null
          show_address?: boolean | null
          show_cnpj?: boolean | null
          show_footer?: boolean | null
          show_logo?: boolean | null
          show_phone?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_confirmations: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      evolution_configs: {
        Row: {
          api_key: string
          api_url: string
          clinic_id: string
          connected_at: string | null
          created_at: string
          direct_reply_enabled: boolean | null
          id: string
          instance_name: string
          is_connected: boolean | null
          phone_number: string | null
          qr_code: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_key: string
          api_url: string
          clinic_id: string
          connected_at?: string | null
          created_at?: string
          direct_reply_enabled?: boolean | null
          id?: string
          instance_name: string
          is_connected?: boolean | null
          phone_number?: string | null
          qr_code?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_key?: string
          api_url?: string
          clinic_id?: string
          connected_at?: string | null
          created_at?: string
          direct_reply_enabled?: boolean | null
          id?: string
          instance_name?: string
          is_connected?: boolean | null
          phone_number?: string | null
          qr_code?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolution_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_permissions: {
        Row: {
          created_at: string | null
          feature_id: string
          id: string
          permission_key: string
        }
        Insert: {
          created_at?: string | null
          feature_id: string
          id?: string
          permission_key: string
        }
        Update: {
          created_at?: string | null
          feature_id?: string
          id?: string
          permission_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_permissions_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "system_features"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          clinic_id: string
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_id: string | null
          amount: number
          appointment_id: string | null
          bank_reference: string | null
          cash_register_id: string | null
          category_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          is_reconciled: boolean | null
          notes: string | null
          paid_date: string | null
          patient_id: string | null
          payment_method: string | null
          procedure_id: string | null
          professional_id: string | null
          reconciled_at: string | null
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          appointment_id?: string | null
          bank_reference?: string | null
          cash_register_id?: string | null
          category_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          is_reconciled?: boolean | null
          notes?: string | null
          paid_date?: string | null
          patient_id?: string | null
          payment_method?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          reconciled_at?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          appointment_id?: string | null
          bank_reference?: string | null
          cash_register_id?: string | null
          category_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          is_reconciled?: boolean | null
          notes?: string | null
          paid_date?: string | null
          patient_id?: string | null
          payment_method?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          reconciled_at?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_settings: {
        Row: {
          background_effect: string | null
          badge_1_text: string | null
          badge_2_text: string | null
          created_at: string
          description: string | null
          hero_image_url: string | null
          highlights: Json | null
          id: string
          is_active: boolean | null
          primary_button_link: string | null
          primary_button_text: string | null
          secondary_button_link: string | null
          secondary_button_text: string | null
          show_floating_badges: boolean | null
          show_social_proof: boolean | null
          social_proof_rating: number | null
          social_proof_users: number | null
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          background_effect?: string | null
          badge_1_text?: string | null
          badge_2_text?: string | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          highlights?: Json | null
          id?: string
          is_active?: boolean | null
          primary_button_link?: string | null
          primary_button_text?: string | null
          secondary_button_link?: string | null
          secondary_button_text?: string | null
          show_floating_badges?: boolean | null
          show_social_proof?: boolean | null
          social_proof_rating?: number | null
          social_proof_users?: number | null
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          background_effect?: string | null
          badge_1_text?: string | null
          badge_2_text?: string | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          highlights?: Json | null
          id?: string
          is_active?: boolean | null
          primary_button_link?: string | null
          primary_button_text?: string | null
          secondary_button_link?: string | null
          secondary_button_text?: string | null
          show_floating_badges?: boolean | null
          show_social_proof?: boolean | null
          social_proof_rating?: number | null
          social_proof_users?: number | null
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      icd10_codes: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          description: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          description: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          description?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          clinic_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_count: number
          error_details: Json | null
          file_name: string | null
          id: string
          import_type: string
          status: string
          success_count: number
          total_rows: number
        }
        Insert: {
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          error_details?: Json | null
          file_name?: string | null
          id?: string
          import_type: string
          status?: string
          success_count?: number
          total_rows?: number
        }
        Update: {
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          error_details?: Json | null
          file_name?: string | null
          id?: string
          import_type?: string
          status?: string
          success_count?: number
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_plans: {
        Row: {
          clinic_id: string
          code: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          procedures: string[] | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          procedures?: string[] | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          procedures?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_consents: {
        Row: {
          channel: string
          clinic_id: string
          consent_date: string
          consent_type: string
          created_at: string
          id: string
          ip_address: string | null
          patient_id: string
          revoke_reason: string | null
          revoked_at: string | null
          source: string | null
        }
        Insert: {
          channel: string
          clinic_id: string
          consent_date?: string
          consent_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          patient_id: string
          revoke_reason?: string | null
          revoked_at?: string | null
          source?: string | null
        }
        Update: {
          channel?: string
          clinic_id?: string
          consent_date?: string
          consent_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          patient_id?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_consents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_documents: {
        Row: {
          additional_info: Json | null
          clinic_id: string
          content: string
          created_at: string
          document_date: string
          document_type: string
          id: string
          is_signed: boolean | null
          medical_record_id: string | null
          patient_id: string
          professional_id: string | null
          sent_at: string | null
          sent_to_phone: string | null
          sent_via_whatsapp: boolean | null
          signature_data: string | null
          signed_at: string | null
          updated_at: string
        }
        Insert: {
          additional_info?: Json | null
          clinic_id: string
          content: string
          created_at?: string
          document_date?: string
          document_type: string
          id?: string
          is_signed?: boolean | null
          medical_record_id?: string | null
          patient_id: string
          professional_id?: string | null
          sent_at?: string | null
          sent_to_phone?: string | null
          sent_via_whatsapp?: boolean | null
          signature_data?: string | null
          signed_at?: string | null
          updated_at?: string
        }
        Update: {
          additional_info?: Json | null
          clinic_id?: string
          content?: string
          created_at?: string
          document_date?: string
          document_type?: string
          id?: string
          is_signed?: boolean | null
          medical_record_id?: string | null
          patient_id?: string
          professional_id?: string | null
          sent_at?: string | null
          sent_to_phone?: string | null
          sent_via_whatsapp?: boolean | null
          signature_data?: string | null
          signed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_documents_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_documents_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          appointment_id: string | null
          chief_complaint: string | null
          clinic_id: string
          created_at: string
          diagnosis: string | null
          history_present_illness: string | null
          id: string
          notes: string | null
          patient_id: string
          physical_examination: string | null
          prescription: string | null
          professional_id: string | null
          record_date: string
          treatment_plan: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          chief_complaint?: string | null
          clinic_id: string
          created_at?: string
          diagnosis?: string | null
          history_present_illness?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          physical_examination?: string | null
          prescription?: string | null
          professional_id?: string | null
          record_date?: string
          treatment_plan?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          chief_complaint?: string | null
          clinic_id?: string
          created_at?: string
          diagnosis?: string | null
          history_present_illness?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          physical_examination?: string | null
          prescription?: string | null
          professional_id?: string | null
          record_date?: string
          treatment_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_repass_items: {
        Row: {
          appointment_id: string | null
          calculated_amount: number
          clinic_id: string
          created_at: string
          gross_amount: number
          id: string
          insurance_plan_id: string | null
          notes: string | null
          period_id: string
          procedure_id: string | null
          professional_id: string
          rule_id: string | null
          rule_snapshot: Json
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          calculated_amount: number
          clinic_id: string
          created_at?: string
          gross_amount: number
          id?: string
          insurance_plan_id?: string | null
          notes?: string | null
          period_id: string
          procedure_id?: string | null
          professional_id: string
          rule_id?: string | null
          rule_snapshot: Json
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          calculated_amount?: number
          clinic_id?: string
          created_at?: string
          gross_amount?: number
          id?: string
          insurance_plan_id?: string | null
          notes?: string | null
          period_id?: string
          procedure_id?: string | null
          professional_id?: string
          rule_id?: string | null
          rule_snapshot?: Json
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_repass_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_items_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_items_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "medical_repass_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_items_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_items_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "medical_repass_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_repass_payments: {
        Row: {
          cash_register_id: string | null
          clinic_id: string
          created_at: string
          financial_transaction_id: string | null
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          period_id: string
          professional_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          cash_register_id?: string | null
          clinic_id: string
          created_at?: string
          financial_transaction_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          period_id: string
          professional_id: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          cash_register_id?: string | null
          clinic_id?: string
          created_at?: string
          financial_transaction_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          period_id?: string
          professional_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_repass_payments_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_payments_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_payments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "medical_repass_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_payments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_repass_periods: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          calculated_at: string | null
          calculated_by: string | null
          clinic_id: string
          created_at: string
          deleted_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          reference_month: number
          reference_year: number
          status: string
          total_gross: number | null
          total_repass: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          calculated_by?: string | null
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          reference_month: number
          reference_year: number
          status?: string
          total_gross?: number | null
          total_repass?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          calculated_at?: string | null
          calculated_by?: string | null
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          reference_month?: number
          reference_year?: number
          status?: string
          total_gross?: number | null
          total_repass?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_repass_periods_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_repass_rules: {
        Row: {
          calculation_type: string
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          effective_until: string | null
          id: string
          insurance_plan_id: string | null
          is_active: boolean
          notes: string | null
          priority: number
          procedure_id: string | null
          professional_id: string | null
          updated_at: string
          value: number
          version: number
        }
        Insert: {
          calculation_type: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          insurance_plan_id?: string | null
          is_active?: boolean
          notes?: string | null
          priority?: number
          procedure_id?: string | null
          professional_id?: string | null
          updated_at?: string
          value: number
          version?: number
        }
        Update: {
          calculation_type?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          insurance_plan_id?: string | null
          is_active?: boolean
          notes?: string | null
          priority?: number
          procedure_id?: string | null
          professional_id?: string | null
          updated_at?: string
          value?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "medical_repass_rules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_rules_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_rules_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_repass_rules_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      message_logs: {
        Row: {
          clinic_id: string
          created_at: string | null
          id: string
          message_type: string
          month_year: string
          phone: string
          sent_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          id?: string
          message_type: string
          month_year: string
          phone: string
          sent_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          id?: string
          message_type?: string
          month_year?: string
          phone?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      municipal_holidays: {
        Row: {
          city: string
          created_at: string
          holiday_date: string
          id: string
          is_recurring: boolean | null
          name: string
          recurring_day: number | null
          recurring_month: number | null
          state_code: string
          year: number
        }
        Insert: {
          city: string
          created_at?: string
          holiday_date: string
          id?: string
          is_recurring?: boolean | null
          name: string
          recurring_day?: number | null
          recurring_month?: number | null
          state_code: string
          year: number
        }
        Update: {
          city?: string
          created_at?: string
          holiday_date?: string
          id?: string
          is_recurring?: boolean | null
          name?: string
          recurring_day?: number | null
          recurring_month?: number | null
          state_code?: string
          year?: number
        }
        Relationships: []
      }
      national_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          is_recurring: boolean | null
          name: string
          recurring_day: number | null
          recurring_month: number | null
          year: number
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          is_recurring?: boolean | null
          name: string
          recurring_day?: number | null
          recurring_month?: number | null
          year: number
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          is_recurring?: boolean | null
          name?: string
          recurring_day?: number | null
          recurring_month?: number | null
          year?: number
        }
        Relationships: []
      }
      odontogram_records: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          condition: string
          created_at: string
          id: string
          material: string | null
          notes: string | null
          patient_id: string
          professional_id: string | null
          recorded_at: string
          tooth_face: string | null
          tooth_number: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          condition: string
          created_at?: string
          id?: string
          material?: string | null
          notes?: string | null
          patient_id: string
          professional_id?: string | null
          recorded_at?: string
          tooth_face?: string | null
          tooth_number: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          condition?: string
          created_at?: string
          id?: string
          material?: string | null
          notes?: string | null
          patient_id?: string
          professional_id?: string | null
          recorded_at?: string
          tooth_face?: string | null
          tooth_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "odontogram_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      package_payments: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string
          due_date: string
          financial_transaction_id: string | null
          id: string
          installment_number: number
          notes: string | null
          paid_date: string | null
          patient_package_id: string
          payment_method: string | null
          status: string
          total_installments: number
          updated_at: string
        }
        Insert: {
          amount: number
          clinic_id: string
          created_at?: string
          due_date: string
          financial_transaction_id?: string | null
          id?: string
          installment_number?: number
          notes?: string | null
          paid_date?: string | null
          patient_package_id: string
          payment_method?: string | null
          status?: string
          total_installments?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string
          due_date?: string
          financial_transaction_id?: string | null
          id?: string
          installment_number?: number
          notes?: string | null
          paid_date?: string | null
          patient_package_id?: string
          payment_method?: string | null
          status?: string
          total_installments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_payments_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_payments_patient_package_id_fkey"
            columns: ["patient_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_sessions: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          notes: string | null
          patient_package_id: string
          professional_id: string | null
          session_date: string
          session_number: number
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_package_id: string
          professional_id?: string | null
          session_date?: string
          session_number: number
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_package_id?: string
          professional_id?: string | null
          session_date?: string
          session_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_sessions_patient_package_id_fkey"
            columns: ["patient_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_sessions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      package_templates: {
        Row: {
          clinic_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          procedure_id: string | null
          total_sessions: number
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          procedure_id?: string | null
          total_sessions?: number
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          procedure_id?: string | null
          total_sessions?: number
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "package_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_templates_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      panels: {
        Row: {
          clinic_id: string
          created_at: string
          display_config: Json | null
          id: string
          is_active: boolean
          name: string
          queue_ids: string[] | null
          token: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          display_config?: Json | null
          id?: string
          is_active?: boolean
          name: string
          queue_ids?: string[] | null
          token?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          display_config?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          queue_ids?: string[] | null
          token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "panels_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_attachments: {
        Row: {
          clinic_id: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          folder_id: string | null
          id: string
          patient_id: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          folder_id?: string | null
          id?: string
          patient_id: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          folder_id?: string | null
          id?: string
          patient_id?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_attachments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_attachments_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "patient_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_attachments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_folders: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_folder_id: string | null
          patient_id: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_folder_id?: string | null
          patient_id: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_folder_id?: string | null
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_folders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "patient_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_folders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_packages: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string | null
          expiry_date: string | null
          id: string
          name: string
          notes: string | null
          package_template_id: string | null
          patient_id: string
          price: number
          procedure_id: string | null
          purchase_date: string
          remaining_sessions: number | null
          status: string
          total_sessions: number
          updated_at: string
          used_sessions: number
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          name: string
          notes?: string | null
          package_template_id?: string | null
          patient_id: string
          price?: number
          procedure_id?: string | null
          purchase_date?: string
          remaining_sessions?: number | null
          status?: string
          total_sessions?: number
          updated_at?: string
          used_sessions?: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          package_template_id?: string | null
          patient_id?: string
          price?: number
          procedure_id?: string | null
          purchase_date?: string
          remaining_sessions?: number | null
          status?: string
          total_sessions?: number
          updated_at?: string
          used_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_packages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_package_template_id_fkey"
            columns: ["package_template_id"]
            isOneToOne: false
            referencedRelation: "package_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_packages_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_segments: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          filter_criteria: Json
          id: string
          is_active: boolean
          is_dynamic: boolean
          last_calculated_at: string | null
          name: string
          patient_count: number | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          filter_criteria?: Json
          id?: string
          is_active?: boolean
          is_dynamic?: boolean
          last_calculated_at?: string | null
          name: string
          patient_count?: number | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          filter_criteria?: Json
          id?: string
          is_active?: boolean
          is_dynamic?: boolean
          last_calculated_at?: string | null
          name?: string
          patient_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_segments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          birth_date: string | null
          birthplace: string | null
          cep: string | null
          city: string | null
          clinic_id: string
          complement: string | null
          contact_name: string | null
          cpf: string | null
          created_at: string
          education: string | null
          email: string | null
          father_name: string | null
          gender: string | null
          height_cm: number | null
          id: string
          insurance_plan_id: string | null
          is_company: boolean | null
          is_foreigner: boolean | null
          landline: string | null
          marital_status: string | null
          mother_name: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          phone: string
          preferred_channel: string | null
          priority: string | null
          profession: string | null
          record_code: number
          referral: string | null
          religion: string | null
          rg: string | null
          send_notifications: boolean | null
          skin_color: string | null
          state: string | null
          street: string | null
          street_number: string | null
          tag: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          birthplace?: string | null
          cep?: string | null
          city?: string | null
          clinic_id: string
          complement?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string
          education?: string | null
          email?: string | null
          father_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          insurance_plan_id?: string | null
          is_company?: boolean | null
          is_foreigner?: boolean | null
          landline?: string | null
          marital_status?: string | null
          mother_name?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          phone: string
          preferred_channel?: string | null
          priority?: string | null
          profession?: string | null
          record_code?: number
          referral?: string | null
          religion?: string | null
          rg?: string | null
          send_notifications?: boolean | null
          skin_color?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          tag?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          birthplace?: string | null
          cep?: string | null
          city?: string | null
          clinic_id?: string
          complement?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string
          education?: string | null
          email?: string | null
          father_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          insurance_plan_id?: string | null
          is_company?: boolean | null
          is_foreigner?: boolean | null
          landline?: string | null
          marital_status?: string | null
          mother_name?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string
          preferred_channel?: string | null
          priority?: string | null
          profession?: string | null
          record_code?: number
          referral?: string | null
          religion?: string | null
          rg?: string | null
          send_notifications?: boolean | null
          skin_color?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          tag?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          clinic_id: string
          created_at: string | null
          description: string | null
          id: string
          installments: number
          patient_id: string | null
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          installments: number
          patient_id?: string | null
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          installments?: number
          patient_id?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_confirmations: {
        Row: {
          appointment_id: string
          clinic_id: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          sent_at: string
          status: string
        }
        Insert: {
          appointment_id: string
          clinic_id: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          sent_at?: string
          status?: string
        }
        Update: {
          appointment_id?: string
          clinic_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_confirmations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_confirmations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_definitions: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          key: string
          name: string
          order_index: number | null
          parent_key: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          name: string
          order_index?: number | null
          parent_key?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          name?: string
          order_index?: number | null
          parent_key?: string | null
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          created_at: string | null
          feature_id: string
          id: string
          plan_id: string
        }
        Insert: {
          created_at?: string | null
          feature_id: string
          id?: string
          plan_id: string
        }
        Update: {
          created_at?: string | null
          feature_id?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "system_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          clinic_id: string
          content: string
          created_at: string | null
          id: string
          is_signed: boolean | null
          medical_record_id: string | null
          patient_id: string
          professional_id: string | null
          signature_data: string | null
          signed_at: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          content: string
          created_at?: string | null
          id?: string
          is_signed?: boolean | null
          medical_record_id?: string | null
          patient_id: string
          professional_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_signed?: boolean | null
          medical_record_id?: string | null
          patient_id?: string
          professional_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_medical_record_id_fkey"
            columns: ["medical_record_id"]
            isOneToOne: false
            referencedRelation: "medical_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_insurance_prices: {
        Row: {
          created_at: string | null
          id: string
          insurance_plan_id: string
          price: number
          procedure_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          insurance_plan_id: string
          price: number
          procedure_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          insurance_plan_id?: string
          price?: number
          procedure_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procedure_insurance_prices_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_insurance_prices_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          category: string | null
          clinic_id: string
          color: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          clinic_id: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          clinic_id?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procedures_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_commissions: {
        Row: {
          amount: number
          appointment_id: string | null
          clinic_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          paid_date: string | null
          percentage: number | null
          professional_id: string
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          paid_date?: string | null
          percentage?: number | null
          professional_id: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          paid_date?: string | null
          percentage?: number | null
          professional_id?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_commissions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_commissions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_commissions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_commissions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_specialties: {
        Row: {
          created_at: string | null
          id: string
          professional_id: string
          specialty_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          professional_id: string
          specialty_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          professional_id?: string
          specialty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_specialties_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          address: string | null
          appointment_duration: number | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          clinic_id: string
          created_at: string
          education: string | null
          email: string | null
          experience: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          registration_number: string | null
          schedule: Json | null
          slug: string | null
          specialty: string | null
          state: string | null
          telemedicine_enabled: boolean | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          appointment_duration?: number | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          clinic_id: string
          created_at?: string
          education?: string | null
          email?: string | null
          experience?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          registration_number?: string | null
          schedule?: Json | null
          slug?: string | null
          specialty?: string | null
          state?: string | null
          telemedicine_enabled?: boolean | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          appointment_duration?: number | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          clinic_id?: string
          created_at?: string
          education?: string | null
          email?: string | null
          experience?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          registration_number?: string | null
          schedule?: Json | null
          slug?: string | null
          specialty?: string | null
          state?: string | null
          telemedicine_enabled?: boolean | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email_confirmed: boolean | null
          id: string
          name: string
          password_changed: boolean | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email_confirmed?: boolean | null
          id?: string
          name: string
          password_changed?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email_confirmed?: boolean | null
          id?: string
          name?: string
          password_changed?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      queue_calls: {
        Row: {
          appointment_id: string | null
          attended_at: string | null
          called_at: string | null
          checked_in_at: string
          clinic_id: string
          completed_at: string | null
          created_at: string
          id: string
          patient_id: string | null
          professional_id: string | null
          queue_id: string
          room_name: string | null
          service_time_seconds: number | null
          status: string
          ticket_number: number
          ticket_prefix: string | null
          wait_time_seconds: number | null
        }
        Insert: {
          appointment_id?: string | null
          attended_at?: string | null
          called_at?: string | null
          checked_in_at?: string
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          professional_id?: string | null
          queue_id: string
          room_name?: string | null
          service_time_seconds?: number | null
          status?: string
          ticket_number: number
          ticket_prefix?: string | null
          wait_time_seconds?: number | null
        }
        Update: {
          appointment_id?: string | null
          attended_at?: string | null
          called_at?: string | null
          checked_in_at?: string
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          professional_id?: string | null
          queue_id?: string
          room_name?: string | null
          service_time_seconds?: number | null
          status?: string
          ticket_number?: number
          ticket_prefix?: string | null
          wait_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_calls_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_calls_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_calls_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_calls_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_calls_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      queues: {
        Row: {
          clinic_id: string
          created_at: string
          current_ticket: number | null
          deleted_at: string | null
          display_mode: string
          id: string
          is_active: boolean
          name: string
          queue_type: string
          ticket_prefix: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          current_ticket?: number | null
          deleted_at?: string | null
          display_mode?: string
          id?: string
          is_active?: boolean
          name: string
          queue_type?: string
          ticket_prefix?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          current_ticket?: number | null
          deleted_at?: string | null
          display_mode?: string
          id?: string
          is_active?: boolean
          name?: string
          queue_type?: string
          ticket_prefix?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "queues_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string | null
          description: string | null
          discount: number | null
          id: string
          item_type: string
          name: string
          procedure_id: string | null
          product_id: string | null
          quantity: number
          quote_id: string
          sort_order: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount?: number | null
          id?: string
          item_type: string
          name: string
          procedure_id?: string | null
          product_id?: string | null
          quantity?: number
          quote_id: string
          sort_order?: number | null
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount?: number | null
          id?: string
          item_type?: string
          name?: string
          procedure_id?: string | null
          product_id?: string | null
          quantity?: number
          quote_id?: string
          sort_order?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          clinic_id: string
          converted_at: string | null
          created_at: string | null
          created_by: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          internal_notes: string | null
          notes: string | null
          patient_id: string
          professional_id: string | null
          quote_number: string
          rejected_at: string | null
          sent_at: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          approved_at?: string | null
          clinic_id: string
          converted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          patient_id: string
          professional_id?: string | null
          quote_number: string
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          approved_at?: string | null
          clinic_id?: string
          converted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          patient_id?: string
          professional_id?: string | null
          quote_number?: string
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          amount: number
          category_id: string | null
          clinic_id: string
          created_at: string
          day_of_month: number | null
          description: string
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          next_due_date: string
          start_date: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          clinic_id: string
          created_at?: string
          day_of_month?: number | null
          description: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          next_due_date: string
          start_date: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          clinic_id?: string
          created_at?: string
          day_of_month?: number | null
          description?: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          next_due_date?: string
          start_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_patients: {
        Row: {
          added_at: string
          id: string
          patient_id: string
          removed_at: string | null
          segment_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          patient_id: string
          removed_at?: string | null
          segment_id: string
        }
        Update: {
          added_at?: string
          id?: string
          patient_id?: string
          removed_at?: string | null
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_patients_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_patients_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "patient_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      smtp_settings: {
        Row: {
          created_at: string | null
          created_by: string | null
          encryption: string
          from_email: string
          from_name: string
          host: string
          id: string
          is_active: boolean
          password: string
          port: number
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          encryption?: string
          from_email: string
          from_name?: string
          host: string
          id?: string
          is_active?: boolean
          password: string
          port?: number
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          encryption?: string
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          is_active?: boolean
          password?: string
          port?: number
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      specialties: {
        Row: {
          category: Database["public"]["Enums"]["specialty_category"]
          created_at: string | null
          id: string
          is_active: boolean | null
          is_dental: boolean | null
          name: string
          registration_prefix: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["specialty_category"]
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_dental?: boolean | null
          name: string
          registration_prefix?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["specialty_category"]
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_dental?: boolean | null
          name?: string
          registration_prefix?: string | null
        }
        Relationships: []
      }
      state_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          is_recurring: boolean | null
          name: string
          recurring_day: number | null
          recurring_month: number | null
          state_code: string
          year: number
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          is_recurring?: boolean | null
          name: string
          recurring_day?: number | null
          recurring_month?: number | null
          state_code: string
          year: number
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          is_recurring?: boolean | null
          name?: string
          recurring_day?: number | null
          recurring_month?: number | null
          state_code?: string
          year?: number
        }
        Relationships: []
      }
      stock_alerts: {
        Row: {
          alert_type: string
          clinic_id: string
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          product_id: string
          resolved_at: string | null
        }
        Insert: {
          alert_type: string
          clinic_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          product_id: string
          resolved_at?: string | null
        }
        Update: {
          alert_type?: string
          clinic_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          product_id?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_categories: {
        Row: {
          clinic_id: string
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          new_stock: number
          notes: string | null
          previous_stock: number
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          supplier_id: string | null
          total_cost: number | null
          type: string
          unit_cost: number | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_stock: number
          notes?: string | null
          previous_stock: number
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          supplier_id?: string | null
          total_cost?: number | null
          type: string
          unit_cost?: number | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_stock?: number
          notes?: string | null
          previous_stock?: number
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          supplier_id?: string | null
          total_cost?: number | null
          type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_products: {
        Row: {
          batch_number: string | null
          category_id: string | null
          clinic_id: string
          cost_price: number | null
          created_at: string
          current_stock: number
          description: string | null
          expiry_date: string | null
          id: string
          is_active: boolean | null
          is_sellable: boolean | null
          location: string | null
          max_stock: number | null
          min_stock: number | null
          name: string
          sale_price: number | null
          service_duration_minutes: number | null
          sku: string | null
          supplier_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          category_id?: string | null
          clinic_id: string
          cost_price?: number | null
          created_at?: string
          current_stock?: number
          description?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          is_sellable?: boolean | null
          location?: string | null
          max_stock?: number | null
          min_stock?: number | null
          name: string
          sale_price?: number | null
          service_duration_minutes?: number | null
          sku?: string | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          category_id?: string | null
          clinic_id?: string
          cost_price?: number | null
          created_at?: string
          current_stock?: number
          description?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          is_sellable?: boolean | null
          location?: string | null
          max_stock?: number | null
          min_stock?: number | null
          name?: string
          sale_price?: number | null
          service_duration_minutes?: number | null
          sku?: string | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "stock_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_products_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          external_plan_id: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_default_trial: boolean | null
          is_public: boolean | null
          max_messages_monthly: number | null
          max_professionals: number
          monthly_price: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_plan_id?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_default_trial?: boolean | null
          is_public?: boolean | null
          max_messages_monthly?: number | null
          max_professionals?: number
          monthly_price?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_plan_id?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_default_trial?: boolean | null
          is_public?: boolean | null
          max_messages_monthly?: number | null
          max_professionals?: number
          monthly_price?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          clinic_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_subscription_id: string | null
          id: string
          plan_id: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          clinic_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_subscription_id?: string | null
          id?: string
          plan_id: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          clinic_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_subscription_id?: string | null
          id?: string
          plan_id?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          clinic_id: string
          cnpj: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          clinic_id: string
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          clinic_id?: string
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      system_features: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          key: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          name?: string
        }
        Relationships: []
      }
      system_notifications: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          message: string
          priority: string
          scheduled_at: string | null
          target_ids: string[] | null
          target_type: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          priority?: string
          scheduled_at?: string | null
          target_ids?: string[] | null
          target_type?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          priority?: string
          scheduled_at?: string | null
          target_ids?: string[] | null
          target_type?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      telemedicine_sessions: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          ended_at: string | null
          id: string
          patient_token: string
          professional_token: string
          room_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          patient_token?: string
          professional_token?: string
          room_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          patient_token?: string
          professional_token?: string
          room_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telemedicine_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      tiss_guide_items: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          execution_date: string | null
          gloss_code: string | null
          gloss_reason: string | null
          gloss_value: number | null
          guide_id: string
          id: string
          notes: string | null
          procedure_id: string | null
          professional_id: string | null
          quantity: number
          status: string
          total_value: number
          tuss_code: string
          tuss_description: string | null
          unit_value: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          execution_date?: string | null
          gloss_code?: string | null
          gloss_reason?: string | null
          gloss_value?: number | null
          guide_id: string
          id?: string
          notes?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          quantity?: number
          status?: string
          total_value?: number
          tuss_code: string
          tuss_description?: string | null
          unit_value?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          execution_date?: string | null
          gloss_code?: string | null
          gloss_reason?: string | null
          gloss_value?: number | null
          guide_id?: string
          id?: string
          notes?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          quantity?: number
          status?: string
          total_value?: number
          tuss_code?: string
          tuss_description?: string | null
          unit_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiss_guide_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guide_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guide_items_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "tiss_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guide_items_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guide_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      tiss_guides: {
        Row: {
          authorization_date: string | null
          authorization_number: string | null
          beneficiary_card: string | null
          beneficiary_name: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          execution_date: string | null
          gloss_value: number | null
          guide_number: string
          guide_type: string
          id: string
          insurance_plan_id: string
          main_guide_id: string | null
          notes: string | null
          paid_value: number | null
          patient_id: string
          provider_code: string | null
          returned_at: string | null
          sent_at: string | null
          status: string
          total_value: number | null
          updated_at: string
          xml_version: string | null
        }
        Insert: {
          authorization_date?: string | null
          authorization_number?: string | null
          beneficiary_card?: string | null
          beneficiary_name?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          execution_date?: string | null
          gloss_value?: number | null
          guide_number: string
          guide_type: string
          id?: string
          insurance_plan_id: string
          main_guide_id?: string | null
          notes?: string | null
          paid_value?: number | null
          patient_id: string
          provider_code?: string | null
          returned_at?: string | null
          sent_at?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
          xml_version?: string | null
        }
        Update: {
          authorization_date?: string | null
          authorization_number?: string | null
          beneficiary_card?: string | null
          beneficiary_name?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          execution_date?: string | null
          gloss_value?: number | null
          guide_number?: string
          guide_type?: string
          id?: string
          insurance_plan_id?: string
          main_guide_id?: string | null
          notes?: string | null
          paid_value?: number | null
          patient_id?: string
          provider_code?: string | null
          returned_at?: string | null
          sent_at?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
          xml_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiss_guides_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guides_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guides_main_guide_id_fkey"
            columns: ["main_guide_id"]
            isOneToOne: false
            referencedRelation: "tiss_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guides_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      tiss_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          guide_id: string
          id: string
          notes: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          guide_id: string
          id?: string
          notes?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          guide_id?: string
          id?: string
          notes?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiss_status_history_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "tiss_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      tiss_xml_files: {
        Row: {
          batch_id: string | null
          clinic_id: string
          created_at: string
          file_hash: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          file_type: string
          guide_id: string | null
          id: string
          processed_at: string | null
          protocol_number: string | null
          xml_content: string | null
        }
        Insert: {
          batch_id?: string | null
          clinic_id: string
          created_at?: string
          file_hash?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_type: string
          guide_id?: string | null
          id?: string
          processed_at?: string | null
          protocol_number?: string | null
          xml_content?: string | null
        }
        Update: {
          batch_id?: string | null
          clinic_id?: string
          created_at?: string
          file_hash?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string
          guide_id?: string | null
          id?: string
          processed_at?: string | null
          protocol_number?: string | null
          xml_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiss_xml_files_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_xml_files_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "tiss_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      totems: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          is_active: boolean
          last_heartbeat_at: string | null
          location: string | null
          name: string
          queue_id: string | null
          token: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_heartbeat_at?: string | null
          location?: string | null
          name: string
          queue_id?: string | null
          token?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_heartbeat_at?: string | null
          location?: string | null
          name?: string
          queue_id?: string | null
          token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "totems_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "totems_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_cost_centers: {
        Row: {
          account_id: string | null
          amount: number
          clinic_id: string
          cost_center_id: string
          created_at: string
          id: string
          percentage: number
          transaction_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          clinic_id: string
          cost_center_id: string
          created_at?: string
          id?: string
          percentage: number
          transaction_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          clinic_id?: string
          cost_center_id?: string
          created_at?: string
          id?: string
          percentage?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_cost_centers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_cost_centers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_cost_centers_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_cost_centers_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      tuss_codes: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          description: string
          id: string
          is_active: boolean
          table_type: string | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          description: string
          id?: string
          is_active?: boolean
          table_type?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          description?: string
          id?: string
          is_active?: boolean
          table_type?: string | null
        }
        Relationships: []
      }
      upgrade_requests: {
        Row: {
          admin_notes: string | null
          clinic_id: string
          created_at: string | null
          current_plan_id: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          requested_by: string | null
          requested_plan_id: string
          status: string
        }
        Insert: {
          admin_notes?: string | null
          clinic_id: string
          created_at?: string | null
          current_plan_id?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_by?: string | null
          requested_plan_id: string
          status?: string
        }
        Update: {
          admin_notes?: string | null
          clinic_id?: string
          created_at?: string | null
          current_plan_id?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_by?: string | null
          requested_plan_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "upgrade_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upgrade_requests_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upgrade_requests_requested_plan_id_fkey"
            columns: ["requested_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          access_group_id: string | null
          clinic_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          access_group_id?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          access_group_id?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_access_group_id_fkey"
            columns: ["access_group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      waiting_list: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          is_active: boolean | null
          notes: string | null
          notified_at: string | null
          patient_id: string
          preferred_dates: string[] | null
          preferred_times: string[] | null
          professional_id: string | null
          queue_id: string | null
          ticket_number: number | null
          ticket_prefix: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          notified_at?: string | null
          patient_id: string
          preferred_dates?: string[] | null
          preferred_times?: string[] | null
          professional_id?: string | null
          queue_id?: string | null
          ticket_number?: number | null
          ticket_prefix?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          notified_at?: string | null
          patient_id?: string
          preferred_dates?: string[] | null
          preferred_times?: string[] | null
          professional_id?: string | null
          queue_id?: string | null
          ticket_number?: number | null
          ticket_prefix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          delivered_at: string | null
          duration_ms: number | null
          error: string | null
          event: string
          id: string
          payload: Json | null
          response_body: string | null
          response_status: number | null
          webhook_id: string
        }
        Insert: {
          delivered_at?: string | null
          duration_ms?: number | null
          error?: string | null
          event: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          webhook_id: string
        }
        Update: {
          delivered_at?: string | null
          duration_ms?: number | null
          error?: string | null
          event?: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          clinic_id: string
          created_at: string | null
          created_by: string | null
          events: string[]
          id: string
          is_active: boolean | null
          name: string
          secret: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean | null
          name: string
          secret?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          events?: string[]
          id?: string
          is_active?: boolean | null
          name?: string
          secret?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_booking_sessions: {
        Row: {
          action_type: string | null
          available_dates: Json | null
          available_professionals: Json | null
          available_times: Json | null
          clinic_id: string
          created_at: string | null
          expires_at: string
          id: string
          patient_id: string | null
          patient_name: string | null
          pending_appointments: Json | null
          phone: string
          selected_appointment_id: string | null
          selected_date: string | null
          selected_procedure_id: string | null
          selected_professional_id: string | null
          selected_professional_name: string | null
          selected_time: string | null
          state: string
          updated_at: string | null
        }
        Insert: {
          action_type?: string | null
          available_dates?: Json | null
          available_professionals?: Json | null
          available_times?: Json | null
          clinic_id: string
          created_at?: string | null
          expires_at?: string
          id?: string
          patient_id?: string | null
          patient_name?: string | null
          pending_appointments?: Json | null
          phone: string
          selected_appointment_id?: string | null
          selected_date?: string | null
          selected_procedure_id?: string | null
          selected_professional_id?: string | null
          selected_professional_name?: string | null
          selected_time?: string | null
          state?: string
          updated_at?: string | null
        }
        Update: {
          action_type?: string | null
          available_dates?: Json | null
          available_professionals?: Json | null
          available_times?: Json | null
          clinic_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          patient_id?: string | null
          patient_name?: string | null
          pending_appointments?: Json | null
          phone?: string
          selected_appointment_id?: string | null
          selected_date?: string | null
          selected_procedure_id?: string | null
          selected_professional_id?: string | null
          selected_professional_name?: string | null
          selected_time?: string | null
          state?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_booking_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_booking_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_booking_sessions_selected_procedure_id_fkey"
            columns: ["selected_procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_booking_sessions_selected_professional_id_fkey"
            columns: ["selected_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_incoming_logs: {
        Row: {
          clinic_id: string | null
          created_at: string
          id: string
          message_text: string | null
          phone: string
          processed: boolean | null
          processed_action: string | null
          processed_appointment_id: string | null
          raw_payload: Json | null
          received_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          message_text?: string | null
          phone: string
          processed?: boolean | null
          processed_action?: string | null
          processed_appointment_id?: string | null
          raw_payload?: Json | null
          received_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          message_text?: string | null
          phone?: string
          processed?: boolean | null
          processed_action?: string | null
          processed_appointment_id?: string | null
          raw_payload?: Json | null
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_incoming_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_incoming_logs_processed_appointment_id_fkey"
            columns: ["processed_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_queue_ticket: {
        Args: { p_queue_id: string }
        Returns: {
          ticket_number: number
          ticket_prefix: string
        }[]
      }
      generate_quote_number: { Args: { p_clinic_id: string }; Returns: string }
      generate_tiss_guide_number: {
        Args: { p_clinic_id: string; p_guide_type: string }
        Returns: string
      }
      get_applicable_repass_rule: {
        Args: {
          p_clinic_id: string
          p_date?: string
          p_insurance_plan_id?: string
          p_procedure_id?: string
          p_professional_id: string
        }
        Returns: {
          calculation_type: string
          rule_id: string
          value: number
        }[]
      }
      get_available_permissions_for_clinic: {
        Args: { _clinic_id: string }
        Returns: {
          category: string
          feature_name: string
          permission_key: string
          permission_name: string
        }[]
      }
      get_clinic_message_usage: {
        Args: { _clinic_id: string; _month_year?: string }
        Returns: {
          max_allowed: number
          remaining: number
          used: number
        }[]
      }
      get_user_clinic_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_permissions: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: {
          permission_key: string
        }[]
      }
      has_clinic_access: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_clinic_admin: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_holiday: {
        Args: { p_clinic_id: string; p_date: string }
        Returns: {
          holiday_name: string
          holiday_type: string
          is_holiday: boolean
        }[]
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      user_has_permission: {
        Args: { _clinic_id: string; _permission_key: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "receptionist"
        | "professional"
        | "administrative"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
        | "in_progress"
        | "arrived"
      appointment_type:
        | "first_visit"
        | "return"
        | "exam"
        | "procedure"
        | "telemedicine"
      specialty_category:
        | "medical"
        | "dental"
        | "aesthetic"
        | "therapy"
        | "massage"
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
        "owner",
        "admin",
        "receptionist",
        "professional",
        "administrative",
      ],
      appointment_status: [
        "scheduled",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
        "in_progress",
        "arrived",
      ],
      appointment_type: [
        "first_visit",
        "return",
        "exam",
        "procedure",
        "telemedicine",
      ],
      specialty_category: [
        "medical",
        "dental",
        "aesthetic",
        "therapy",
        "massage",
      ],
    },
  },
} as const
