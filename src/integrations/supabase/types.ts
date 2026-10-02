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
          module_type: string | null
          name: string
          patient_swap_deadline_hours: number | null
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          module_type?: string | null
          name: string
          patient_swap_deadline_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          module_type?: string | null
          name?: string
          patient_swap_deadline_hours?: number | null
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
          {
            foreignKeyName: "access_groups_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_office_employers: {
        Row: {
          accounting_office_id: string
          created_at: string
          created_by: string | null
          employer_id: string
          id: string
        }
        Insert: {
          accounting_office_id: string
          created_at?: string
          created_by?: string | null
          employer_id: string
          id?: string
        }
        Update: {
          accounting_office_id?: string
          created_at?: string
          created_by?: string | null
          employer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_office_employers_accounting_office_id_fkey"
            columns: ["accounting_office_id"]
            isOneToOne: false
            referencedRelation: "accounting_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_office_employers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_office_portal_logs: {
        Row: {
          accounting_office_id: string
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          accounting_office_id: string
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          accounting_office_id?: string
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_office_portal_logs_accounting_office_id_fkey"
            columns: ["accounting_office_id"]
            isOneToOne: false
            referencedRelation: "accounting_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_offices: {
        Row: {
          access_code: string | null
          access_code_expires_at: string | null
          address: string | null
          city: string | null
          clinic_id: string
          cnpj: string | null
          contact_name: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          legacy_id: string | null
          name: string
          notes: string | null
          phone: string | null
          portal_last_access_at: string | null
          state: string | null
          trade_name: string | null
          union_entity_id: string | null
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          access_code_expires_at?: string | null
          address?: string | null
          city?: string | null
          clinic_id: string
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          legacy_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          portal_last_access_at?: string | null
          state?: string | null
          trade_name?: string | null
          union_entity_id?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          access_code_expires_at?: string | null
          address?: string | null
          city?: string | null
          clinic_id?: string
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          legacy_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          portal_last_access_at?: string | null
          state?: string | null
          trade_name?: string | null
          union_entity_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_offices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_offices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_offices_union_entity_id_fkey"
            columns: ["union_entity_id"]
            isOneToOne: false
            referencedRelation: "union_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_requests: {
        Row: {
          addon_id: string
          admin_notes: string | null
          clinic_id: string
          created_at: string | null
          id: string
          request_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          addon_id: string
          admin_notes?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          request_reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          addon_id?: string
          admin_notes?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          request_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addon_requests_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "subscription_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "anamnese_responses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "anamnese_responses_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
          {
            foreignKeyName: "anamnese_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "anamnesis_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "api_keys_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "api_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_slot_blocks: {
        Row: {
          block_date: string
          clinic_id: string
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          professional_id: string
          reason: string | null
          start_time: string
        }
        Insert: {
          block_date: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          professional_id: string
          reason?: string | null
          start_time: string
        }
        Update: {
          block_date?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          professional_id?: string
          reason?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_slot_blocks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slot_blocks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slot_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slot_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_sms_tokens: {
        Row: {
          action_ip: string | null
          appointment_id: string
          cancelled_at: string | null
          clinic_id: string
          confirmed_at: string | null
          created_at: string
          expires_at: string
          phone: string | null
          sent_at: string
          token: string
        }
        Insert: {
          action_ip?: string | null
          appointment_id: string
          cancelled_at?: string | null
          clinic_id: string
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          phone?: string | null
          sent_at?: string
          token: string
        }
        Update: {
          action_ip?: string | null
          appointment_id?: string
          cancelled_at?: string | null
          clinic_id?: string
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          phone?: string | null
          sent_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_sms_tokens_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
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
          dependent_id: string | null
          duration_minutes: number | null
          end_time: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          patient_id: string
          procedure_id: string | null
          professional_id: string
          recurrence_group_id: string | null
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
          dependent_id?: string | null
          duration_minutes?: number | null
          end_time: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          patient_id: string
          procedure_id?: string | null
          professional_id: string
          recurrence_group_id?: string | null
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
          dependent_id?: string | null
          duration_minutes?: number | null
          end_time?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          patient_id?: string
          procedure_id?: string | null
          professional_id?: string
          recurrence_group_id?: string | null
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
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "patient_dependents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "sindical_dependentes"
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
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
          {
            foreignKeyName: "automation_flows_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "birthday_message_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          image_url: string | null
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
          image_url?: string | null
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
          image_url?: string | null
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
            foreignKeyName: "campaigns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      card_expiry_notifications: {
        Row: {
          card_id: string
          created_at: string
          days_before_expiry: number | null
          error_message: string | null
          id: string
          notification_type: string
          sent_at: string
          success: boolean
        }
        Insert: {
          card_id: string
          created_at?: string
          days_before_expiry?: number | null
          error_message?: string | null
          id?: string
          notification_type: string
          sent_at?: string
          success?: boolean
        }
        Update: {
          card_id?: string
          created_at?: string
          days_before_expiry?: number | null
          error_message?: string | null
          id?: string
          notification_type?: string
          sent_at?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "card_expiry_notifications_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "patient_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_update_tokens: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          ip_address: string | null
          patient_id: string
          revoked_at: string | null
          token: string
          used_at: string | null
          user_agent: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          patient_id: string
          revoked_at?: string | null
          token: string
          used_at?: string | null
          user_agent?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          patient_id?: string
          revoked_at?: string | null
          token?: string
          used_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_update_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      carousel_banners: {
        Row: {
          background_color: string | null
          button_link: string | null
          button_text: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string
          is_active: boolean
          order_index: number
          overlay_opacity: number | null
          subtitle: string | null
          text_color: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          background_color?: string | null
          button_link?: string | null
          button_text?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          order_index?: number
          overlay_opacity?: number | null
          subtitle?: string | null
          text_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          background_color?: string | null
          button_link?: string | null
          button_text?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          order_index?: number
          overlay_opacity?: number | null
          subtitle?: string | null
          text_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cash_flow_history: {
        Row: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          cash_register_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          source: string
          type: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          cash_register_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          source: string
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          cash_register_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          source?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_history_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_register_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_flow_history_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_flow_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_flow_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "cash_registers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "cash_transfers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transfers_from_register_id_fkey"
            columns: ["from_register_id"]
            isOneToOne: false
            referencedRelation: "cash_register_balances"
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
            referencedRelation: "cash_register_balances"
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
            foreignKeyName: "chart_of_accounts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "chat_conversations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      chatgoo_events: {
        Row: {
          clinic_id: string | null
          created_at: string
          decision: string | null
          direction: string
          event: string
          id: string
          intent: string | null
          patient_id: string | null
          payload: Json
          phone: string | null
          reason: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          decision?: string | null
          direction: string
          event: string
          id?: string
          intent?: string | null
          patient_id?: string | null
          payload?: Json
          phone?: string | null
          reason?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          decision?: string | null
          direction?: string
          event?: string
          id?: string
          intent?: string | null
          patient_id?: string | null
          payload?: Json
          phone?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      chatwoot_configs: {
        Row: {
          chatwoot_account_id: string
          chatwoot_api_token_secret_name: string
          chatwoot_base_url: string
          chatwoot_inbox_id: string
          clinic_id: string
          connection_status: Database["public"]["Enums"]["chatwoot_connection_status"]
          created_at: string
          enabled: boolean
          id: string
          last_test_at: string | null
          last_test_status: string | null
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          chatwoot_account_id: string
          chatwoot_api_token_secret_name: string
          chatwoot_base_url: string
          chatwoot_inbox_id: string
          clinic_id: string
          connection_status?: Database["public"]["Enums"]["chatwoot_connection_status"]
          created_at?: string
          enabled?: boolean
          id?: string
          last_test_at?: string | null
          last_test_status?: string | null
          updated_at?: string
          webhook_secret?: string
        }
        Update: {
          chatwoot_account_id?: string
          chatwoot_api_token_secret_name?: string
          chatwoot_base_url?: string
          chatwoot_inbox_id?: string
          clinic_id?: string
          connection_status?: Database["public"]["Enums"]["chatwoot_connection_status"]
          created_at?: string
          enabled?: boolean
          id?: string
          last_test_at?: string | null
          last_test_status?: string | null
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatwoot_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatwoot_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_addons: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          addon_id: string
          clinic_id: string
          created_at: string | null
          id: string
          notes: string | null
          status: string
          suspended_at: string | null
          suspended_by: string | null
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          addon_id: string
          clinic_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          addon_id?: string
          clinic_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "subscription_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_addons_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_addons_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "clinic_holidays_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "clinic_notification_reads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          allow_multiple_sessions: boolean
          app_unavailable: boolean
          app_unavailable_at: string | null
          app_unavailable_by: string | null
          app_unavailable_message: string | null
          birthday_enabled: boolean | null
          birthday_message: string | null
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          booking_months_ahead: number | null
          city: string | null
          closing_time: string | null
          cnpj: string | null
          created_at: string
          custom_map_embed_url: string | null
          dependent_booking_limit: number | null
          dependent_booking_limit_enabled: boolean | null
          dependent_booking_period: string | null
          email: string | null
          enforce_schedule_validation: boolean | null
          entity_nomenclature: string | null
          hide_pending_before_date: string | null
          holidays_enabled: boolean | null
          id: string
          is_blocked: boolean | null
          is_maintenance: boolean | null
          logo_url: string | null
          maintenance_at: string | null
          maintenance_by: string | null
          maintenance_reason: string | null
          map_view_type: string | null
          max_appointments_per_cpf_month: number | null
          min_advance_booking_hours: number | null
          name: string
          opening_time: string | null
          owner_cpf: string | null
          owner_name: string | null
          patient_swap_deadline_hours: number | null
          payslip_acceptance_days: number | null
          phone: string | null
          reminder_enabled: boolean | null
          reminder_hours: number | null
          reminder_interval: number | null
          slug: string
          state_code: string | null
          titular_booking_limit_enabled: boolean | null
          updated_at: string
          use_ai_booking: boolean | null
          waiting_list_enabled: boolean
          waiting_list_offer_timeout_minutes: number
          whatsapp_header_image_url: string | null
          whatsapp_message_delay_seconds: number | null
          whatsapp_provider: string | null
        }
        Insert: {
          address?: string | null
          allow_multiple_sessions?: boolean
          app_unavailable?: boolean
          app_unavailable_at?: string | null
          app_unavailable_by?: string | null
          app_unavailable_message?: string | null
          birthday_enabled?: boolean | null
          birthday_message?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          booking_months_ahead?: number | null
          city?: string | null
          closing_time?: string | null
          cnpj?: string | null
          created_at?: string
          custom_map_embed_url?: string | null
          dependent_booking_limit?: number | null
          dependent_booking_limit_enabled?: boolean | null
          dependent_booking_period?: string | null
          email?: string | null
          enforce_schedule_validation?: boolean | null
          entity_nomenclature?: string | null
          hide_pending_before_date?: string | null
          holidays_enabled?: boolean | null
          id?: string
          is_blocked?: boolean | null
          is_maintenance?: boolean | null
          logo_url?: string | null
          maintenance_at?: string | null
          maintenance_by?: string | null
          maintenance_reason?: string | null
          map_view_type?: string | null
          max_appointments_per_cpf_month?: number | null
          min_advance_booking_hours?: number | null
          name: string
          opening_time?: string | null
          owner_cpf?: string | null
          owner_name?: string | null
          patient_swap_deadline_hours?: number | null
          payslip_acceptance_days?: number | null
          phone?: string | null
          reminder_enabled?: boolean | null
          reminder_hours?: number | null
          reminder_interval?: number | null
          slug: string
          state_code?: string | null
          titular_booking_limit_enabled?: boolean | null
          updated_at?: string
          use_ai_booking?: boolean | null
          waiting_list_enabled?: boolean
          waiting_list_offer_timeout_minutes?: number
          whatsapp_header_image_url?: string | null
          whatsapp_message_delay_seconds?: number | null
          whatsapp_provider?: string | null
        }
        Update: {
          address?: string | null
          allow_multiple_sessions?: boolean
          app_unavailable?: boolean
          app_unavailable_at?: string | null
          app_unavailable_by?: string | null
          app_unavailable_message?: string | null
          birthday_enabled?: boolean | null
          birthday_message?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          booking_months_ahead?: number | null
          city?: string | null
          closing_time?: string | null
          cnpj?: string | null
          created_at?: string
          custom_map_embed_url?: string | null
          dependent_booking_limit?: number | null
          dependent_booking_limit_enabled?: boolean | null
          dependent_booking_period?: string | null
          email?: string | null
          enforce_schedule_validation?: boolean | null
          entity_nomenclature?: string | null
          hide_pending_before_date?: string | null
          holidays_enabled?: boolean | null
          id?: string
          is_blocked?: boolean | null
          is_maintenance?: boolean | null
          logo_url?: string | null
          maintenance_at?: string | null
          maintenance_by?: string | null
          maintenance_reason?: string | null
          map_view_type?: string | null
          max_appointments_per_cpf_month?: number | null
          min_advance_booking_hours?: number | null
          name?: string
          opening_time?: string | null
          owner_cpf?: string | null
          owner_name?: string | null
          patient_swap_deadline_hours?: number | null
          payslip_acceptance_days?: number | null
          phone?: string | null
          reminder_enabled?: boolean | null
          reminder_hours?: number | null
          reminder_interval?: number | null
          slug?: string
          state_code?: string | null
          titular_booking_limit_enabled?: boolean | null
          updated_at?: string
          use_ai_booking?: boolean | null
          waiting_list_enabled?: boolean
          waiting_list_offer_timeout_minutes?: number
          whatsapp_header_image_url?: string | null
          whatsapp_message_delay_seconds?: number | null
          whatsapp_provider?: string | null
        }
        Relationships: []
      }
      contact_preferences: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          interaction_score: number
          last_inbound_at: string | null
          last_interaction_at: string | null
          last_template_name: string | null
          last_template_sent_at: string | null
          notes: string | null
          optout_categories: string[]
          phone: string
          updated_at: string
          whatsapp_optin: boolean
          whatsapp_optin_at: string | null
          whatsapp_optin_source: string | null
          whatsapp_optout: boolean
          whatsapp_optout_at: string | null
          whatsapp_optout_source: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          interaction_score?: number
          last_inbound_at?: string | null
          last_interaction_at?: string | null
          last_template_name?: string | null
          last_template_sent_at?: string | null
          notes?: string | null
          optout_categories?: string[]
          phone: string
          updated_at?: string
          whatsapp_optin?: boolean
          whatsapp_optin_at?: string | null
          whatsapp_optin_source?: string | null
          whatsapp_optout?: boolean
          whatsapp_optout_at?: string | null
          whatsapp_optout_source?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          interaction_score?: number
          last_inbound_at?: string | null
          last_interaction_at?: string | null
          last_template_name?: string | null
          last_template_sent_at?: string | null
          notes?: string | null
          optout_categories?: string[]
          phone?: string
          updated_at?: string
          whatsapp_optin?: boolean
          whatsapp_optin_at?: string | null
          whatsapp_optin_source?: string | null
          whatsapp_optout?: boolean
          whatsapp_optout_at?: string | null
          whatsapp_optout_source?: string | null
        }
        Relationships: []
      }
      contribution_audit_logs: {
        Row: {
          action: string
          clinic_id: string
          contribution_id: string
          id: string
          ip_address: string | null
          new_data: Json | null
          new_status: string | null
          new_value: number | null
          notes: string | null
          performed_at: string
          performed_by: string | null
          previous_data: Json | null
          previous_status: string | null
          previous_value: number | null
          user_agent: string | null
        }
        Insert: {
          action: string
          clinic_id: string
          contribution_id: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          new_status?: string | null
          new_value?: number | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_data?: Json | null
          previous_status?: string | null
          previous_value?: number | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          clinic_id?: string
          contribution_id?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          new_status?: string | null
          new_value?: number | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_data?: Json | null
          previous_status?: string | null
          previous_value?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contribution_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_audit_logs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "employer_contributions"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_reissue_requests: {
        Row: {
          admin_notes: string | null
          contribution_id: string | null
          created_at: string | null
          employer_id: string | null
          id: string
          new_due_date: string | null
          new_lytex_url: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          contribution_id?: string | null
          created_at?: string | null
          employer_id?: string | null
          id?: string
          new_due_date?: string | null
          new_lytex_url?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          contribution_id?: string | null
          created_at?: string | null
          employer_id?: string | null
          id?: string
          new_due_date?: string | null
          new_lytex_url?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contribution_reissue_requests_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "employer_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_reissue_requests_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_types: {
        Row: {
          clinic_id: string
          created_at: string
          default_value: number
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          default_value?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          default_value?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_types_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_types_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_worker_list_validations: {
        Row: {
          ai_result: Json | null
          clinic_id: string | null
          competence_month: number | null
          competence_year: number | null
          confidence: number | null
          contribution_id: string
          contribution_type_id: string | null
          created_at: string
          employer_id: string
          extracted_data: Json | null
          file_name: string | null
          file_path: string
          id: string
          inconsistencies: Json | null
          mime_type: string | null
          portal_id: string
          portal_type: string
          reason: string | null
          status: string
          used_at: string | null
        }
        Insert: {
          ai_result?: Json | null
          clinic_id?: string | null
          competence_month?: number | null
          competence_year?: number | null
          confidence?: number | null
          contribution_id: string
          contribution_type_id?: string | null
          created_at?: string
          employer_id: string
          extracted_data?: Json | null
          file_name?: string | null
          file_path: string
          id?: string
          inconsistencies?: Json | null
          mime_type?: string | null
          portal_id: string
          portal_type: string
          reason?: string | null
          status: string
          used_at?: string | null
        }
        Update: {
          ai_result?: Json | null
          clinic_id?: string | null
          competence_month?: number | null
          competence_year?: number | null
          confidence?: number | null
          contribution_id?: string
          contribution_type_id?: string | null
          created_at?: string
          employer_id?: string
          extracted_data?: Json | null
          file_name?: string | null
          file_path?: string
          id?: string
          inconsistencies?: Json | null
          mime_type?: string | null
          portal_id?: string
          portal_type?: string
          reason?: string | null
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contribution_worker_list_validations_contribution_type_id_fkey"
            columns: ["contribution_type_id"]
            isOneToOne: false
            referencedRelation: "contribution_types"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "cost_centers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      debt_negotiations: {
        Row: {
          applied_correction_rate: number
          applied_interest_rate: number
          applied_late_fee_rate: number
          approval_method: string | null
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          down_payment_due_date: string | null
          down_payment_value: number | null
          employer_id: string
          finalized_at: string | null
          finalized_by: string | null
          first_due_date: string
          id: string
          installment_value: number
          installments_count: number
          negotiation_code: string
          status: string
          total_interest: number
          total_late_fee: number
          total_monetary_correction: number
          total_negotiated_value: number
          total_original_value: number
          updated_at: string
          validity_expires_at: string | null
        }
        Insert: {
          applied_correction_rate: number
          applied_interest_rate: number
          applied_late_fee_rate: number
          approval_method?: string | null
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          down_payment_due_date?: string | null
          down_payment_value?: number | null
          employer_id: string
          finalized_at?: string | null
          finalized_by?: string | null
          first_due_date: string
          id?: string
          installment_value: number
          installments_count: number
          negotiation_code: string
          status?: string
          total_interest?: number
          total_late_fee?: number
          total_monetary_correction?: number
          total_negotiated_value: number
          total_original_value: number
          updated_at?: string
          validity_expires_at?: string | null
        }
        Update: {
          applied_correction_rate?: number
          applied_interest_rate?: number
          applied_late_fee_rate?: number
          approval_method?: string | null
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          down_payment_due_date?: string | null
          down_payment_value?: number | null
          employer_id?: string
          finalized_at?: string | null
          finalized_by?: string | null
          first_due_date?: string
          id?: string
          installment_value?: number
          installments_count?: number
          negotiation_code?: string
          status?: string
          total_interest?: number
          total_late_fee?: number
          total_monetary_correction?: number
          total_negotiated_value?: number
          total_original_value?: number
          updated_at?: string
          validity_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_negotiations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_negotiations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_negotiations_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
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
          paper_size: string | null
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
          paper_size?: string | null
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
          paper_size?: string | null
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
          {
            foreignKeyName: "document_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          error_message: string | null
          id: string
          recipient_email: string
          recipient_id: string | null
          recipient_name: string | null
          recipient_type: string
          sent_at: string | null
          status: string
          variables: Json
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_type: string
          sent_at?: string | null
          status?: string
          variables?: Json
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_type?: string
          sent_at?: string | null
          status?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          body_html: string
          body_text: string | null
          clinic_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          failed_count: number
          filters: Json
          id: string
          name: string
          scheduled_at: string | null
          sent_count: number
          skipped_count: number
          started_at: string | null
          status: string
          subject: string
          target_type: string
          total_recipients: number
          union_entity_id: string | null
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          failed_count?: number
          filters?: Json
          id?: string
          name: string
          scheduled_at?: string | null
          sent_count?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          subject: string
          target_type: string
          total_recipients?: number
          union_entity_id?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          failed_count?: number
          filters?: Json
          id?: string
          name?: string
          scheduled_at?: string | null
          sent_count?: number
          skipped_count?: number
          started_at?: string | null
          status?: string
          subject?: string
          target_type?: string
          total_recipients?: number
          union_entity_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
      email_inbox_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          campaign_id: string | null
          cc_email: string | null
          created_at: string
          email_references: string | null
          folder: string
          from_email: string
          from_name: string | null
          has_attachments: boolean
          id: string
          imap_uid: number | null
          in_reply_to: string | null
          is_read: boolean
          is_starred: boolean
          message_id: string | null
          raw_headers: Json | null
          received_at: string
          size_bytes: number | null
          snippet: string | null
          subject: string | null
          thread_key: string | null
          to_email: string | null
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          campaign_id?: string | null
          cc_email?: string | null
          created_at?: string
          email_references?: string | null
          folder?: string
          from_email: string
          from_name?: string | null
          has_attachments?: boolean
          id?: string
          imap_uid?: number | null
          in_reply_to?: string | null
          is_read?: boolean
          is_starred?: boolean
          message_id?: string | null
          raw_headers?: Json | null
          received_at: string
          size_bytes?: number | null
          snippet?: string | null
          subject?: string | null
          thread_key?: string | null
          to_email?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          campaign_id?: string | null
          cc_email?: string | null
          created_at?: string
          email_references?: string | null
          folder?: string
          from_email?: string
          from_name?: string | null
          has_attachments?: boolean
          id?: string
          imap_uid?: number | null
          in_reply_to?: string | null
          is_read?: boolean
          is_starred?: boolean
          message_id?: string | null
          raw_headers?: Json | null
          received_at?: string
          size_bytes?: number | null
          snippet?: string | null
          subject?: string | null
          thread_key?: string | null
          to_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_inbox_state: {
        Row: {
          id: number
          last_error: string | null
          last_run_at: string | null
          last_uid: number
          updated_at: string
        }
        Insert: {
          id?: number
          last_error?: string | null
          last_run_at?: string | null
          last_uid?: number
          updated_at?: string
        }
        Update: {
          id?: number
          last_error?: string | null
          last_run_at?: string | null
          last_uid?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          clinic_id: string
          email: string
          id: string
          reason: string | null
          source_campaign_id: string | null
          unsubscribed_at: string
        }
        Insert: {
          clinic_id: string
          email: string
          id?: string
          reason?: string | null
          source_campaign_id?: string | null
          unsubscribed_at?: string
        }
        Update: {
          clinic_id?: string
          email?: string
          id?: string
          reason?: string | null
          source_campaign_id?: string | null
          unsubscribed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_unsubscribes_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_categories: {
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
            foreignKeyName: "employer_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_contributions: {
        Row: {
          active_competence_key: string | null
          cash_register_id: string | null
          clinic_id: string
          competence_month: number
          competence_year: number
          contribution_type_id: string
          created_at: string
          created_by: string | null
          divergence_details: Json | null
          due_date: string
          employer_id: string
          financial_category_id: string | null
          has_divergence: boolean | null
          id: string
          imported_at: string | null
          is_editable: boolean | null
          is_negotiated_debt: boolean | null
          is_reconciled: boolean | null
          last_lytex_sync_at: string | null
          lytex_boleto_barcode: string | null
          lytex_boleto_digitable_line: string | null
          lytex_fee_amount: number | null
          lytex_fee_details: Json | null
          lytex_invoice_id: string | null
          lytex_invoice_url: string | null
          lytex_original_status: string | null
          lytex_pix_code: string | null
          lytex_pix_qrcode: string | null
          lytex_raw_data: Json | null
          lytex_transaction_id: string | null
          member_id: string | null
          negotiation_id: string | null
          net_value: number | null
          notes: string | null
          origin: string | null
          paid_at: string | null
          paid_value: number | null
          payment_method: string | null
          portal_due_date_change_count: number
          portal_reissue_count: number
          portal_value_change_count: number
          public_access_token: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_notes: string | null
          status: string
          union_entity_id: string | null
          updated_at: string
          value: number
        }
        Insert: {
          active_competence_key?: string | null
          cash_register_id?: string | null
          clinic_id: string
          competence_month: number
          competence_year: number
          contribution_type_id: string
          created_at?: string
          created_by?: string | null
          divergence_details?: Json | null
          due_date: string
          employer_id: string
          financial_category_id?: string | null
          has_divergence?: boolean | null
          id?: string
          imported_at?: string | null
          is_editable?: boolean | null
          is_negotiated_debt?: boolean | null
          is_reconciled?: boolean | null
          last_lytex_sync_at?: string | null
          lytex_boleto_barcode?: string | null
          lytex_boleto_digitable_line?: string | null
          lytex_fee_amount?: number | null
          lytex_fee_details?: Json | null
          lytex_invoice_id?: string | null
          lytex_invoice_url?: string | null
          lytex_original_status?: string | null
          lytex_pix_code?: string | null
          lytex_pix_qrcode?: string | null
          lytex_raw_data?: Json | null
          lytex_transaction_id?: string | null
          member_id?: string | null
          negotiation_id?: string | null
          net_value?: number | null
          notes?: string | null
          origin?: string | null
          paid_at?: string | null
          paid_value?: number | null
          payment_method?: string | null
          portal_due_date_change_count?: number
          portal_reissue_count?: number
          portal_value_change_count?: number
          public_access_token?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_notes?: string | null
          status?: string
          union_entity_id?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          active_competence_key?: string | null
          cash_register_id?: string | null
          clinic_id?: string
          competence_month?: number
          competence_year?: number
          contribution_type_id?: string
          created_at?: string
          created_by?: string | null
          divergence_details?: Json | null
          due_date?: string
          employer_id?: string
          financial_category_id?: string | null
          has_divergence?: boolean | null
          id?: string
          imported_at?: string | null
          is_editable?: boolean | null
          is_negotiated_debt?: boolean | null
          is_reconciled?: boolean | null
          last_lytex_sync_at?: string | null
          lytex_boleto_barcode?: string | null
          lytex_boleto_digitable_line?: string | null
          lytex_fee_amount?: number | null
          lytex_fee_details?: Json | null
          lytex_invoice_id?: string | null
          lytex_invoice_url?: string | null
          lytex_original_status?: string | null
          lytex_pix_code?: string | null
          lytex_pix_qrcode?: string | null
          lytex_raw_data?: Json | null
          lytex_transaction_id?: string | null
          member_id?: string | null
          negotiation_id?: string | null
          net_value?: number | null
          notes?: string | null
          origin?: string | null
          paid_at?: string | null
          paid_value?: number | null
          payment_method?: string | null
          portal_due_date_change_count?: number
          portal_reissue_count?: number
          portal_value_change_count?: number
          public_access_token?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_notes?: string | null
          status?: string
          union_entity_id?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "employer_contributions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_contributions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_contributions_contribution_type_id_fkey"
            columns: ["contribution_type_id"]
            isOneToOne: false
            referencedRelation: "contribution_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_contributions_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_contributions_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "debt_negotiations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_contributions_union_entity_id_fkey"
            columns: ["union_entity_id"]
            isOneToOne: false
            referencedRelation: "union_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_portal_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          employer_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          employer_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          employer_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_portal_logs_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_worker_roster_items: {
        Row: {
          clinic_id: string | null
          competence_month: number | null
          competence_year: number | null
          contribution_id: string
          contribution_type_id: string | null
          created_at: string
          employer_id: string
          id: string
          origin: string
          worker_id: string
        }
        Insert: {
          clinic_id?: string | null
          competence_month?: number | null
          competence_year?: number | null
          contribution_id: string
          contribution_type_id?: string | null
          created_at?: string
          employer_id: string
          id?: string
          origin?: string
          worker_id: string
        }
        Update: {
          clinic_id?: string | null
          competence_month?: number | null
          competence_year?: number | null
          contribution_id?: string
          contribution_type_id?: string | null
          created_at?: string
          employer_id?: string
          id?: string
          origin?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_worker_roster_items_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_worker_roster_items_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "employer_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_workers: {
        Row: {
          active: boolean
          clinic_id: string | null
          contribution_type_id: string | null
          cpf: string | null
          created_at: string
          employer_id: string
          id: string
          inactive_at: string | null
          inactive_note: string | null
          inactive_reason: string | null
          name: string
          name_norm: string
        }
        Insert: {
          active?: boolean
          clinic_id?: string | null
          contribution_type_id?: string | null
          cpf?: string | null
          created_at?: string
          employer_id: string
          id?: string
          inactive_at?: string | null
          inactive_note?: string | null
          inactive_reason?: string | null
          name: string
          name_norm: string
        }
        Update: {
          active?: boolean
          clinic_id?: string | null
          contribution_type_id?: string | null
          cpf?: string | null
          created_at?: string
          employer_id?: string
          id?: string
          inactive_at?: string | null
          inactive_note?: string | null
          inactive_reason?: string | null
          name?: string
          name_norm?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_workers_contribution_type_id_fkey"
            columns: ["contribution_type_id"]
            isOneToOne: false
            referencedRelation: "contribution_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_workers_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      employers: {
        Row: {
          access_code: string | null
          access_code_expires_at: string | null
          address: string | null
          category_id: string | null
          cep: string | null
          city: string | null
          clinic_id: string
          cnae_code: string | null
          cnae_description: string | null
          cnpj: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          lytex_client_id: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          phone: string | null
          portal_last_access_at: string | null
          registration_number: string | null
          state: string | null
          trade_name: string | null
          union_entity_id: string | null
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          access_code_expires_at?: string | null
          address?: string | null
          category_id?: string | null
          cep?: string | null
          city?: string | null
          clinic_id: string
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lytex_client_id?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          portal_last_access_at?: string | null
          registration_number?: string | null
          state?: string | null
          trade_name?: string | null
          union_entity_id?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          access_code_expires_at?: string | null
          address?: string | null
          category_id?: string | null
          cep?: string | null
          city?: string | null
          clinic_id?: string
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lytex_client_id?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          portal_last_access_at?: string | null
          registration_number?: string | null
          state?: string | null
          trade_name?: string | null
          union_entity_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "employer_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_union_entity_id_fkey"
            columns: ["union_entity_id"]
            isOneToOne: false
            referencedRelation: "union_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_configs: {
        Row: {
          api_key: string
          api_url: string
          booking_enabled: boolean | null
          clinic_id: string
          connected_at: string | null
          created_at: string
          direct_reply_enabled: boolean | null
          external_webhook_url: string | null
          id: string
          instance_id: string | null
          instance_name: string
          is_connected: boolean | null
          phone_number: string | null
          qr_code: string | null
          updated_at: string
          webhook_url: string | null
          zapi_token: string | null
        }
        Insert: {
          api_key: string
          api_url: string
          booking_enabled?: boolean | null
          clinic_id: string
          connected_at?: string | null
          created_at?: string
          direct_reply_enabled?: boolean | null
          external_webhook_url?: string | null
          id?: string
          instance_id?: string | null
          instance_name: string
          is_connected?: boolean | null
          phone_number?: string | null
          qr_code?: string | null
          updated_at?: string
          webhook_url?: string | null
          zapi_token?: string | null
        }
        Update: {
          api_key?: string
          api_url?: string
          booking_enabled?: boolean | null
          clinic_id?: string
          connected_at?: string | null
          created_at?: string
          direct_reply_enabled?: boolean | null
          external_webhook_url?: string | null
          id?: string
          instance_id?: string | null
          instance_name?: string
          is_connected?: boolean | null
          phone_number?: string | null
          qr_code?: string | null
          updated_at?: string
          webhook_url?: string | null
          zapi_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolution_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolution_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          notification_sent: boolean | null
          notification_sent_at: string | null
          patient_id: string
          professional_id: string | null
          title: string
          viewed_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          patient_id: string
          professional_id?: string | null
          title: string
          viewed_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          patient_id?: string
          professional_id?: string | null
          title?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          category: string
          clinic_id: string | null
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_global: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          clinic_id?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          clinic_id?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_liquidation_history: {
        Row: {
          cash_register_id: string | null
          check_number: string
          clinic_id: string
          created_at: string
          id: string
          liquidated_by: string
          liquidation_date: string
          notes: string | null
          total_value: number
          transaction_ids: string[]
        }
        Insert: {
          cash_register_id?: string | null
          check_number: string
          clinic_id: string
          created_at?: string
          id?: string
          liquidated_by: string
          liquidation_date: string
          notes?: string | null
          total_value: number
          transaction_ids: string[]
        }
        Update: {
          cash_register_id?: string | null
          check_number?: string
          clinic_id?: string
          created_at?: string
          id?: string
          liquidated_by?: string
          liquidation_date?: string
          notes?: string | null
          total_value?: number
          transaction_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "expense_liquidation_history_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_register_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_liquidation_history_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_liquidation_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_liquidation_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      financial_audit_logs: {
        Row: {
          action: string
          amount_after: number | null
          amount_before: number | null
          clinic_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          notes: string | null
          old_data: Json | null
          user_agent: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          action: string
          amount_after?: number | null
          amount_before?: number | null
          clinic_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          user_agent?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          amount_after?: number | null
          amount_before?: number | null
          clinic_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "financial_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          check_number: string | null
          clinic_id: string
          conciliated_at: string | null
          conciliated_by: string | null
          cost_center_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          discount_value: number | null
          document_number: string | null
          document_type: string | null
          due_date: string | null
          fine_value: number | null
          gross_value: number | null
          id: string
          interest_value: number | null
          is_conciliated: boolean | null
          is_reconciled: boolean | null
          liquidated_by: string | null
          liquidation_date: string | null
          net_value: number | null
          notes: string | null
          other_values: number | null
          paid_date: string | null
          patient_id: string | null
          payment_method: string | null
          procedure_id: string | null
          professional_id: string | null
          reconciled_at: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string | null
          supplier_id: string | null
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
          check_number?: string | null
          clinic_id: string
          conciliated_at?: string | null
          conciliated_by?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          discount_value?: number | null
          document_number?: string | null
          document_type?: string | null
          due_date?: string | null
          fine_value?: number | null
          gross_value?: number | null
          id?: string
          interest_value?: number | null
          is_conciliated?: boolean | null
          is_reconciled?: boolean | null
          liquidated_by?: string | null
          liquidation_date?: string | null
          net_value?: number | null
          notes?: string | null
          other_values?: number | null
          paid_date?: string | null
          patient_id?: string | null
          payment_method?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          reconciled_at?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string | null
          supplier_id?: string | null
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
          check_number?: string | null
          clinic_id?: string
          conciliated_at?: string | null
          conciliated_by?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          discount_value?: number | null
          document_number?: string | null
          document_type?: string | null
          due_date?: string | null
          fine_value?: number | null
          gross_value?: number | null
          id?: string
          interest_value?: number | null
          is_conciliated?: boolean | null
          is_reconciled?: boolean | null
          liquidated_by?: string | null
          liquidation_date?: string | null
          net_value?: number | null
          notes?: string | null
          other_values?: number | null
          paid_date?: string | null
          patient_id?: string | null
          payment_method?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          reconciled_at?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string | null
          supplier_id?: string | null
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
            referencedRelation: "cash_register_balances"
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
            foreignKeyName: "financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
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
          {
            foreignKeyName: "financial_transactions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      first_access_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          patient_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          patient_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          patient_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "first_access_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      global_config: {
        Row: {
          created_at: string
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_instance: string | null
          id: string
          meta_api_active: string
          trial_signup_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance?: string | null
          id?: string
          meta_api_active?: string
          trial_signup_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance?: string | null
          id?: string
          meta_api_active?: string
          trial_signup_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
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
      homologacao_appointments: {
        Row: {
          appointment_date: string
          cancellation_reason: string | null
          cancelled_at: string | null
          clinic_id: string
          company_cnpj: string | null
          company_contact_name: string | null
          company_email: string | null
          company_name: string
          company_phone: string
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          employee_cpf: string | null
          employee_name: string
          employee_phone: string | null
          employee_prior_notice_date: string | null
          end_time: string
          id: string
          notes: string | null
          notification_sent_at: string | null
          notification_status: string | null
          professional_id: string | null
          protocol_number: string | null
          reminder_sent_at: string | null
          service_type_id: string | null
          start_time: string
          status: string
          updated_at: string | null
        }
        Insert: {
          appointment_date: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          clinic_id: string
          company_cnpj?: string | null
          company_contact_name?: string | null
          company_email?: string | null
          company_name: string
          company_phone: string
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_cpf?: string | null
          employee_name: string
          employee_phone?: string | null
          employee_prior_notice_date?: string | null
          end_time: string
          id?: string
          notes?: string | null
          notification_sent_at?: string | null
          notification_status?: string | null
          professional_id?: string | null
          protocol_number?: string | null
          reminder_sent_at?: string | null
          service_type_id?: string | null
          start_time: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          clinic_id?: string
          company_cnpj?: string | null
          company_contact_name?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_cpf?: string | null
          employee_name?: string
          employee_phone?: string | null
          employee_prior_notice_date?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          notification_sent_at?: string | null
          notification_status?: string | null
          professional_id?: string | null
          protocol_number?: string | null
          reminder_sent_at?: string | null
          service_type_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homologacao_appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "homologacao_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_appointments_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "homologacao_service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      homologacao_blocks: {
        Row: {
          block_date: string
          block_type: string
          clinic_id: string
          created_at: string | null
          created_by: string | null
          end_time: string | null
          id: string
          professional_id: string | null
          reason: string | null
          start_time: string | null
        }
        Insert: {
          block_date: string
          block_type?: string
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          end_time?: string | null
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          block_date?: string
          block_type?: string
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          end_time?: string | null
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homologacao_blocks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_blocks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "homologacao_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      homologacao_notification_logs: {
        Row: {
          appointment_id: string | null
          channel: string
          clinic_id: string
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          message: string | null
          protocol_sent: boolean | null
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          appointment_id?: string | null
          channel: string
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          message?: string | null
          protocol_sent?: boolean | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string | null
          channel?: string
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          message?: string | null
          protocol_sent?: boolean | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "homologacao_notification_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "homologacao_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_notification_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "homologacao_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_notification_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_notification_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      homologacao_notifications: {
        Row: {
          appointment_id: string
          clinic_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message: string | null
          protocol_sent: boolean | null
          recipient_phone: string
          recipient_type: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          appointment_id: string
          clinic_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string | null
          protocol_sent?: boolean | null
          recipient_phone: string
          recipient_type: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          appointment_id?: string
          clinic_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string | null
          protocol_sent?: boolean | null
          recipient_phone?: string
          recipient_type?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homologacao_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "homologacao_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "homologacao_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      homologacao_professional_services: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          id: string
          professional_id: string
          service_type_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          professional_id: string
          service_type_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          professional_id?: string
          service_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homologacao_professional_services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_professional_services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "homologacao_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_professional_services_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "homologacao_service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      homologacao_professionals: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          clinic_id: string
          created_at: string | null
          description: string | null
          email: string | null
          function: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          manager_phone: string | null
          name: string
          phone: string | null
          public_booking_enabled: boolean | null
          slug: string | null
          state_code: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          clinic_id: string
          created_at?: string | null
          description?: string | null
          email?: string | null
          function?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_phone?: string | null
          name: string
          phone?: string | null
          public_booking_enabled?: boolean | null
          slug?: string | null
          state_code?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          email?: string | null
          function?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_phone?: string | null
          name?: string
          phone?: string | null
          public_booking_enabled?: boolean | null
          slug?: string | null
          state_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homologacao_professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      homologacao_schedules: {
        Row: {
          capacity: number | null
          clinic_id: string | null
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          professional_id: string
          start_time: string
        }
        Insert: {
          capacity?: number | null
          clinic_id?: string | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          professional_id: string
          start_time: string
        }
        Update: {
          capacity?: number | null
          clinic_id?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          professional_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "homologacao_schedules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_schedules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_schedules_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "homologacao_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      homologacao_service_types: {
        Row: {
          clinic_id: string
          created_at: string | null
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "homologacao_service_types_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_service_types_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      homologacao_settings: {
        Row: {
          allow_cancellation: boolean | null
          cancellation_deadline_hours: number | null
          clinic_id: string
          created_at: string | null
          display_name: string | null
          id: string
          institutional_text: string | null
          logo_url: string | null
          manager_whatsapp: string | null
          public_whatsapp: string | null
          require_confirmation: boolean | null
          updated_at: string | null
        }
        Insert: {
          allow_cancellation?: boolean | null
          cancellation_deadline_hours?: number | null
          clinic_id: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          institutional_text?: string | null
          logo_url?: string | null
          manager_whatsapp?: string | null
          public_whatsapp?: string | null
          require_confirmation?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allow_cancellation?: boolean | null
          cancellation_deadline_hours?: number | null
          clinic_id?: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          institutional_text?: string | null
          logo_url?: string | null
          manager_whatsapp?: string | null
          public_whatsapp?: string | null
          require_confirmation?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homologacao_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "import_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_plans: {
        Row: {
          clinic_id: string
          code: string | null
          color: string | null
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
          color?: string | null
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
          color?: string | null
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
          {
            foreignKeyName: "insurance_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      lytex_conciliation_logs: {
        Row: {
          clinic_id: string
          conciliation_reason: string | null
          conciliation_result: string
          contribution_id: string | null
          created_at: string
          id: string
          lytex_fee_amount: number | null
          lytex_invoice_id: string
          lytex_net_value: number | null
          lytex_paid_at: string | null
          lytex_paid_value: number | null
          lytex_payment_method: string | null
          lytex_transaction_id: string | null
          new_status: string | null
          previous_status: string | null
          raw_lytex_data: Json | null
          sync_log_id: string | null
        }
        Insert: {
          clinic_id: string
          conciliation_reason?: string | null
          conciliation_result: string
          contribution_id?: string | null
          created_at?: string
          id?: string
          lytex_fee_amount?: number | null
          lytex_invoice_id: string
          lytex_net_value?: number | null
          lytex_paid_at?: string | null
          lytex_paid_value?: number | null
          lytex_payment_method?: string | null
          lytex_transaction_id?: string | null
          new_status?: string | null
          previous_status?: string | null
          raw_lytex_data?: Json | null
          sync_log_id?: string | null
        }
        Update: {
          clinic_id?: string
          conciliation_reason?: string | null
          conciliation_result?: string
          contribution_id?: string | null
          created_at?: string
          id?: string
          lytex_fee_amount?: number | null
          lytex_invoice_id?: string
          lytex_net_value?: number | null
          lytex_paid_at?: string | null
          lytex_paid_value?: number | null
          lytex_payment_method?: string | null
          lytex_transaction_id?: string | null
          new_status?: string | null
          previous_status?: string | null
          raw_lytex_data?: Json | null
          sync_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lytex_conciliation_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lytex_conciliation_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lytex_conciliation_logs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "employer_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lytex_conciliation_logs_sync_log_id_fkey"
            columns: ["sync_log_id"]
            isOneToOne: false
            referencedRelation: "lytex_sync_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      lytex_sync_logs: {
        Row: {
          clients_imported: number | null
          clients_updated: number | null
          clinic_id: string
          completed_at: string | null
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          invoices_already_conciliated: number | null
          invoices_conciliated: number | null
          invoices_ignored: number | null
          invoices_imported: number | null
          invoices_updated: number | null
          started_at: string
          status: string
          sync_mode: string | null
          sync_type: string
        }
        Insert: {
          clients_imported?: number | null
          clients_updated?: number | null
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          invoices_already_conciliated?: number | null
          invoices_conciliated?: number | null
          invoices_ignored?: number | null
          invoices_imported?: number | null
          invoices_updated?: number | null
          started_at?: string
          status?: string
          sync_mode?: string | null
          sync_type: string
        }
        Update: {
          clients_imported?: number | null
          clients_updated?: number | null
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          invoices_already_conciliated?: number | null
          invoices_conciliated?: number | null
          invoices_ignored?: number | null
          invoices_imported?: number | null
          invoices_updated?: number | null
          started_at?: string
          status?: string
          sync_mode?: string | null
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lytex_sync_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lytex_sync_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      lytex_webhook_logs: {
        Row: {
          clinic_id: string | null
          contribution_id: string | null
          created_at: string
          id: string
          payload: Json
          processed: boolean | null
          webhook_type: string
        }
        Insert: {
          clinic_id?: string | null
          contribution_id?: string | null
          created_at?: string
          id?: string
          payload: Json
          processed?: boolean | null
          webhook_type: string
        }
        Update: {
          clinic_id?: string | null
          contribution_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          webhook_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lytex_webhook_logs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "employer_contributions"
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
            foreignKeyName: "marketing_consents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          appointment_id: string | null
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
          appointment_id?: string | null
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
          appointment_id?: string | null
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
            foreignKeyName: "medical_documents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "medical_documents_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
          dependent_id: string | null
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
          dependent_id?: string | null
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
          dependent_id?: string | null
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
            foreignKeyName: "medical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "patient_dependents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "sindical_dependentes"
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
          {
            foreignKeyName: "medical_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
            foreignKeyName: "medical_repass_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "medical_repass_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
            referencedRelation: "cash_register_balances"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "medical_repass_payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "medical_repass_payments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
          {
            foreignKeyName: "medical_repass_periods_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "medical_repass_rules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "medical_repass_rules_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          active_ingredient: string | null
          clinic_id: string | null
          created_at: string
          dosage: string | null
          form: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          is_controlled: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          active_ingredient?: string | null
          clinic_id?: string | null
          created_at?: string
          dosage?: string | null
          form?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_controlled?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          active_ingredient?: string | null
          clinic_id?: string | null
          created_at?: string
          dosage?: string | null
          form?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_controlled?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      member_categories: {
        Row: {
          clinic_id: string
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      member_contributions: {
        Row: {
          clinic_id: string
          competence_month: number
          competence_year: number
          contribution_type_id: string
          created_at: string | null
          created_by: string | null
          due_date: string
          id: string
          lytex_boleto_barcode: string | null
          lytex_boleto_digitable_line: string | null
          lytex_invoice_id: string | null
          lytex_invoice_url: string | null
          lytex_pix_code: string | null
          lytex_pix_qrcode: string | null
          member_id: string
          notes: string | null
          paid_at: string | null
          paid_value: number | null
          payment_method: string | null
          portal_reissue_count: number | null
          status: string | null
          updated_at: string | null
          value: number
        }
        Insert: {
          clinic_id: string
          competence_month: number
          competence_year: number
          contribution_type_id: string
          created_at?: string | null
          created_by?: string | null
          due_date: string
          id?: string
          lytex_boleto_barcode?: string | null
          lytex_boleto_digitable_line?: string | null
          lytex_invoice_id?: string | null
          lytex_invoice_url?: string | null
          lytex_pix_code?: string | null
          lytex_pix_qrcode?: string | null
          member_id: string
          notes?: string | null
          paid_at?: string | null
          paid_value?: number | null
          payment_method?: string | null
          portal_reissue_count?: number | null
          status?: string | null
          updated_at?: string | null
          value?: number
        }
        Update: {
          clinic_id?: string
          competence_month?: number
          competence_year?: number
          contribution_type_id?: string
          created_at?: string | null
          created_by?: string | null
          due_date?: string
          id?: string
          lytex_boleto_barcode?: string | null
          lytex_boleto_digitable_line?: string | null
          lytex_invoice_id?: string | null
          lytex_invoice_url?: string | null
          lytex_pix_code?: string | null
          lytex_pix_qrcode?: string | null
          member_id?: string
          notes?: string | null
          paid_at?: string | null
          paid_value?: number | null
          payment_method?: string | null
          portal_reissue_count?: number | null
          status?: string | null
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_contributions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_contributions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_contributions_contribution_type_id_fkey"
            columns: ["contribution_type_id"]
            isOneToOne: false
            referencedRelation: "contribution_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_portal_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          member_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          member_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          member_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_portal_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          access_code: string | null
          access_code_expires_at: string | null
          address: string | null
          birth_date: string | null
          category_id: string | null
          cep: string | null
          city: string | null
          clinic_id: string
          cpf: string
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          neighborhood: string | null
          notes: string | null
          phone: string | null
          portal_last_access_at: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          access_code?: string | null
          access_code_expires_at?: string | null
          address?: string | null
          birth_date?: string | null
          category_id?: string | null
          cep?: string | null
          city?: string | null
          clinic_id: string
          cpf: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          portal_last_access_at?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          access_code?: string | null
          access_code_expires_at?: string | null
          address?: string | null
          birth_date?: string | null
          category_id?: string | null
          cep?: string | null
          city?: string | null
          clinic_id?: string
          cpf?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          portal_last_access_at?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "member_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      mercado_pago_payments: {
        Row: {
          amount: number
          appointment_id: string | null
          boleto_barcode: string | null
          boleto_due_date: string | null
          boleto_url: string | null
          clinic_id: string
          created_at: string
          description: string | null
          external_reference: string
          financial_transaction_id: string | null
          id: string
          mp_payment_id: string | null
          mp_status: string | null
          mp_status_detail: string | null
          paid_at: string | null
          patient_package_id: string | null
          payer_cpf: string | null
          payer_email: string | null
          payer_name: string | null
          payment_type: string
          pix_expiration_date: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          quote_id: string | null
          source: string
          status: string
          updated_at: string
          webhook_received_at: string | null
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          boleto_barcode?: string | null
          boleto_due_date?: string | null
          boleto_url?: string | null
          clinic_id: string
          created_at?: string
          description?: string | null
          external_reference: string
          financial_transaction_id?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          paid_at?: string | null
          patient_package_id?: string | null
          payer_cpf?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_type: string
          pix_expiration_date?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          quote_id?: string | null
          source: string
          status?: string
          updated_at?: string
          webhook_received_at?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          boleto_barcode?: string | null
          boleto_due_date?: string | null
          boleto_url?: string | null
          clinic_id?: string
          created_at?: string
          description?: string | null
          external_reference?: string
          financial_transaction_id?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          paid_at?: string | null
          patient_package_id?: string | null
          payer_cpf?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_type?: string
          pix_expiration_date?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          quote_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          webhook_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercado_pago_payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercado_pago_payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercado_pago_payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercado_pago_payments_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercado_pago_payments_patient_package_id_fkey"
            columns: ["patient_package_id"]
            isOneToOne: false
            referencedRelation: "patient_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercado_pago_payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
          {
            foreignKeyName: "message_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_safe_mode_audit: {
        Row: {
          changed_by: string | null
          created_at: string
          field: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          field: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          field?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      meta_safe_mode_config: {
        Row: {
          circuit_breaker_open: boolean
          circuit_opened_at: string | null
          circuit_reason: string | null
          dry_run: boolean
          go_live_stage: number
          go_live_started_at: string | null
          id: string
          maintenance_mode: boolean
          manual_override: boolean
          max_per_contact_30d: number
          max_per_day: number
          max_per_hour: number
          safe_mode: boolean
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          circuit_breaker_open?: boolean
          circuit_opened_at?: string | null
          circuit_reason?: string | null
          dry_run?: boolean
          go_live_stage?: number
          go_live_started_at?: string | null
          id?: string
          maintenance_mode?: boolean
          manual_override?: boolean
          max_per_contact_30d?: number
          max_per_day?: number
          max_per_hour?: number
          safe_mode?: boolean
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          circuit_breaker_open?: boolean
          circuit_opened_at?: string | null
          circuit_reason?: string | null
          dry_run?: boolean
          go_live_stage?: number
          go_live_started_at?: string | null
          id?: string
          maintenance_mode?: boolean
          manual_override?: boolean
          max_per_contact_30d?: number
          max_per_day?: number
          max_per_hour?: number
          safe_mode?: boolean
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      meta_secret_status: {
        Row: {
          is_configured: boolean
          secret_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          is_configured?: boolean
          secret_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          is_configured?: boolean
          secret_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mobile_app_settings: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          force_logout_after: string | null
          id: string
          min_app_version: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          force_logout_after?: string | null
          id?: string
          min_app_version?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          force_logout_after?: string | null
          id?: string
          min_app_version?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mobile_app_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mobile_app_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      mobile_app_tabs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          order_index: number
          tab_category: string
          tab_key: string
          tab_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          tab_category?: string
          tab_key: string
          tab_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          tab_category?: string
          tab_key?: string
          tab_name?: string
          updated_at?: string
        }
        Relationships: []
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
      n8n_configs: {
        Row: {
          clinic_id: string
          connection_status: string | null
          created_at: string | null
          id: string
          n8n_api_token_secret_name: string | null
          n8n_url: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          connection_status?: string | null
          created_at?: string | null
          id?: string
          n8n_api_token_secret_name?: string | null
          n8n_url: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          connection_status?: string | null
          created_at?: string | null
          id?: string
          n8n_api_token_secret_name?: string | null
          n8n_url?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "n8n_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "n8n_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
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
      negotiation_installment_notifications: {
        Row: {
          clinic_id: string
          created_at: string
          error_message: string | null
          id: string
          installment_id: string
          phone: string
          sent_at: string
          success: boolean
        }
        Insert: {
          clinic_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          installment_id: string
          phone: string
          sent_at?: string
          success?: boolean
        }
        Update: {
          clinic_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          installment_id?: string
          phone?: string
          sent_at?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_installment_notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_installment_notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_installment_notifications_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "negotiation_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_installments: {
        Row: {
          created_at: string
          due_date: string
          id: string
          installment_number: number
          lytex_boleto_barcode: string | null
          lytex_boleto_digitable_line: string | null
          lytex_invoice_id: string | null
          lytex_invoice_url: string | null
          lytex_pix_code: string | null
          lytex_pix_qrcode: string | null
          negotiation_id: string
          paid_at: string | null
          paid_value: number | null
          payment_method: string | null
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          lytex_boleto_barcode?: string | null
          lytex_boleto_digitable_line?: string | null
          lytex_invoice_id?: string | null
          lytex_invoice_url?: string | null
          lytex_pix_code?: string | null
          lytex_pix_qrcode?: string | null
          negotiation_id: string
          paid_at?: string | null
          paid_value?: number | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          lytex_boleto_barcode?: string | null
          lytex_boleto_digitable_line?: string | null
          lytex_invoice_id?: string | null
          lytex_invoice_url?: string | null
          lytex_pix_code?: string | null
          lytex_pix_qrcode?: string | null
          negotiation_id?: string
          paid_at?: string | null
          paid_value?: number | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_installments_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "debt_negotiations"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_items: {
        Row: {
          competence_month: number
          competence_year: number
          contribution_id: string
          contribution_type_name: string
          correction_value: number
          created_at: string
          days_overdue: number
          due_date: string
          id: string
          interest_value: number
          late_fee_value: number
          negotiation_id: string
          original_value: number
          total_value: number
        }
        Insert: {
          competence_month: number
          competence_year: number
          contribution_id: string
          contribution_type_name: string
          correction_value?: number
          created_at?: string
          days_overdue: number
          due_date: string
          id?: string
          interest_value?: number
          late_fee_value?: number
          negotiation_id: string
          original_value: number
          total_value: number
        }
        Update: {
          competence_month?: number
          competence_year?: number
          contribution_id?: string
          contribution_type_name?: string
          correction_value?: number
          created_at?: string
          days_overdue?: number
          due_date?: string
          id?: string
          interest_value?: number
          late_fee_value?: number
          negotiation_id?: string
          original_value?: number
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_items_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "employer_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_items_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "debt_negotiations"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_previews: {
        Row: {
          access_token: string
          cancelled_at: string | null
          clinic_id: string
          contributions_data: Json
          created_at: string
          created_by: string | null
          custom_dates: Json | null
          down_payment: number
          employer_cnpj: string
          employer_id: string
          employer_name: string
          employer_trade_name: string | null
          expires_at: string
          first_due_date: string
          id: string
          installment_value: number
          installments_count: number
          interest_rate_monthly: number
          is_cancelled: boolean
          late_fee_percentage: number
          legal_basis: string | null
          monetary_correction_monthly: number
          negotiation_id: string | null
          total_correction: number
          total_interest: number
          total_late_fee: number
          total_negotiated_value: number
          total_original_value: number
          view_count: number
          viewed_at: string | null
        }
        Insert: {
          access_token: string
          cancelled_at?: string | null
          clinic_id: string
          contributions_data: Json
          created_at?: string
          created_by?: string | null
          custom_dates?: Json | null
          down_payment?: number
          employer_cnpj: string
          employer_id: string
          employer_name: string
          employer_trade_name?: string | null
          expires_at?: string
          first_due_date: string
          id?: string
          installment_value: number
          installments_count: number
          interest_rate_monthly: number
          is_cancelled?: boolean
          late_fee_percentage: number
          legal_basis?: string | null
          monetary_correction_monthly: number
          negotiation_id?: string | null
          total_correction: number
          total_interest: number
          total_late_fee: number
          total_negotiated_value: number
          total_original_value: number
          view_count?: number
          viewed_at?: string | null
        }
        Update: {
          access_token?: string
          cancelled_at?: string | null
          clinic_id?: string
          contributions_data?: Json
          created_at?: string
          created_by?: string | null
          custom_dates?: Json | null
          down_payment?: number
          employer_cnpj?: string
          employer_id?: string
          employer_name?: string
          employer_trade_name?: string | null
          expires_at?: string
          first_due_date?: string
          id?: string
          installment_value?: number
          installments_count?: number
          interest_rate_monthly?: number
          is_cancelled?: boolean
          late_fee_percentage?: number
          legal_basis?: string | null
          monetary_correction_monthly?: number
          negotiation_id?: string | null
          total_correction?: number
          total_interest?: number
          total_late_fee?: number
          total_negotiated_value?: number
          total_original_value?: number
          view_count?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_previews_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_previews_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_previews_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_previews_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "debt_negotiations"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_settings: {
        Row: {
          allow_partial_negotiation: boolean
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          interest_rate_monthly: number
          late_fee_percentage: number
          legal_basis: string | null
          max_installments: number
          min_down_payment_percentage: number | null
          min_installment_value: number
          monetary_correction_monthly: number
          require_down_payment: boolean
          updated_at: string
        }
        Insert: {
          allow_partial_negotiation?: boolean
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          interest_rate_monthly?: number
          late_fee_percentage?: number
          legal_basis?: string | null
          max_installments?: number
          min_down_payment_percentage?: number | null
          min_installment_value?: number
          monetary_correction_monthly?: number
          require_down_payment?: boolean
          updated_at?: string
        }
        Update: {
          allow_partial_negotiation?: boolean
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interest_rate_monthly?: number
          late_fee_percentage?: number
          legal_basis?: string | null
          max_installments?: number
          min_down_payment_percentage?: number | null
          min_installment_value?: number
          monetary_correction_monthly?: number
          require_down_payment?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_settings: {
        Row: {
          clinic_id: string
          created_at: string
          delay_hours: number | null
          id: string
          is_enabled: boolean | null
          message_template: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          delay_hours?: number | null
          id?: string
          is_enabled?: boolean | null
          message_template?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          delay_hours?: number | null
          id?: string
          is_enabled?: boolean | null
          message_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_surveys: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          feedback: string | null
          id: string
          patient_id: string
          professional_id: string | null
          responded_at: string | null
          response_token: string | null
          score: number | null
          sent_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          patient_id: string
          professional_id?: string | null
          responded_at?: string | null
          response_token?: string | null
          score?: number | null
          sent_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          patient_id?: string
          professional_id?: string | null
          responded_at?: string | null
          response_token?: string | null
          score?: number | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_surveys_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "odontogram_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "odontogram_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvidoria_messages: {
        Row: {
          admin_notes: string | null
          clinic_id: string
          created_at: string
          id: string
          is_anonymous: boolean | null
          message: string
          message_type: string
          patient_cpf: string | null
          patient_email: string | null
          patient_id: string | null
          patient_name: string | null
          patient_phone: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          message: string
          message_type: string
          patient_cpf?: string | null
          patient_email?: string | null
          patient_id?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          message?: string
          message_type?: string
          patient_cpf?: string | null
          patient_email?: string | null
          patient_id?: string | null
          patient_name?: string | null
          patient_phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvidoria_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvidoria_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
            foreignKeyName: "package_payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "package_sessions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
            foreignKeyName: "package_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      panel_banners: {
        Row: {
          background_color: string | null
          button_link: string | null
          button_text: string | null
          clinic_id: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          image_url: string
          is_active: boolean
          order_index: number
          overlay_opacity: number | null
          subtitle: string | null
          text_color: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          background_color?: string | null
          button_link?: string | null
          button_text?: string | null
          clinic_id: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          image_url: string
          is_active?: boolean
          order_index?: number
          overlay_opacity?: number | null
          subtitle?: string | null
          text_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          background_color?: string | null
          button_link?: string | null
          button_text?: string | null
          clinic_id?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          image_url?: string
          is_active?: boolean
          order_index?: number
          overlay_opacity?: number | null
          subtitle?: string | null
          text_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "panel_banners_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panel_banners_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "panels_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "patient_attachments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      patient_cards: {
        Row: {
          card_number: string
          clinic_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_active: boolean
          issued_at: string
          notes: string | null
          patient_id: string
          qr_code_token: string
          updated_at: string
        }
        Insert: {
          card_number: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          is_active?: boolean
          issued_at?: string
          notes?: string | null
          patient_id: string
          qr_code_token?: string
          updated_at?: string
        }
        Update: {
          card_number?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          issued_at?: string
          notes?: string | null
          patient_id?: string
          qr_code_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_cards_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_cards_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_cards_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_dependents: {
        Row: {
          birth_date: string | null
          card_expires_at: string | null
          card_number: string | null
          clinic_id: string
          cpf: string | null
          cpf_photo_url: string | null
          created_at: string
          gender: string | null
          id: string
          inactivated_at: string | null
          inactivation_reason: string | null
          insurance_plan_id: string | null
          is_active: boolean
          name: string
          notes: string | null
          patient_id: string
          pending_approval: boolean | null
          phone: string | null
          relationship: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          card_expires_at?: string | null
          card_number?: string | null
          clinic_id: string
          cpf?: string | null
          cpf_photo_url?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          inactivated_at?: string | null
          inactivation_reason?: string | null
          insurance_plan_id?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          patient_id: string
          pending_approval?: boolean | null
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          card_expires_at?: string | null
          card_number?: string | null
          clinic_id?: string
          cpf?: string | null
          cpf_photo_url?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          inactivated_at?: string | null
          inactivation_reason?: string | null
          insurance_plan_id?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          patient_id?: string
          pending_approval?: boolean | null
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_dependents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_dependents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_dependents_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_dependents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_first_access_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          patient_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          patient_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          patient_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_first_access_tokens_patient_id_fkey"
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
            foreignKeyName: "patient_folders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      patient_notifications: {
        Row: {
          body: string
          clinic_id: string
          created_at: string
          data: Json | null
          id: string
          is_read: boolean | null
          patient_id: string | null
          read_at: string | null
          title: string
          type: string | null
        }
        Insert: {
          body: string
          clinic_id: string
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          patient_id?: string | null
          read_at?: string | null
          title: string
          type?: string | null
        }
        Update: {
          body?: string
          clinic_id?: string
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean | null
          patient_id?: string | null
          read_at?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_notifications_patient_id_fkey"
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
            foreignKeyName: "patient_packages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      patient_password_resets: {
        Row: {
          birth_year: number | null
          channel: string | null
          created_at: string
          expires_at: string
          id: string
          patient_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          birth_year?: number | null
          channel?: string | null
          created_at?: string
          expires_at: string
          id?: string
          patient_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          birth_year?: number | null
          channel?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          patient_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_password_resets_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_payslip_history: {
        Row: {
          attachment_path: string
          attachment_url: string | null
          card_id: string | null
          clinic_id: string
          created_at: string
          id: string
          new_card_expiry: string | null
          patient_id: string
          payslip_request_id: string | null
          previous_card_expiry: string | null
          updated_at: string
          validated_at: string
          validated_by: string | null
          validation_notes: string | null
          validation_status: string
        }
        Insert: {
          attachment_path: string
          attachment_url?: string | null
          card_id?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          new_card_expiry?: string | null
          patient_id: string
          payslip_request_id?: string | null
          previous_card_expiry?: string | null
          updated_at?: string
          validated_at?: string
          validated_by?: string | null
          validation_notes?: string | null
          validation_status: string
        }
        Update: {
          attachment_path?: string
          attachment_url?: string | null
          card_id?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          new_card_expiry?: string | null
          patient_id?: string
          payslip_request_id?: string | null
          previous_card_expiry?: string | null
          updated_at?: string
          validated_at?: string
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_payslip_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "patient_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_payslip_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_payslip_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_payslip_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_payslip_history_payslip_request_id_fkey"
            columns: ["payslip_request_id"]
            isOneToOne: false
            referencedRelation: "payslip_requests"
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
          {
            foreignKeyName: "patient_segments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_signature_tokens: {
        Row: {
          clinic_id: string
          created_at: string | null
          expires_at: string
          id: string
          patient_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          patient_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          patient_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_signature_tokens_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_signature_tokens_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_signature_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          admission_date: string | null
          birth_date: string | null
          birthplace: string | null
          blocked_whatsapp: boolean
          blocked_whatsapp_at: string | null
          blocked_whatsapp_reason: string | null
          cep: string | null
          city: string | null
          clinic_id: string
          complement: string | null
          contact_name: string | null
          cpf: string | null
          created_at: string
          education: string | null
          email: string | null
          employer_cnpj: string | null
          employer_id: string | null
          employer_name: string | null
          father_name: string | null
          gender: string | null
          height_cm: number | null
          id: string
          inactivated_at: string | null
          inactivation_reason: string | null
          insurance_plan_id: string | null
          is_active: boolean
          is_company: boolean | null
          is_foreigner: boolean | null
          is_union_member: boolean | null
          job_function: string | null
          job_title: string | null
          landline: string | null
          marital_status: string | null
          max_appointments_per_month: number | null
          mother_name: string | null
          name: string
          neighborhood: string | null
          no_show_blocked_at: string | null
          no_show_blocked_professional_id: string | null
          no_show_blocked_until: string | null
          no_show_unblocked_at: string | null
          no_show_unblocked_by: string | null
          notes: string | null
          password_hash: string | null
          phone: string | null
          photo_url: string | null
          preferred_channel: string | null
          priority: string | null
          profession: string | null
          record_code: number
          referral: string | null
          registration_number: string | null
          religion: string | null
          rg: string | null
          send_notifications: boolean | null
          signature_accepted: boolean | null
          signature_accepted_at: string | null
          signature_url: string | null
          skin_color: string | null
          state: string | null
          street: string | null
          street_number: string | null
          tag: string | null
          union_affiliation_date: string | null
          union_category_id: string | null
          union_contribution_value: number | null
          union_join_date: string | null
          union_joined_at: string | null
          union_member_status: string | null
          union_observations: string | null
          union_payment_method: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          birth_date?: string | null
          birthplace?: string | null
          blocked_whatsapp?: boolean
          blocked_whatsapp_at?: string | null
          blocked_whatsapp_reason?: string | null
          cep?: string | null
          city?: string | null
          clinic_id: string
          complement?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string
          education?: string | null
          email?: string | null
          employer_cnpj?: string | null
          employer_id?: string | null
          employer_name?: string | null
          father_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          inactivated_at?: string | null
          inactivation_reason?: string | null
          insurance_plan_id?: string | null
          is_active?: boolean
          is_company?: boolean | null
          is_foreigner?: boolean | null
          is_union_member?: boolean | null
          job_function?: string | null
          job_title?: string | null
          landline?: string | null
          marital_status?: string | null
          max_appointments_per_month?: number | null
          mother_name?: string | null
          name: string
          neighborhood?: string | null
          no_show_blocked_at?: string | null
          no_show_blocked_professional_id?: string | null
          no_show_blocked_until?: string | null
          no_show_unblocked_at?: string | null
          no_show_unblocked_by?: string | null
          notes?: string | null
          password_hash?: string | null
          phone?: string | null
          photo_url?: string | null
          preferred_channel?: string | null
          priority?: string | null
          profession?: string | null
          record_code?: number
          referral?: string | null
          registration_number?: string | null
          religion?: string | null
          rg?: string | null
          send_notifications?: boolean | null
          signature_accepted?: boolean | null
          signature_accepted_at?: string | null
          signature_url?: string | null
          skin_color?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          tag?: string | null
          union_affiliation_date?: string | null
          union_category_id?: string | null
          union_contribution_value?: number | null
          union_join_date?: string | null
          union_joined_at?: string | null
          union_member_status?: string | null
          union_observations?: string | null
          union_payment_method?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          birth_date?: string | null
          birthplace?: string | null
          blocked_whatsapp?: boolean
          blocked_whatsapp_at?: string | null
          blocked_whatsapp_reason?: string | null
          cep?: string | null
          city?: string | null
          clinic_id?: string
          complement?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string
          education?: string | null
          email?: string | null
          employer_cnpj?: string | null
          employer_id?: string | null
          employer_name?: string | null
          father_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          inactivated_at?: string | null
          inactivation_reason?: string | null
          insurance_plan_id?: string | null
          is_active?: boolean
          is_company?: boolean | null
          is_foreigner?: boolean | null
          is_union_member?: boolean | null
          job_function?: string | null
          job_title?: string | null
          landline?: string | null
          marital_status?: string | null
          max_appointments_per_month?: number | null
          mother_name?: string | null
          name?: string
          neighborhood?: string | null
          no_show_blocked_at?: string | null
          no_show_blocked_professional_id?: string | null
          no_show_blocked_until?: string | null
          no_show_unblocked_at?: string | null
          no_show_unblocked_by?: string | null
          notes?: string | null
          password_hash?: string | null
          phone?: string | null
          photo_url?: string | null
          preferred_channel?: string | null
          priority?: string | null
          profession?: string | null
          record_code?: number
          referral?: string | null
          registration_number?: string | null
          religion?: string | null
          rg?: string | null
          send_notifications?: boolean | null
          signature_accepted?: boolean | null
          signature_accepted_at?: string | null
          signature_url?: string | null
          skin_color?: string | null
          state?: string | null
          street?: string | null
          street_number?: string | null
          tag?: string | null
          union_affiliation_date?: string | null
          union_category_id?: string | null
          union_contribution_value?: number | null
          union_join_date?: string | null
          union_joined_at?: string | null
          union_member_status?: string | null
          union_observations?: string | null
          union_payment_method?: string | null
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
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_no_show_blocked_professional_id_fkey"
            columns: ["no_show_blocked_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_no_show_blocked_professional_id_fkey"
            columns: ["no_show_blocked_professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
            foreignKeyName: "payment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      payslip_requests: {
        Row: {
          attachment_path: string | null
          card_id: string
          clinic_id: string
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          received_at: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attachment_path?: string | null
          card_id: string
          clinic_id: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          received_at?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attachment_path?: string | null
          card_id?: string
          clinic_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          received_at?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslip_requests_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "patient_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_requests_patient_id_fkey"
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
          {
            foreignKeyName: "pending_confirmations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_dependent_approvals: {
        Row: {
          clinic_id: string
          cpf_photo_back_url: string | null
          cpf_photo_url: string | null
          created_at: string
          dependent_id: string
          holder_doc_back_url: string | null
          holder_doc_front_url: string | null
          id: string
          patient_id: string
          rejection_reason: string | null
          requester_phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          clinic_id: string
          cpf_photo_back_url?: string | null
          cpf_photo_url?: string | null
          created_at?: string
          dependent_id: string
          holder_doc_back_url?: string | null
          holder_doc_front_url?: string | null
          id?: string
          patient_id: string
          rejection_reason?: string | null
          requester_phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          clinic_id?: string
          cpf_photo_back_url?: string | null
          cpf_photo_url?: string | null
          created_at?: string
          dependent_id?: string
          holder_doc_back_url?: string | null
          holder_doc_front_url?: string | null
          id?: string
          patient_id?: string
          rejection_reason?: string | null
          requester_phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_dependent_approvals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_dependent_approvals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_dependent_approvals_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "patient_dependents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_dependent_approvals_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "sindical_dependentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_dependent_approvals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
          module_type: string | null
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
          module_type?: string | null
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
          module_type?: string | null
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
      popup_notices: {
        Row: {
          button_link: string | null
          button_text: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          message: string | null
          navigate_to_authorizations: boolean | null
          navigate_to_booking: boolean | null
          navigate_to_card_renewal: boolean
          navigate_to_dependents: boolean | null
          priority: number
          show_once_per_session: boolean
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          button_link?: string | null
          button_text?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          message?: string | null
          navigate_to_authorizations?: boolean | null
          navigate_to_booking?: boolean | null
          navigate_to_card_renewal?: boolean
          navigate_to_dependents?: boolean | null
          priority?: number
          show_once_per_session?: boolean
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          button_link?: string | null
          button_text?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          message?: string | null
          navigate_to_authorizations?: boolean | null
          navigate_to_booking?: boolean | null
          navigate_to_card_renewal?: boolean
          navigate_to_dependents?: boolean | null
          priority?: number
          show_once_per_session?: boolean
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "popup_notices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "popup_notices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_attendance: {
        Row: {
          appointment_id: string
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          clinic_id: string
          created_at: string
          glucose: number | null
          heart_rate: number | null
          height: number | null
          id: string
          notes: string | null
          oxygen_saturation: number | null
          patient_id: string
          recorded_at: string
          recorded_by: string | null
          temperature: number | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          appointment_id: string
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          clinic_id: string
          created_at?: string
          glucose?: number | null
          heart_rate?: number | null
          height?: number | null
          id?: string
          notes?: string | null
          oxygen_saturation?: number | null
          patient_id: string
          recorded_at?: string
          recorded_by?: string | null
          temperature?: number | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          appointment_id?: string
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          clinic_id?: string
          created_at?: string
          glucose?: number | null
          heart_rate?: number | null
          height?: number | null
          id?: string
          notes?: string | null
          oxygen_saturation?: number | null
          patient_id?: string
          recorded_at?: string
          recorded_by?: string | null
          temperature?: number | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_attendance_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_attendance_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_attendance_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_attendance_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "prescriptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
          {
            foreignKeyName: "procedures_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "professional_commissions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "professional_commissions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
      professional_insurance_plans: {
        Row: {
          created_at: string
          id: string
          insurance_plan_id: string
          professional_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insurance_plan_id: string
          professional_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insurance_plan_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_insurance_plans_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_insurance_plans_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_insurance_plans_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_procedures: {
        Row: {
          created_at: string
          id: string
          procedure_id: string
          professional_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          procedure_id: string
          professional_id: string
        }
        Update: {
          created_at?: string
          id?: string
          procedure_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_procedures_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_procedures_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_procedures_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_schedule_exceptions: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          end_time: string | null
          exception_date: string
          id: string
          is_day_off: boolean | null
          professional_id: string
          reason: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          exception_date: string
          id?: string
          is_day_off?: boolean | null
          professional_id: string
          reason?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          exception_date?: string
          id?: string
          is_day_off?: boolean | null
          professional_id?: string
          reason?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_schedule_exceptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_schedule_exceptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_schedule_exceptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_schedule_exceptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
            foreignKeyName: "professional_specialties_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
          council_type: string | null
          created_at: string
          education: string | null
          email: string | null
          experience: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          max_patient_age: number | null
          memed_enabled: boolean
          memed_token: string | null
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
          council_type?: string | null
          created_at?: string
          education?: string | null
          email?: string | null
          experience?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_patient_age?: number | null
          memed_enabled?: boolean
          memed_token?: string | null
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
          council_type?: string | null
          created_at?: string
          education?: string | null
          email?: string | null
          experience?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_patient_age?: number | null
          memed_enabled?: boolean
          memed_token?: string | null
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
          {
            foreignKeyName: "professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          data_criacao: string | null
          email: string | null
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
          data_criacao?: string | null
          email?: string | null
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
          data_criacao?: string | null
          email?: string | null
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
      push_notification_history: {
        Row: {
          body: string
          clinic_id: string
          created_at: string
          data: Json | null
          id: string
          sent_at: string
          sent_by: string | null
          target_patient_ids: string[] | null
          target_type: string
          title: string
          total_failed: number | null
          total_sent: number | null
          total_success: number | null
        }
        Insert: {
          body: string
          clinic_id: string
          created_at?: string
          data?: Json | null
          id?: string
          sent_at?: string
          sent_by?: string | null
          target_patient_ids?: string[] | null
          target_type: string
          title: string
          total_failed?: number | null
          total_sent?: number | null
          total_success?: number | null
        }
        Update: {
          body?: string
          clinic_id?: string
          created_at?: string
          data?: Json | null
          id?: string
          sent_at?: string
          sent_by?: string | null
          target_patient_ids?: string[] | null
          target_type?: string
          title?: string
          total_failed?: number | null
          total_sent?: number | null
          total_success?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notification_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_tokens: {
        Row: {
          clinic_id: string
          created_at: string
          device_info: Json | null
          id: string
          is_active: boolean | null
          patient_id: string | null
          platform: string
          token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          patient_id?: string | null
          platform: string
          token: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          patient_id?: string | null
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_tokens_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notification_tokens_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notification_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      pwa_installations: {
        Row: {
          clinic_id: string | null
          created_at: string
          device_info: Json | null
          id: string
          installed_at: string
          ip_address: string | null
          platform: string | null
          referrer: string | null
          standalone: boolean | null
          user_agent: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          device_info?: Json | null
          id?: string
          installed_at?: string
          ip_address?: string | null
          platform?: string | null
          referrer?: string | null
          standalone?: boolean | null
          user_agent?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          device_info?: Json | null
          id?: string
          installed_at?: string
          ip_address?: string | null
          platform?: string | null
          referrer?: string | null
          standalone?: boolean | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pwa_installations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pwa_installations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "queue_calls_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "queue_calls_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
          {
            foreignKeyName: "queues_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "quotes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "quotes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
          {
            foreignKeyName: "recurring_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_automations: {
        Row: {
          automation_id: string | null
          clinic_id: string
          created_at: string
          error_message: string | null
          id: string
          message_data: Json | null
          patient_id: string | null
          processed_at: string | null
          scheduled_at: string
          status: string
        }
        Insert: {
          automation_id?: string | null
          clinic_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_data?: Json | null
          patient_id?: string | null
          processed_at?: string | null
          scheduled_at: string
          status?: string
        }
        Update: {
          automation_id?: string | null
          clinic_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_data?: Json | null
          patient_id?: string | null
          processed_at?: string | null
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_automations_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_automations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_automations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_automations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      signature_request_tokens: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          ip_address: string | null
          patient_id: string
          token: string
          used_at: string | null
          user_agent: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          patient_id: string
          token: string
          used_at?: string | null
          user_agent?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          patient_id?: string
          token?: string
          used_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_request_tokens_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_request_tokens_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_request_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      sindical_associado_dependentes: {
        Row: {
          associado_id: string
          cpf: string | null
          created_at: string
          data_nascimento: string
          grau_parentesco: string
          id: string
          nome: string
        }
        Insert: {
          associado_id: string
          cpf?: string | null
          created_at?: string
          data_nascimento: string
          grau_parentesco: string
          id?: string
          nome: string
        }
        Update: {
          associado_id?: string
          cpf?: string | null
          created_at?: string
          data_nascimento?: string
          grau_parentesco?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "sindical_associado_dependentes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "sindical_associados"
            referencedColumns: ["id"]
          },
        ]
      }
      sindical_associados: {
        Row: {
          aceite_lgpd: boolean
          aceite_lgpd_at: string | null
          aprovado_at: string | null
          aprovado_por: string | null
          assinatura_aceite_at: string | null
          assinatura_aceite_desconto: boolean | null
          assinatura_digital_url: string | null
          bairro: string | null
          cargo: string | null
          categoria_id: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string
          created_at: string
          data_admissao: string | null
          data_nascimento: string
          documento_comprovante_url: string | null
          documento_foto_url: string | null
          documento_rg_url: string | null
          documento_rg_verso_url: string | null
          email: string
          employer_id: string | null
          empresa: string | null
          empresa_cnpj: string | null
          empresa_endereco: string | null
          empresa_matricula: string | null
          empresa_nome_fantasia: string | null
          empresa_razao_social: string | null
          estado_civil: string | null
          forma_pagamento: string | null
          id: string
          logradouro: string | null
          matricula: string | null
          motivo_rejeicao: string | null
          nome: string
          nome_mae: string | null
          nome_pai: string | null
          numero: string | null
          observacoes: string | null
          rejeitado_at: string | null
          rejeitado_por: string | null
          rg: string | null
          sexo: string | null
          sindicato_id: string
          status: string
          telefone: string
          tipo_vinculo: string | null
          uf: string | null
          updated_at: string
          valor_contribuicao: number | null
        }
        Insert: {
          aceite_lgpd?: boolean
          aceite_lgpd_at?: string | null
          aprovado_at?: string | null
          aprovado_por?: string | null
          assinatura_aceite_at?: string | null
          assinatura_aceite_desconto?: boolean | null
          assinatura_digital_url?: string | null
          bairro?: string | null
          cargo?: string | null
          categoria_id?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf: string
          created_at?: string
          data_admissao?: string | null
          data_nascimento: string
          documento_comprovante_url?: string | null
          documento_foto_url?: string | null
          documento_rg_url?: string | null
          documento_rg_verso_url?: string | null
          email: string
          employer_id?: string | null
          empresa?: string | null
          empresa_cnpj?: string | null
          empresa_endereco?: string | null
          empresa_matricula?: string | null
          empresa_nome_fantasia?: string | null
          empresa_razao_social?: string | null
          estado_civil?: string | null
          forma_pagamento?: string | null
          id?: string
          logradouro?: string | null
          matricula?: string | null
          motivo_rejeicao?: string | null
          nome: string
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          observacoes?: string | null
          rejeitado_at?: string | null
          rejeitado_por?: string | null
          rg?: string | null
          sexo?: string | null
          sindicato_id: string
          status?: string
          telefone: string
          tipo_vinculo?: string | null
          uf?: string | null
          updated_at?: string
          valor_contribuicao?: number | null
        }
        Update: {
          aceite_lgpd?: boolean
          aceite_lgpd_at?: string | null
          aprovado_at?: string | null
          aprovado_por?: string | null
          assinatura_aceite_at?: string | null
          assinatura_aceite_desconto?: boolean | null
          assinatura_digital_url?: string | null
          bairro?: string | null
          cargo?: string | null
          categoria_id?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string
          documento_comprovante_url?: string | null
          documento_foto_url?: string | null
          documento_rg_url?: string | null
          documento_rg_verso_url?: string | null
          email?: string
          employer_id?: string | null
          empresa?: string | null
          empresa_cnpj?: string | null
          empresa_endereco?: string | null
          empresa_matricula?: string | null
          empresa_nome_fantasia?: string | null
          empresa_razao_social?: string | null
          estado_civil?: string | null
          forma_pagamento?: string | null
          id?: string
          logradouro?: string | null
          matricula?: string | null
          motivo_rejeicao?: string | null
          nome?: string
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          observacoes?: string | null
          rejeitado_at?: string | null
          rejeitado_por?: string | null
          rg?: string | null
          sexo?: string | null
          sindicato_id?: string
          status?: string
          telefone?: string
          tipo_vinculo?: string | null
          uf?: string | null
          updated_at?: string
          valor_contribuicao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sindical_associados_categoria"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "sindical_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindical_associados_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindical_associados_sindicato_id_fkey"
            columns: ["sindicato_id"]
            isOneToOne: false
            referencedRelation: "union_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      sindical_categorias: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_active: boolean
          nome: string
          periodicidade: string | null
          sindicato_id: string
          updated_at: string
          valor_contribuicao: number | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome: string
          periodicidade?: string | null
          sindicato_id: string
          updated_at?: string
          valor_contribuicao?: number | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean
          nome?: string
          periodicidade?: string | null
          sindicato_id?: string
          updated_at?: string
          valor_contribuicao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sindical_categorias_sindicato_id_fkey"
            columns: ["sindicato_id"]
            isOneToOne: false
            referencedRelation: "union_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      sindical_payment_methods: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          sindicato_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          sindicato_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          sindicato_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sindical_payment_methods_sindicato_id_fkey"
            columns: ["sindicato_id"]
            isOneToOne: false
            referencedRelation: "union_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_send_logs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          provider_response: Json | null
          recipient: string
          rendered_body: string
          sent_by: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          provider_response?: Json | null
          recipient: string
          rendered_body: string
          sent_by?: string | null
          status: string
          template_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          provider_response?: Json | null
          recipient?: string
          rendered_body?: string
          sent_by?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_send_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          meta_template_name: string | null
          name: string
          status: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          meta_template_name?: string | null
          name: string
          status?: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          meta_template_name?: string | null
          name?: string
          status?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
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
            foreignKeyName: "stock_alerts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "stock_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "stock_movements_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "stock_products_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      subscription_addons: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          key: string
          monthly_price: number
          name: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          key: string
          monthly_price?: number
          name: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          key?: string
          monthly_price?: number
          name?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_billing_settings: {
        Row: {
          auto_generate_enabled: boolean | null
          created_at: string
          default_due_day_offset: number | null
          generate_day_of_month: number | null
          id: string
          lytex_enabled: boolean | null
          send_email_on_generation: boolean | null
          send_reminder_days_before: number | null
          send_whatsapp_on_generation: boolean | null
          updated_at: string
        }
        Insert: {
          auto_generate_enabled?: boolean | null
          created_at?: string
          default_due_day_offset?: number | null
          generate_day_of_month?: number | null
          id?: string
          lytex_enabled?: boolean | null
          send_email_on_generation?: boolean | null
          send_reminder_days_before?: number | null
          send_whatsapp_on_generation?: boolean | null
          updated_at?: string
        }
        Update: {
          auto_generate_enabled?: boolean | null
          created_at?: string
          default_due_day_offset?: number | null
          generate_day_of_month?: number | null
          id?: string
          lytex_enabled?: boolean | null
          send_email_on_generation?: boolean | null
          send_reminder_days_before?: number | null
          send_whatsapp_on_generation?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_invoices: {
        Row: {
          clinic_id: string
          competence_month: number
          competence_year: number
          created_at: string
          created_by: string | null
          description: string | null
          digitable_line: string | null
          due_date: string
          fee_cents: number | null
          id: string
          invoice_url: string | null
          lytex_client_id: string | null
          lytex_invoice_id: string | null
          net_value_cents: number | null
          notes: string | null
          paid_at: string | null
          paid_value_cents: number | null
          payment_method: string | null
          pix_code: string | null
          plan_id: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          value_cents: number
        }
        Insert: {
          clinic_id: string
          competence_month: number
          competence_year: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          digitable_line?: string | null
          due_date: string
          fee_cents?: number | null
          id?: string
          invoice_url?: string | null
          lytex_client_id?: string | null
          lytex_invoice_id?: string | null
          net_value_cents?: number | null
          notes?: string | null
          paid_at?: string | null
          paid_value_cents?: number | null
          payment_method?: string | null
          pix_code?: string | null
          plan_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          value_cents: number
        }
        Update: {
          clinic_id?: string
          competence_month?: number
          competence_year?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          digitable_line?: string | null
          due_date?: string
          fee_cents?: number | null
          id?: string
          invoice_url?: string | null
          lytex_client_id?: string | null
          lytex_invoice_id?: string | null
          net_value_cents?: number | null
          notes?: string | null
          paid_at?: string | null
          paid_value_cents?: number | null
          payment_method?: string | null
          pix_code?: string | null
          plan_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          value_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          annual_price: number | null
          billing_period: string
          category: Database["public"]["Enums"]["plan_category"]
          created_at: string
          description: string | null
          display_order: number | null
          external_plan_id: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_default_trial: boolean | null
          is_public: boolean | null
          max_messages_monthly: number | null
          max_professionals: number
          module_flags: Json | null
          monthly_price: number
          name: string
          resource_limits: Json | null
          trial_days: number | null
          updated_at: string
        }
        Insert: {
          annual_price?: number | null
          billing_period?: string
          category?: Database["public"]["Enums"]["plan_category"]
          created_at?: string
          description?: string | null
          display_order?: number | null
          external_plan_id?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_default_trial?: boolean | null
          is_public?: boolean | null
          max_messages_monthly?: number | null
          max_professionals?: number
          module_flags?: Json | null
          monthly_price?: number
          name: string
          resource_limits?: Json | null
          trial_days?: number | null
          updated_at?: string
        }
        Update: {
          annual_price?: number | null
          billing_period?: string
          category?: Database["public"]["Enums"]["plan_category"]
          created_at?: string
          description?: string | null
          display_order?: number | null
          external_plan_id?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_default_trial?: boolean | null
          is_public?: boolean | null
          max_messages_monthly?: number | null
          max_professionals?: number
          module_flags?: Json | null
          monthly_price?: number
          name?: string
          resource_limits?: Json | null
          trial_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_webhook_logs: {
        Row: {
          clinic_id: string | null
          created_at: string | null
          id: string
          invoice_id: string | null
          payload: Json | null
          processed: boolean | null
          webhook_type: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          payload?: Json | null
          processed?: boolean | null
          webhook_type?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          payload?: Json | null
          processed?: boolean | null
          webhook_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_webhook_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_webhook_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_webhook_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_day: number | null
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
          billing_day?: number | null
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
          billing_day?: number | null
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
            foreignKeyName: "subscriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "suppliers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "tiss_guide_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "tiss_guide_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
            foreignKeyName: "tiss_guides_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "tiss_xml_files_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "totems_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
            foreignKeyName: "transaction_cost_centers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      twilio_configs: {
        Row: {
          account_sid: string
          auth_token: string
          clinic_id: string
          created_at: string
          id: string
          is_active: boolean | null
          is_connected: boolean | null
          phone_number: string
          updated_at: string
        }
        Insert: {
          account_sid: string
          auth_token: string
          clinic_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_connected?: boolean | null
          phone_number: string
          updated_at?: string
        }
        Update: {
          account_sid?: string
          auth_token?: string
          clinic_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_connected?: boolean | null
          phone_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "twilio_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twilio_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_app_album_photos: {
        Row: {
          album_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string
          order_index: number
          title: string | null
        }
        Insert: {
          album_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          order_index?: number
          title?: string | null
        }
        Update: {
          album_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          order_index?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_app_album_photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "union_app_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      union_app_albums: {
        Row: {
          clinic_id: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_app_albums_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_app_albums_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_app_content: {
        Row: {
          cct_category_id: string | null
          clinic_id: string
          content_type: string
          created_at: string
          created_by: string | null
          description: string | null
          external_link: string | null
          file_url: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_aditivo: boolean
          is_pinned: boolean | null
          metadata: Json | null
          order_index: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cct_category_id?: string | null
          clinic_id: string
          content_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_link?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_aditivo?: boolean
          is_pinned?: boolean | null
          metadata?: Json | null
          order_index?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cct_category_id?: string | null
          clinic_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_link?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_aditivo?: boolean
          is_pinned?: boolean | null
          metadata?: Json | null
          order_index?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_app_content_cct_category_id_fkey"
            columns: ["cct_category_id"]
            isOneToOne: false
            referencedRelation: "union_cct_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_app_content_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_app_content_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_audit_logs: {
        Row: {
          action: string
          clinic_id: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          clinic_id: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          clinic_id?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_authorizations: {
        Row: {
          authorization_number: string
          benefit_id: string
          clinic_id: string
          created_at: string
          created_by: string | null
          dependent_id: string | null
          id: string
          is_for_dependent: boolean
          issued_at: string
          last_viewed_at: string | null
          notes: string | null
          patient_id: string
          printed_at: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          union_entity_id: string | null
          updated_at: string
          valid_from: string
          valid_until: string
          validation_hash: string
          view_count: number
        }
        Insert: {
          authorization_number: string
          benefit_id: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          dependent_id?: string | null
          id?: string
          is_for_dependent?: boolean
          issued_at?: string
          last_viewed_at?: string | null
          notes?: string | null
          patient_id: string
          printed_at?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          union_entity_id?: string | null
          updated_at?: string
          valid_from?: string
          valid_until: string
          validation_hash: string
          view_count?: number
        }
        Update: {
          authorization_number?: string
          benefit_id?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          dependent_id?: string | null
          id?: string
          is_for_dependent?: boolean
          issued_at?: string
          last_viewed_at?: string | null
          notes?: string | null
          patient_id?: string
          printed_at?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          union_entity_id?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string
          validation_hash?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "union_authorizations_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "union_benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_authorizations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_authorizations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_authorizations_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "patient_dependents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_authorizations_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "sindical_dependentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_authorizations_union_entity_id_fkey"
            columns: ["union_entity_id"]
            isOneToOne: false
            referencedRelation: "union_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      union_bank_statement_imports: {
        Row: {
          account_number: string | null
          agency: string | null
          bank_code: string | null
          bank_name: string | null
          cash_register_id: string
          clinic_id: string
          created_at: string
          file_hash: string
          file_name: string
          id: string
          imported_at: string
          imported_by: string | null
          statement_end_date: string | null
          statement_start_date: string | null
          status: string
          total_credits: number
          total_debits: number
          total_transactions: number
          transactions_reconciled: number
        }
        Insert: {
          account_number?: string | null
          agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          cash_register_id: string
          clinic_id: string
          created_at?: string
          file_hash: string
          file_name: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          statement_end_date?: string | null
          statement_start_date?: string | null
          status?: string
          total_credits?: number
          total_debits?: number
          total_transactions?: number
          transactions_reconciled?: number
        }
        Update: {
          account_number?: string | null
          agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          cash_register_id?: string
          clinic_id?: string
          created_at?: string
          file_hash?: string
          file_name?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          statement_end_date?: string | null
          statement_start_date?: string | null
          status?: string
          total_credits?: number
          total_debits?: number
          total_transactions?: number
          transactions_reconciled?: number
        }
        Relationships: [
          {
            foreignKeyName: "union_bank_statement_imports_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "union_cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_bank_statement_imports_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_bank_statement_imports_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_bank_statement_transactions: {
        Row: {
          amount: number
          cash_register_id: string
          category_id: string | null
          check_number: string | null
          clinic_id: string
          created_at: string
          description: string | null
          document_number: string | null
          fitid: string | null
          generated_transaction_id: string | null
          id: string
          import_id: string
          matched_transaction_id: string | null
          matched_transfer_id: string | null
          matched_type: string
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_notes: string | null
          reconciliation_status: string
          supplier_id: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount: number
          cash_register_id: string
          category_id?: string | null
          check_number?: string | null
          clinic_id: string
          created_at?: string
          description?: string | null
          document_number?: string | null
          fitid?: string | null
          generated_transaction_id?: string | null
          id?: string
          import_id: string
          matched_transaction_id?: string | null
          matched_transfer_id?: string | null
          matched_type?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_notes?: string | null
          reconciliation_status?: string
          supplier_id?: string | null
          transaction_date: string
          transaction_type: string
        }
        Update: {
          amount?: number
          cash_register_id?: string
          category_id?: string | null
          check_number?: string | null
          clinic_id?: string
          created_at?: string
          description?: string | null
          document_number?: string | null
          fitid?: string | null
          generated_transaction_id?: string | null
          id?: string
          import_id?: string
          matched_transaction_id?: string | null
          matched_transfer_id?: string | null
          matched_type?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_notes?: string | null
          reconciliation_status?: string
          supplier_id?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_bank_statement_transactions_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "union_cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_bank_statement_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "union_financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_bank_statement_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_bank_statement_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_bank_statement_transactions_generated_transaction_id_fkey"
            columns: ["generated_transaction_id"]
            isOneToOne: false
            referencedRelation: "union_financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_bank_statement_transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "union_bank_statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_bank_statement_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "union_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      union_benefits: {
        Row: {
          category: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          partner_address: string | null
          partner_cnpj: string | null
          partner_email: string | null
          partner_name: string | null
          partner_phone: string | null
          union_entity_id: string | null
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          category?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          partner_address?: string | null
          partner_cnpj?: string | null
          partner_email?: string | null
          partner_name?: string | null
          partner_phone?: string | null
          union_entity_id?: string | null
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          category?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          partner_address?: string | null
          partner_cnpj?: string | null
          partner_email?: string | null
          partner_name?: string | null
          partner_phone?: string | null
          union_entity_id?: string | null
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "union_benefits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_benefits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_benefits_union_entity_id_fkey"
            columns: ["union_entity_id"]
            isOneToOne: false
            referencedRelation: "union_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      union_budget_alert_logs: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_id: string
          alert_level: string
          budget_exercise_id: string
          budget_item_id: string | null
          budget_item_type: string | null
          clinic_id: string
          current_value: number | null
          deviation_percentage: number | null
          id: string
          justification: string | null
          message: string
          threshold_value: number | null
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_id: string
          alert_level: string
          budget_exercise_id: string
          budget_item_id?: string | null
          budget_item_type?: string | null
          clinic_id: string
          current_value?: number | null
          deviation_percentage?: number | null
          id?: string
          justification?: string | null
          message: string
          threshold_value?: number | null
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_id?: string
          alert_level?: string
          budget_exercise_id?: string
          budget_item_id?: string | null
          budget_item_type?: string | null
          clinic_id?: string
          current_value?: number | null
          deviation_percentage?: number | null
          id?: string
          justification?: string | null
          message?: string
          threshold_value?: number | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_budget_alert_logs_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "union_budget_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_alert_logs_budget_exercise_id_fkey"
            columns: ["budget_exercise_id"]
            isOneToOne: false
            referencedRelation: "union_budget_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_alert_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_alert_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_budget_alerts: {
        Row: {
          alert_level: string
          alert_type: string
          budget_exercise_id: string
          category_id: string | null
          clinic_id: string
          cost_center_id: string | null
          created_at: string
          id: string
          is_active: boolean
          notify_by_email: boolean
          notify_by_system: boolean
          notify_users: string[] | null
          threshold_amount: number | null
          threshold_percentage: number | null
          updated_at: string
        }
        Insert: {
          alert_level: string
          alert_type: string
          budget_exercise_id: string
          category_id?: string | null
          clinic_id: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notify_by_email?: boolean
          notify_by_system?: boolean
          notify_users?: string[] | null
          threshold_amount?: number | null
          threshold_percentage?: number | null
          updated_at?: string
        }
        Update: {
          alert_level?: string
          alert_type?: string
          budget_exercise_id?: string
          category_id?: string | null
          clinic_id?: string
          cost_center_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notify_by_email?: boolean
          notify_by_system?: boolean
          notify_users?: string[] | null
          threshold_amount?: number | null
          threshold_percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_budget_alerts_budget_exercise_id_fkey"
            columns: ["budget_exercise_id"]
            isOneToOne: false
            referencedRelation: "union_budget_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_alerts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "union_financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_alerts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_alerts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_alerts_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "union_cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      union_budget_approvers: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          budget_exercise_id: string
          created_at: string
          id: string
          is_required: boolean
          notes: string | null
          rejection_reason: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          budget_exercise_id: string
          created_at?: string
          id?: string
          is_required?: boolean
          notes?: string | null
          rejection_reason?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          budget_exercise_id?: string
          created_at?: string
          id?: string
          is_required?: boolean
          notes?: string | null
          rejection_reason?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_budget_approvers_budget_exercise_id_fkey"
            columns: ["budget_exercise_id"]
            isOneToOne: false
            referencedRelation: "union_budget_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      union_budget_audit_logs: {
        Row: {
          action: string
          budget_exercise_id: string | null
          clinic_id: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          performed_at: string
          performed_by: string
          user_agent: string | null
        }
        Insert: {
          action: string
          budget_exercise_id?: string | null
          clinic_id: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          performed_by: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          budget_exercise_id?: string | null
          clinic_id?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string
          performed_by?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_budget_audit_logs_budget_exercise_id_fkey"
            columns: ["budget_exercise_id"]
            isOneToOne: false
            referencedRelation: "union_budget_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_budget_execution: {
        Row: {
          budget_version_id: string
          calculated_at: string
          clinic_id: string
          closed_at: string | null
          closed_by: string | null
          expense_deviation: number | null
          expense_deviation_percentage: number | null
          id: string
          is_closed: boolean
          notes: string | null
          reference_month: number
          reference_year: number
          result_budgeted: number | null
          result_realized: number | null
          revenue_deviation: number | null
          revenue_deviation_percentage: number | null
          total_expense_budgeted: number
          total_expense_realized: number
          total_revenue_budgeted: number
          total_revenue_realized: number
          updated_at: string
        }
        Insert: {
          budget_version_id: string
          calculated_at?: string
          clinic_id: string
          closed_at?: string | null
          closed_by?: string | null
          expense_deviation?: number | null
          expense_deviation_percentage?: number | null
          id?: string
          is_closed?: boolean
          notes?: string | null
          reference_month: number
          reference_year: number
          result_budgeted?: number | null
          result_realized?: number | null
          revenue_deviation?: number | null
          revenue_deviation_percentage?: number | null
          total_expense_budgeted?: number
          total_expense_realized?: number
          total_revenue_budgeted?: number
          total_revenue_realized?: number
          updated_at?: string
        }
        Update: {
          budget_version_id?: string
          calculated_at?: string
          clinic_id?: string
          closed_at?: string | null
          closed_by?: string | null
          expense_deviation?: number | null
          expense_deviation_percentage?: number | null
          id?: string
          is_closed?: boolean
          notes?: string | null
          reference_month?: number
          reference_year?: number
          result_budgeted?: number | null
          result_realized?: number | null
          revenue_deviation?: number | null
          revenue_deviation_percentage?: number | null
          total_expense_budgeted?: number
          total_expense_realized?: number
          total_revenue_budgeted?: number
          total_revenue_realized?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_budget_execution_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "union_budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_execution_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_execution_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_budget_exercises: {
        Row: {
          approved_at: string | null
          base_member_count: number | null
          base_year: number | null
          clinic_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          fiscal_year_start_day: number
          fiscal_year_start_month: number
          growth_rate_expense: number | null
          growth_rate_revenue: number | null
          id: string
          inflation_rate: number | null
          name: string
          notes: string | null
          projected_member_count: number | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          base_member_count?: number | null
          base_year?: number | null
          clinic_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          fiscal_year_start_day?: number
          fiscal_year_start_month?: number
          growth_rate_expense?: number | null
          growth_rate_revenue?: number | null
          id?: string
          inflation_rate?: number | null
          name: string
          notes?: string | null
          projected_member_count?: number | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          base_member_count?: number | null
          base_year?: number | null
          clinic_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          fiscal_year_start_day?: number
          fiscal_year_start_month?: number
          growth_rate_expense?: number | null
          growth_rate_revenue?: number | null
          id?: string
          inflation_rate?: number | null
          name?: string
          notes?: string | null
          projected_member_count?: number | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_budget_exercises_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_exercises_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_budget_expenses: {
        Row: {
          budget_limit: number | null
          budget_version_id: string
          category_id: string | null
          chart_account_id: string | null
          clinic_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          expense_nature: string | null
          expense_type: string
          growth_rate_applied: number | null
          historical_basis_end_date: string | null
          historical_basis_start_date: string | null
          id: string
          is_locked: boolean
          is_recurring: boolean
          month_01: number
          month_02: number
          month_03: number
          month_04: number
          month_05: number
          month_06: number
          month_07: number
          month_08: number
          month_09: number
          month_10: number
          month_11: number
          month_12: number
          premise_description: string | null
          requires_approval_above: number | null
          supplier_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          budget_limit?: number | null
          budget_version_id: string
          category_id?: string | null
          chart_account_id?: string | null
          clinic_id: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          expense_nature?: string | null
          expense_type: string
          growth_rate_applied?: number | null
          historical_basis_end_date?: string | null
          historical_basis_start_date?: string | null
          id?: string
          is_locked?: boolean
          is_recurring?: boolean
          month_01?: number
          month_02?: number
          month_03?: number
          month_04?: number
          month_05?: number
          month_06?: number
          month_07?: number
          month_08?: number
          month_09?: number
          month_10?: number
          month_11?: number
          month_12?: number
          premise_description?: string | null
          requires_approval_above?: number | null
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          budget_limit?: number | null
          budget_version_id?: string
          category_id?: string | null
          chart_account_id?: string | null
          clinic_id?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          expense_nature?: string | null
          expense_type?: string
          growth_rate_applied?: number | null
          historical_basis_end_date?: string | null
          historical_basis_start_date?: string | null
          id?: string
          is_locked?: boolean
          is_recurring?: boolean
          month_01?: number
          month_02?: number
          month_03?: number
          month_04?: number
          month_05?: number
          month_06?: number
          month_07?: number
          month_08?: number
          month_09?: number
          month_10?: number
          month_11?: number
          month_12?: number
          premise_description?: string | null
          requires_approval_above?: number | null
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_budget_expenses_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "union_budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "union_financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_expenses_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "union_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_expenses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_expenses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_expenses_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "union_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "union_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      union_budget_replanning: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          budget_exercise_id: string
          clinic_id: string
          difference: number | null
          expense_id: string | null
          id: string
          item_type: string
          justification: string
          new_value: number
          original_month: number
          original_value: number
          rejection_reason: string | null
          requested_at: string
          requested_by: string
          revenue_id: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          budget_exercise_id: string
          clinic_id: string
          difference?: number | null
          expense_id?: string | null
          id?: string
          item_type: string
          justification: string
          new_value: number
          original_month: number
          original_value: number
          rejection_reason?: string | null
          requested_at?: string
          requested_by: string
          revenue_id?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          budget_exercise_id?: string
          clinic_id?: string
          difference?: number | null
          expense_id?: string | null
          id?: string
          item_type?: string
          justification?: string
          new_value?: number
          original_month?: number
          original_value?: number
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string
          revenue_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_budget_replanning_budget_exercise_id_fkey"
            columns: ["budget_exercise_id"]
            isOneToOne: false
            referencedRelation: "union_budget_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_replanning_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_replanning_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_replanning_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "union_budget_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_replanning_revenue_id_fkey"
            columns: ["revenue_id"]
            isOneToOne: false
            referencedRelation: "union_budget_revenues"
            referencedColumns: ["id"]
          },
        ]
      }
      union_budget_revenues: {
        Row: {
          budget_version_id: string
          category_id: string | null
          chart_account_id: string | null
          clinic_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          growth_rate_applied: number | null
          historical_basis_end_date: string | null
          historical_basis_start_date: string | null
          id: string
          is_locked: boolean
          is_recurring: boolean
          month_01: number
          month_02: number
          month_03: number
          month_04: number
          month_05: number
          month_06: number
          month_07: number
          month_08: number
          month_09: number
          month_10: number
          month_11: number
          month_12: number
          premise_description: string | null
          revenue_type: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          budget_version_id: string
          category_id?: string | null
          chart_account_id?: string | null
          clinic_id: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          growth_rate_applied?: number | null
          historical_basis_end_date?: string | null
          historical_basis_start_date?: string | null
          id?: string
          is_locked?: boolean
          is_recurring?: boolean
          month_01?: number
          month_02?: number
          month_03?: number
          month_04?: number
          month_05?: number
          month_06?: number
          month_07?: number
          month_08?: number
          month_09?: number
          month_10?: number
          month_11?: number
          month_12?: number
          premise_description?: string | null
          revenue_type: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          budget_version_id?: string
          category_id?: string | null
          chart_account_id?: string | null
          clinic_id?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          growth_rate_applied?: number | null
          historical_basis_end_date?: string | null
          historical_basis_start_date?: string | null
          id?: string
          is_locked?: boolean
          is_recurring?: boolean
          month_01?: number
          month_02?: number
          month_03?: number
          month_04?: number
          month_05?: number
          month_06?: number
          month_07?: number
          month_08?: number
          month_09?: number
          month_10?: number
          month_11?: number
          month_12?: number
          premise_description?: string | null
          revenue_type?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_budget_revenues_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "union_budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_revenues_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "union_financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_revenues_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "union_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_revenues_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_revenues_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_budget_revenues_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "union_cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      union_budget_versions: {
        Row: {
          budget_exercise_id: string
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          notes: string | null
          version_name: string | null
          version_number: number
        }
        Insert: {
          budget_exercise_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          notes?: string | null
          version_name?: string | null
          version_number?: number
        }
        Update: {
          budget_exercise_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          notes?: string | null
          version_name?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "union_budget_versions_budget_exercise_id_fkey"
            columns: ["budget_exercise_id"]
            isOneToOne: false
            referencedRelation: "union_budget_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      union_cash_flow_history: {
        Row: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          cash_register_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          source: string
          type: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          cash_register_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          source: string
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          cash_register_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          source?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_cash_flow_history_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "union_cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_cash_flow_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_cash_flow_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_cash_registers: {
        Row: {
          account_number: string | null
          agency: string | null
          bank_name: string | null
          clinic_id: string
          created_at: string | null
          current_balance: number | null
          id: string
          initial_balance: number | null
          initial_balance_date: string | null
          is_active: boolean | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          clinic_id: string
          created_at?: string | null
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          initial_balance_date?: string | null
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          clinic_id?: string
          created_at?: string | null
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          initial_balance_date?: string | null
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_cash_registers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_cash_registers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_cash_transfers: {
        Row: {
          amount: number
          check_number: string | null
          clinic_id: string
          conciliated_from_at: string | null
          conciliated_from_by: string | null
          conciliated_to_at: string | null
          conciliated_to_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          from_register_id: string
          id: string
          is_conciliated_from: boolean
          is_conciliated_to: boolean
          source_statement_tx_id_from: string | null
          source_statement_tx_id_to: string | null
          to_register_id: string
          transfer_date: string
        }
        Insert: {
          amount: number
          check_number?: string | null
          clinic_id: string
          conciliated_from_at?: string | null
          conciliated_from_by?: string | null
          conciliated_to_at?: string | null
          conciliated_to_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          from_register_id: string
          id?: string
          is_conciliated_from?: boolean
          is_conciliated_to?: boolean
          source_statement_tx_id_from?: string | null
          source_statement_tx_id_to?: string | null
          to_register_id: string
          transfer_date: string
        }
        Update: {
          amount?: number
          check_number?: string | null
          clinic_id?: string
          conciliated_from_at?: string | null
          conciliated_from_by?: string | null
          conciliated_to_at?: string | null
          conciliated_to_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          from_register_id?: string
          id?: string
          is_conciliated_from?: boolean
          is_conciliated_to?: boolean
          source_statement_tx_id_from?: string | null
          source_statement_tx_id_to?: string | null
          to_register_id?: string
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_cash_transfers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_cash_transfers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_cash_transfers_from_register_id_fkey"
            columns: ["from_register_id"]
            isOneToOne: false
            referencedRelation: "union_cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_cash_transfers_to_register_id_fkey"
            columns: ["to_register_id"]
            isOneToOne: false
            referencedRelation: "union_cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      union_cct_categories: {
        Row: {
          clinic_id: string
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
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
          order_index?: number | null
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
          order_index?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_cct_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_cct_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_chart_of_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string
          clinic_id: string
          created_at: string | null
          deleted_at: string | null
          full_path: string | null
          hierarchy_level: number | null
          id: string
          is_active: boolean | null
          is_synthetic: boolean | null
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: string
          clinic_id: string
          created_at?: string | null
          deleted_at?: string | null
          full_path?: string | null
          hierarchy_level?: number | null
          id?: string
          is_active?: boolean | null
          is_synthetic?: boolean | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string
          clinic_id?: string
          created_at?: string | null
          deleted_at?: string | null
          full_path?: string | null
          hierarchy_level?: number | null
          id?: string
          is_active?: boolean | null
          is_synthetic?: boolean | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_chart_of_accounts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_chart_of_accounts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "union_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      union_convenio_categories: {
        Row: {
          clinic_id: string
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          nome: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_convenio_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_convenio_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_convenios: {
        Row: {
          categoria: string
          category_id: string | null
          clinic_id: string
          created_at: string | null
          desconto: string | null
          descricao: string | null
          detalhes_extras: string | null
          email: string | null
          endereco: string | null
          facebook: string | null
          google_maps_url: string | null
          horario_funcionamento: string | null
          id: string
          image_url: string | null
          instagram: string | null
          is_active: boolean | null
          logo_url: string | null
          nome: string
          order_index: number | null
          street_view_url: string | null
          telefone: string | null
          updated_at: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          categoria: string
          category_id?: string | null
          clinic_id: string
          created_at?: string | null
          desconto?: string | null
          descricao?: string | null
          detalhes_extras?: string | null
          email?: string | null
          endereco?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          horario_funcionamento?: string | null
          id?: string
          image_url?: string | null
          instagram?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          nome: string
          order_index?: number | null
          street_view_url?: string | null
          telefone?: string | null
          updated_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          categoria?: string
          category_id?: string | null
          clinic_id?: string
          created_at?: string | null
          desconto?: string | null
          descricao?: string | null
          detalhes_extras?: string | null
          email?: string | null
          endereco?: string | null
          facebook?: string | null
          google_maps_url?: string | null
          horario_funcionamento?: string | null
          id?: string
          image_url?: string | null
          instagram?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          nome?: string
          order_index?: number | null
          street_view_url?: string | null
          telefone?: string | null
          updated_at?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_convenios_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "union_convenio_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_convenios_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_convenios_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_cost_centers: {
        Row: {
          clinic_id: string
          code: string | null
          created_at: string | null
          description: string | null
          hierarchy_level: number | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          code?: string | null
          created_at?: string | null
          description?: string | null
          hierarchy_level?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          code?: string | null
          created_at?: string | null
          description?: string | null
          hierarchy_level?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_cost_centers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_cost_centers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "union_cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      union_entities: {
        Row: {
          abrangencia:
            | Database["public"]["Enums"]["union_entity_coverage"]
            | null
          allow_duplicate_competence: boolean
          allowed_relationship_types: Json | null
          categoria_laboral: string | null
          cep: string | null
          cidade: string | null
          clinic_id: string | null
          cnpj: string
          created_at: string
          created_by: string | null
          data_ativacao: string | null
          email_contato: string | null
          email_institucional: string
          endereco: string | null
          entity_type: Database["public"]["Enums"]["union_entity_type"]
          estado: string | null
          id: string
          logo_url: string | null
          nome_fantasia: string | null
          plan_id: string | null
          president_name: string | null
          president_signature_url: string | null
          razao_social: string
          responsavel_legal: string | null
          status: Database["public"]["Enums"]["union_entity_status"]
          telefone: string | null
          ultimo_acesso: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          abrangencia?:
            | Database["public"]["Enums"]["union_entity_coverage"]
            | null
          allow_duplicate_competence?: boolean
          allowed_relationship_types?: Json | null
          categoria_laboral?: string | null
          cep?: string | null
          cidade?: string | null
          clinic_id?: string | null
          cnpj: string
          created_at?: string
          created_by?: string | null
          data_ativacao?: string | null
          email_contato?: string | null
          email_institucional: string
          endereco?: string | null
          entity_type?: Database["public"]["Enums"]["union_entity_type"]
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia?: string | null
          plan_id?: string | null
          president_name?: string | null
          president_signature_url?: string | null
          razao_social: string
          responsavel_legal?: string | null
          status?: Database["public"]["Enums"]["union_entity_status"]
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          abrangencia?:
            | Database["public"]["Enums"]["union_entity_coverage"]
            | null
          allow_duplicate_competence?: boolean
          allowed_relationship_types?: Json | null
          categoria_laboral?: string | null
          cep?: string | null
          cidade?: string | null
          clinic_id?: string | null
          cnpj?: string
          created_at?: string
          created_by?: string | null
          data_ativacao?: string | null
          email_contato?: string | null
          email_institucional?: string
          endereco?: string | null
          entity_type?: Database["public"]["Enums"]["union_entity_type"]
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia?: string | null
          plan_id?: string | null
          president_name?: string | null
          president_signature_url?: string | null
          razao_social?: string
          responsavel_legal?: string | null
          status?: Database["public"]["Enums"]["union_entity_status"]
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_entities_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_entities_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_entities_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      union_financial_categories: {
        Row: {
          clinic_id: string
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_financial_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_financial_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "union_financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      union_financial_transactions: {
        Row: {
          amount: number
          cash_register_id: string | null
          category_id: string | null
          check_number: string | null
          clinic_id: string
          conciliated_at: string | null
          conciliated_by: string | null
          contribution_id: string | null
          cost_center_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          discount_value: number | null
          document_number: string | null
          document_type: string | null
          due_date: string | null
          employer_id: string | null
          fine_value: number | null
          gross_value: number | null
          id: string
          interest_value: number | null
          is_conciliated: boolean | null
          net_value: number | null
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          recurrence_source_id: string | null
          recurrence_type: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          source_statement_tx_id: string | null
          status: string | null
          supplier_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          cash_register_id?: string | null
          category_id?: string | null
          check_number?: string | null
          clinic_id: string
          conciliated_at?: string | null
          conciliated_by?: string | null
          contribution_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          discount_value?: number | null
          document_number?: string | null
          document_type?: string | null
          due_date?: string | null
          employer_id?: string | null
          fine_value?: number | null
          gross_value?: number | null
          id?: string
          interest_value?: number | null
          is_conciliated?: boolean | null
          net_value?: number | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          recurrence_source_id?: string | null
          recurrence_type?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_statement_tx_id?: string | null
          status?: string | null
          supplier_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          cash_register_id?: string | null
          category_id?: string | null
          check_number?: string | null
          clinic_id?: string
          conciliated_at?: string | null
          conciliated_by?: string | null
          contribution_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          discount_value?: number | null
          document_number?: string | null
          document_type?: string | null
          due_date?: string | null
          employer_id?: string | null
          fine_value?: number | null
          gross_value?: number | null
          id?: string
          interest_value?: number | null
          is_conciliated?: boolean | null
          net_value?: number | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          recurrence_source_id?: string | null
          recurrence_type?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_statement_tx_id?: string | null
          status?: string | null
          supplier_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_financial_transactions_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "union_cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "union_financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_financial_transactions_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "employer_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_financial_transactions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "union_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_financial_transactions_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_financial_transactions_recurrence_source_id_fkey"
            columns: ["recurrence_source_id"]
            isOneToOne: false
            referencedRelation: "union_financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_financial_transactions_source_statement_tx_id_fkey"
            columns: ["source_statement_tx_id"]
            isOneToOne: false
            referencedRelation: "union_bank_statement_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_financial_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "union_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      union_law_firms: {
        Row: {
          address: string | null
          cep: string | null
          city: string | null
          clinic_id: string
          cnpj: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          contract_value: number | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          oab_number: string | null
          payment_type: string | null
          phone: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city?: string | null
          clinic_id: string
          cnpj?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          oab_number?: string | null
          payment_type?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string | null
          clinic_id?: string
          cnpj?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          oab_number?: string | null
          payment_type?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_law_firms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_law_firms_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_lawyers: {
        Row: {
          clinic_id: string
          cpf: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          is_internal: boolean | null
          law_firm_id: string | null
          name: string
          notes: string | null
          oab_number: string
          oab_state: string
          phone: string | null
          specialty: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_internal?: boolean | null
          law_firm_id?: string | null
          name: string
          notes?: string | null
          oab_number: string
          oab_state: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_internal?: boolean | null
          law_firm_id?: string | null
          name?: string
          notes?: string | null
          oab_number?: string
          oab_state?: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_lawyers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_lawyers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_lawyers_law_firm_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "union_law_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      union_legal_audit_logs: {
        Row: {
          action: string
          clinic_id: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          performed_at: string | null
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          clinic_id: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          clinic_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_legal_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      union_legal_case_documents: {
        Row: {
          description: string | null
          document_type: string
          event_id: string | null
          external_url: string | null
          file_size: number | null
          file_type: string | null
          id: string
          legal_case_id: string
          name: string
          storage_path: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          description?: string | null
          document_type: string
          event_id?: string | null
          external_url?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          legal_case_id: string
          name: string
          storage_path?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          description?: string | null
          document_type?: string
          event_id?: string | null
          external_url?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          legal_case_id?: string
          name?: string
          storage_path?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_legal_case_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "union_legal_case_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_case_documents_legal_case_id_fkey"
            columns: ["legal_case_id"]
            isOneToOne: false
            referencedRelation: "union_legal_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      union_legal_case_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          event_date: string
          event_type: string
          id: string
          is_milestone: boolean | null
          legal_case_id: string
          phase: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_type: string
          id?: string
          is_milestone?: boolean | null
          legal_case_id: string
          phase?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          is_milestone?: boolean | null
          legal_case_id?: string
          phase?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_legal_case_events_legal_case_id_fkey"
            columns: ["legal_case_id"]
            isOneToOne: false
            referencedRelation: "union_legal_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      union_legal_case_parties: {
        Row: {
          created_at: string | null
          document: string | null
          document_type: string | null
          id: string
          is_union: boolean | null
          legal_case_id: string
          name: string
          party_type: string
          role_description: string | null
        }
        Insert: {
          created_at?: string | null
          document?: string | null
          document_type?: string | null
          id?: string
          is_union?: boolean | null
          legal_case_id: string
          name: string
          party_type: string
          role_description?: string | null
        }
        Update: {
          created_at?: string | null
          document?: string | null
          document_type?: string | null
          id?: string
          is_union?: boolean | null
          legal_case_id?: string
          name?: string
          party_type?: string
          role_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_legal_case_parties_legal_case_id_fkey"
            columns: ["legal_case_id"]
            isOneToOne: false
            referencedRelation: "union_legal_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      union_legal_cases: {
        Row: {
          case_number: string
          case_type: Database["public"]["Enums"]["legal_case_type"]
          cause_value: number | null
          clinic_id: string
          closure_date: string | null
          closure_reason: string | null
          court: string | null
          created_at: string | null
          created_by: string | null
          defendant: string
          defendant_document: string | null
          description: string | null
          employer_id: string | null
          estimated_liability: number | null
          external_reference: string | null
          filing_date: string | null
          id: string
          instance: string | null
          jurisdiction: string | null
          last_update_date: string | null
          law_firm_id: string | null
          lawyer_id: string | null
          member_id: string | null
          notes: string | null
          plaintiff: string
          plaintiff_document: string | null
          priority: number | null
          risk_level: Database["public"]["Enums"]["legal_risk_level"] | null
          risk_notes: string | null
          service_date: string | null
          status: Database["public"]["Enums"]["legal_case_status"] | null
          subject: string
          tags: string[] | null
          tribunal: string | null
          union_role: string
          updated_at: string | null
        }
        Insert: {
          case_number: string
          case_type?: Database["public"]["Enums"]["legal_case_type"]
          cause_value?: number | null
          clinic_id: string
          closure_date?: string | null
          closure_reason?: string | null
          court?: string | null
          created_at?: string | null
          created_by?: string | null
          defendant: string
          defendant_document?: string | null
          description?: string | null
          employer_id?: string | null
          estimated_liability?: number | null
          external_reference?: string | null
          filing_date?: string | null
          id?: string
          instance?: string | null
          jurisdiction?: string | null
          last_update_date?: string | null
          law_firm_id?: string | null
          lawyer_id?: string | null
          member_id?: string | null
          notes?: string | null
          plaintiff: string
          plaintiff_document?: string | null
          priority?: number | null
          risk_level?: Database["public"]["Enums"]["legal_risk_level"] | null
          risk_notes?: string | null
          service_date?: string | null
          status?: Database["public"]["Enums"]["legal_case_status"] | null
          subject: string
          tags?: string[] | null
          tribunal?: string | null
          union_role?: string
          updated_at?: string | null
        }
        Update: {
          case_number?: string
          case_type?: Database["public"]["Enums"]["legal_case_type"]
          cause_value?: number | null
          clinic_id?: string
          closure_date?: string | null
          closure_reason?: string | null
          court?: string | null
          created_at?: string | null
          created_by?: string | null
          defendant?: string
          defendant_document?: string | null
          description?: string | null
          employer_id?: string | null
          estimated_liability?: number | null
          external_reference?: string | null
          filing_date?: string | null
          id?: string
          instance?: string | null
          jurisdiction?: string | null
          last_update_date?: string | null
          law_firm_id?: string | null
          lawyer_id?: string | null
          member_id?: string | null
          notes?: string | null
          plaintiff?: string
          plaintiff_document?: string | null
          priority?: number | null
          risk_level?: Database["public"]["Enums"]["legal_risk_level"] | null
          risk_notes?: string | null
          service_date?: string | null
          status?: Database["public"]["Enums"]["legal_case_status"] | null
          subject?: string
          tags?: string[] | null
          tribunal?: string | null
          union_role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_legal_cases_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_cases_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_cases_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_cases_law_firm_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "union_law_firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_cases_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "union_lawyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_cases_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "sindical_associados"
            referencedColumns: ["id"]
          },
        ]
      }
      union_legal_deadline_alerts: {
        Row: {
          alert_type: string
          days_before: number | null
          deadline_id: string
          error_message: string | null
          id: string
          sent_at: string | null
          sent_to: string | null
          success: boolean | null
        }
        Insert: {
          alert_type: string
          days_before?: number | null
          deadline_id: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          sent_to?: string | null
          success?: boolean | null
        }
        Update: {
          alert_type?: string
          days_before?: number | null
          deadline_id?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          sent_to?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "union_legal_deadline_alerts_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "union_legal_deadlines"
            referencedColumns: ["id"]
          },
        ]
      }
      union_legal_deadlines: {
        Row: {
          alert_days_before: number[] | null
          clinic_id: string
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          created_at: string | null
          created_by: string | null
          criticality:
            | Database["public"]["Enums"]["deadline_criticality"]
            | null
          deadline_date: string
          deadline_time: string | null
          description: string | null
          id: string
          last_alert_sent_at: string | null
          legal_case_id: string
          missed_reason: string | null
          responsible_lawyer_id: string | null
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["deadline_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          alert_days_before?: number[] | null
          clinic_id: string
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          criticality?:
            | Database["public"]["Enums"]["deadline_criticality"]
            | null
          deadline_date: string
          deadline_time?: string | null
          description?: string | null
          id?: string
          last_alert_sent_at?: string | null
          legal_case_id: string
          missed_reason?: string | null
          responsible_lawyer_id?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["deadline_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          alert_days_before?: number[] | null
          clinic_id?: string
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          criticality?:
            | Database["public"]["Enums"]["deadline_criticality"]
            | null
          deadline_date?: string
          deadline_time?: string | null
          description?: string | null
          id?: string
          last_alert_sent_at?: string | null
          legal_case_id?: string
          missed_reason?: string | null
          responsible_lawyer_id?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["deadline_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_legal_deadlines_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_deadlines_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_deadlines_legal_case_id_fkey"
            columns: ["legal_case_id"]
            isOneToOne: false
            referencedRelation: "union_legal_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_deadlines_responsible_lawyer_id_fkey"
            columns: ["responsible_lawyer_id"]
            isOneToOne: false
            referencedRelation: "union_lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      union_legal_expenses: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string | null
          created_by: string | null
          description: string
          document_number: string | null
          expense_date: string
          expense_type: string
          financial_transaction_id: string | null
          id: string
          is_paid: boolean | null
          law_firm_id: string | null
          lawyer_id: string | null
          legal_case_id: string | null
          notes: string | null
          paid_at: string | null
          payment_reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          description: string
          document_number?: string | null
          expense_date: string
          expense_type: string
          financial_transaction_id?: string | null
          id?: string
          is_paid?: boolean | null
          law_firm_id?: string | null
          lawyer_id?: string | null
          legal_case_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          document_number?: string | null
          expense_date?: string
          expense_type?: string
          financial_transaction_id?: string | null
          id?: string
          is_paid?: boolean | null
          law_firm_id?: string | null
          lawyer_id?: string | null
          legal_case_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_legal_expenses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_expenses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_expenses_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "union_financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_expenses_law_firm_id_fkey"
            columns: ["law_firm_id"]
            isOneToOne: false
            referencedRelation: "union_law_firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_expenses_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "union_lawyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_expenses_legal_case_id_fkey"
            columns: ["legal_case_id"]
            isOneToOne: false
            referencedRelation: "union_legal_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      union_legal_provisions: {
        Row: {
          amount: number
          calculated_amount: number | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_current: boolean | null
          legal_case_id: string
          probability_percentage: number | null
          provision_date: string
          reason: string | null
          review_date: string | null
        }
        Insert: {
          amount: number
          calculated_amount?: number | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_current?: boolean | null
          legal_case_id: string
          probability_percentage?: number | null
          provision_date: string
          reason?: string | null
          review_date?: string | null
        }
        Update: {
          amount?: number
          calculated_amount?: number | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_current?: boolean | null
          legal_case_id?: string
          probability_percentage?: number | null
          provision_date?: string
          reason?: string | null
          review_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_legal_provisions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_provisions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_legal_provisions_legal_case_id_fkey"
            columns: ["legal_case_id"]
            isOneToOne: false
            referencedRelation: "union_legal_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      union_member_audit_logs: {
        Row: {
          action: string
          clinic_id: string
          id: string
          module_origin: string | null
          new_values: Json | null
          old_values: Json | null
          patient_id: string
          performed_at: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          clinic_id: string
          id?: string
          module_origin?: string | null
          new_values?: Json | null
          old_values?: Json | null
          patient_id: string
          performed_at?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          clinic_id?: string
          id?: string
          module_origin?: string | null
          new_values?: Json | null
          old_values?: Json | null
          patient_id?: string
          performed_at?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_member_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_member_audit_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_member_audit_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      union_payment_history: {
        Row: {
          bank_account: string | null
          chart_of_accounts: string | null
          check_number: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          entity_id: string | null
          gross_value: number | null
          id: string
          imported_at: string | null
          net_value: number | null
          operational_unit: string | null
          paid_at: string | null
          status: string | null
          supplier_id: string | null
          supplier_name: string
        }
        Insert: {
          bank_account?: string | null
          chart_of_accounts?: string | null
          check_number?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          gross_value?: number | null
          id?: string
          imported_at?: string | null
          net_value?: number | null
          operational_unit?: string | null
          paid_at?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_name: string
        }
        Update: {
          bank_account?: string | null
          chart_of_accounts?: string | null
          check_number?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          gross_value?: number | null
          id?: string
          imported_at?: string | null
          net_value?: number | null
          operational_unit?: string | null
          paid_at?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_payment_history_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "union_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_payment_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "union_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      union_president_signatures: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          president_cpf: string | null
          president_name: string
          president_title: string | null
          signature_data: string | null
          signature_url: string | null
          union_entity_id: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          president_cpf?: string | null
          president_name: string
          president_title?: string | null
          signature_data?: string | null
          signature_url?: string | null
          union_entity_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          president_cpf?: string | null
          president_name?: string
          president_title?: string | null
          signature_data?: string | null
          signature_url?: string | null
          union_entity_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_president_signatures_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_president_signatures_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_president_signatures_union_entity_id_fkey"
            columns: ["union_entity_id"]
            isOneToOne: false
            referencedRelation: "union_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      union_share_logs: {
        Row: {
          clinic_id: string | null
          created_at: string
          id: string
          message_sent: string | null
          phone_number: string
          sent_at: string
          status: string
          union_entity_id: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          message_sent?: string | null
          phone_number: string
          sent_at?: string
          status?: string
          union_entity_id: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          message_sent?: string | null
          phone_number?: string
          sent_at?: string
          status?: string
          union_entity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "union_share_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_share_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_share_logs_union_entity_id_fkey"
            columns: ["union_entity_id"]
            isOneToOne: false
            referencedRelation: "union_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      union_supplier_defaults: {
        Row: {
          category_id: string | null
          clinic_id: string
          created_at: string | null
          default_value: number | null
          description: string
          id: string
          is_active: boolean | null
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          clinic_id: string
          created_at?: string | null
          default_value?: number | null
          description: string
          id?: string
          is_active?: boolean | null
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          clinic_id?: string
          created_at?: string | null
          default_value?: number | null
          description?: string
          id?: string
          is_active?: boolean | null
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_supplier_defaults_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "union_financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_supplier_defaults_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_supplier_defaults_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_supplier_defaults_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "union_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      union_suppliers: {
        Row: {
          address: string | null
          city: string | null
          clinic_id: string
          cnpj: string | null
          contact_name: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          trade_name: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          clinic_id: string
          cnpj?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          clinic_id?: string
          cnpj?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "union_suppliers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "union_suppliers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "upgrade_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      user_active_sessions: {
        Row: {
          clinic_id: string
          device_info: string | null
          id: string
          invalidated_at: string | null
          invalidated_reason: string | null
          ip_address: string | null
          is_active: boolean
          last_seen_at: string
          logged_in_at: string
          session_token: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          device_info?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          ip_address?: string | null
          is_active?: boolean
          last_seen_at?: string
          logged_in_at?: string
          session_token: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          device_info?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          ip_address?: string | null
          is_active?: boolean
          last_seen_at?: string
          logged_in_at?: string
          session_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_active_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          access_group_id: string | null
          clinic_id: string | null
          created_at: string
          id: string
          professional_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          access_group_id?: string | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          professional_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          access_group_id?: string | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          professional_id?: string | null
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
          {
            foreignKeyName: "user_roles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings_widgets: {
        Row: {
          clinic_id: string
          created_at: string
          hidden_widgets: Json
          id: string
          updated_at: string
          user_id: string
          widget_order: Json
        }
        Insert: {
          clinic_id: string
          created_at?: string
          hidden_widgets?: Json
          id?: string
          updated_at?: string
          user_id: string
          widget_order?: Json
        }
        Update: {
          clinic_id?: string
          created_at?: string
          hidden_widgets?: Json
          id?: string
          updated_at?: string
          user_id?: string
          widget_order?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_widgets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_settings_widgets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      waiting_list: {
        Row: {
          clinic_id: string
          confirmed_at: string | null
          created_at: string
          entered_at: string
          id: string
          is_active: boolean | null
          notes: string | null
          notification_sent: boolean | null
          notification_sent_at: string | null
          notification_status: string | null
          notified_at: string | null
          offered_appointment_date: string | null
          offered_appointment_time: string | null
          offered_professional_id: string | null
          offered_professional_name: string | null
          patient_id: string
          preferred_dates: string[] | null
          preferred_times: string[] | null
          professional_id: string | null
          queue_id: string | null
          queue_position: number | null
          queue_status: string
          skipped_at: string | null
          skipped_by: string | null
          slot_expires_at: string | null
          slot_offered_at: string | null
          source: string
          specialty_id: string | null
          ticket_number: number | null
          ticket_prefix: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          confirmed_at?: string | null
          created_at?: string
          entered_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          notification_status?: string | null
          notified_at?: string | null
          offered_appointment_date?: string | null
          offered_appointment_time?: string | null
          offered_professional_id?: string | null
          offered_professional_name?: string | null
          patient_id: string
          preferred_dates?: string[] | null
          preferred_times?: string[] | null
          professional_id?: string | null
          queue_id?: string | null
          queue_position?: number | null
          queue_status?: string
          skipped_at?: string | null
          skipped_by?: string | null
          slot_expires_at?: string | null
          slot_offered_at?: string | null
          source?: string
          specialty_id?: string | null
          ticket_number?: number | null
          ticket_prefix?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          confirmed_at?: string | null
          created_at?: string
          entered_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          notification_status?: string | null
          notified_at?: string | null
          offered_appointment_date?: string | null
          offered_appointment_time?: string | null
          offered_professional_id?: string | null
          offered_professional_name?: string | null
          patient_id?: string
          preferred_dates?: string[] | null
          preferred_times?: string[] | null
          professional_id?: string | null
          queue_id?: string | null
          queue_position?: number | null
          queue_status?: string
          skipped_at?: string | null
          skipped_by?: string | null
          slot_expires_at?: string | null
          slot_offered_at?: string | null
          source?: string
          specialty_id?: string | null
          ticket_number?: number | null
          ticket_prefix?: string | null
          updated_at?: string
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
            foreignKeyName: "waiting_list_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_offered_professional_id_fkey"
            columns: ["offered_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_offered_professional_id_fkey"
            columns: ["offered_professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
            foreignKeyName: "waiting_list_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
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
      waiting_list_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          clinic_id: string
          created_at: string
          details: Json
          id: string
          offer_id: string | null
          patient_id: string | null
          professional_id: string | null
          waiting_list_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          clinic_id: string
          created_at?: string
          details?: Json
          id?: string
          offer_id?: string | null
          patient_id?: string | null
          professional_id?: string | null
          waiting_list_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          clinic_id?: string
          created_at?: string
          details?: Json
          id?: string
          offer_id?: string | null
          patient_id?: string | null
          professional_id?: string | null
          waiting_list_id?: string | null
        }
        Relationships: []
      }
      waiting_list_offers: {
        Row: {
          appointment_date: string
          cancelled_appointment_id: string | null
          clinic_id: string
          created_appointment_id: string | null
          created_at: string
          end_time: string
          expires_at: string
          id: string
          offered_at: string
          patient_id: string
          professional_id: string
          responded_at: string | null
          start_time: string
          status: string
          updated_at: string
          waiting_list_id: string
        }
        Insert: {
          appointment_date: string
          cancelled_appointment_id?: string | null
          clinic_id: string
          created_appointment_id?: string | null
          created_at?: string
          end_time: string
          expires_at: string
          id?: string
          offered_at?: string
          patient_id: string
          professional_id: string
          responded_at?: string | null
          start_time: string
          status?: string
          updated_at?: string
          waiting_list_id: string
        }
        Update: {
          appointment_date?: string
          cancelled_appointment_id?: string | null
          clinic_id?: string
          created_appointment_id?: string | null
          created_at?: string
          end_time?: string
          expires_at?: string
          id?: string
          offered_at?: string
          patient_id?: string
          professional_id?: string
          responded_at?: string | null
          start_time?: string
          status?: string
          updated_at?: string
          waiting_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_offers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_offers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_offers_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_offers_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_offers_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_list_offers_waiting_list_id_fkey"
            columns: ["waiting_list_id"]
            isOneToOne: false
            referencedRelation: "waiting_list"
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
          {
            foreignKeyName: "webhooks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_ai_conversations: {
        Row: {
          clinic_id: string
          created_at: string
          expires_at: string
          id: string
          messages: Json
          patient_id: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          expires_at?: string
          id?: string
          messages?: Json
          patient_id?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          messages?: Json
          patient_id?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_conversations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_ai_conversations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_ai_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_audit_logs: {
        Row: {
          button_id: string | null
          content: string | null
          created_at: string
          direction: string
          id: string
          message_type: string | null
          metadata: Json | null
          phone: string
          session_state: string | null
        }
        Insert: {
          button_id?: string | null
          content?: string | null
          created_at?: string
          direction: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          phone: string
          session_state?: string | null
        }
        Update: {
          button_id?: string | null
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          phone?: string
          session_state?: string | null
        }
        Relationships: []
      }
      whatsapp_boleto_logs: {
        Row: {
          action: string
          clinic_id: string
          contribution_id: string | null
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          lytex_request: Json | null
          lytex_response: Json | null
          phone: string
          session_id: string | null
          success: boolean
        }
        Insert: {
          action: string
          clinic_id: string
          contribution_id?: string | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          lytex_request?: Json | null
          lytex_response?: Json | null
          phone: string
          session_id?: string | null
          success?: boolean
        }
        Update: {
          action?: string
          clinic_id?: string
          contribution_id?: string | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          lytex_request?: Json | null
          lytex_response?: Json | null
          phone?: string
          session_id?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_boleto_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_boleto_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_boleto_logs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "employer_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_boleto_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_boleto_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_boleto_sessions: {
        Row: {
          available_contributions: Json | null
          boleto_type: string | null
          build_version: string | null
          clinic_id: string
          competence_month: number | null
          competence_year: number | null
          contribution_id: string | null
          contribution_type_id: string | null
          created_at: string
          employer_cnpj: string | null
          employer_id: string | null
          employer_name: string | null
          expires_at: string
          flow_context: Json | null
          id: string
          last_raw_payload: Json | null
          last_webhook_handler: string | null
          new_due_date: string | null
          phone: string
          state: string
          updated_at: string
          value_cents: number | null
        }
        Insert: {
          available_contributions?: Json | null
          boleto_type?: string | null
          build_version?: string | null
          clinic_id: string
          competence_month?: number | null
          competence_year?: number | null
          contribution_id?: string | null
          contribution_type_id?: string | null
          created_at?: string
          employer_cnpj?: string | null
          employer_id?: string | null
          employer_name?: string | null
          expires_at?: string
          flow_context?: Json | null
          id?: string
          last_raw_payload?: Json | null
          last_webhook_handler?: string | null
          new_due_date?: string | null
          phone: string
          state?: string
          updated_at?: string
          value_cents?: number | null
        }
        Update: {
          available_contributions?: Json | null
          boleto_type?: string | null
          build_version?: string | null
          clinic_id?: string
          competence_month?: number | null
          competence_year?: number | null
          contribution_id?: string | null
          contribution_type_id?: string | null
          created_at?: string
          employer_cnpj?: string | null
          employer_id?: string | null
          employer_name?: string | null
          expires_at?: string
          flow_context?: Json | null
          id?: string
          last_raw_payload?: Json | null
          last_webhook_handler?: string | null
          new_due_date?: string | null
          phone?: string
          state?: string
          updated_at?: string
          value_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_boleto_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_boleto_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_boleto_sessions_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "employer_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_boleto_sessions_contribution_type_id_fkey"
            columns: ["contribution_type_id"]
            isOneToOne: false
            referencedRelation: "contribution_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_boleto_sessions_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_booking_sessions: {
        Row: {
          action_type: string | null
          appointments_list: Json | null
          available_dates: Json | null
          available_dependents: Json | null
          available_insurance_plans: Json | null
          available_procedures: Json | null
          available_professionals: Json | null
          available_times: Json | null
          booking_for: string | null
          clinic_id: string
          created_at: string | null
          expires_at: string
          id: string
          is_dependent_direct_booking: boolean
          list_action: string | null
          patient_id: string | null
          patient_name: string | null
          pending_appointments: Json | null
          pending_registration_birthdate: string | null
          pending_registration_cnpj: string | null
          pending_registration_cpf: string | null
          pending_registration_insurance_plan_id: string | null
          pending_registration_name: string | null
          pending_registration_relationship: string | null
          pending_registration_titular_cpf: string | null
          pending_registration_type: string | null
          phone: string
          selected_appointment_id: string | null
          selected_date: string | null
          selected_dependent_id: string | null
          selected_dependent_name: string | null
          selected_procedure_id: string | null
          selected_professional_id: string | null
          selected_professional_name: string | null
          selected_time: string | null
          state: string
          updated_at: string | null
        }
        Insert: {
          action_type?: string | null
          appointments_list?: Json | null
          available_dates?: Json | null
          available_dependents?: Json | null
          available_insurance_plans?: Json | null
          available_procedures?: Json | null
          available_professionals?: Json | null
          available_times?: Json | null
          booking_for?: string | null
          clinic_id: string
          created_at?: string | null
          expires_at?: string
          id?: string
          is_dependent_direct_booking?: boolean
          list_action?: string | null
          patient_id?: string | null
          patient_name?: string | null
          pending_appointments?: Json | null
          pending_registration_birthdate?: string | null
          pending_registration_cnpj?: string | null
          pending_registration_cpf?: string | null
          pending_registration_insurance_plan_id?: string | null
          pending_registration_name?: string | null
          pending_registration_relationship?: string | null
          pending_registration_titular_cpf?: string | null
          pending_registration_type?: string | null
          phone: string
          selected_appointment_id?: string | null
          selected_date?: string | null
          selected_dependent_id?: string | null
          selected_dependent_name?: string | null
          selected_procedure_id?: string | null
          selected_professional_id?: string | null
          selected_professional_name?: string | null
          selected_time?: string | null
          state?: string
          updated_at?: string | null
        }
        Update: {
          action_type?: string | null
          appointments_list?: Json | null
          available_dates?: Json | null
          available_dependents?: Json | null
          available_insurance_plans?: Json | null
          available_procedures?: Json | null
          available_professionals?: Json | null
          available_times?: Json | null
          booking_for?: string | null
          clinic_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          is_dependent_direct_booking?: boolean
          list_action?: string | null
          patient_id?: string | null
          patient_name?: string | null
          pending_appointments?: Json | null
          pending_registration_birthdate?: string | null
          pending_registration_cnpj?: string | null
          pending_registration_cpf?: string | null
          pending_registration_insurance_plan_id?: string | null
          pending_registration_name?: string | null
          pending_registration_relationship?: string | null
          pending_registration_titular_cpf?: string | null
          pending_registration_type?: string | null
          phone?: string
          selected_appointment_id?: string | null
          selected_date?: string | null
          selected_dependent_id?: string | null
          selected_dependent_name?: string | null
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
            foreignKeyName: "whatsapp_booking_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
          {
            foreignKeyName: "whatsapp_booking_sessions_selected_professional_id_fkey"
            columns: ["selected_professional_id"]
            isOneToOne: false
            referencedRelation: "public_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_compliance_logs: {
        Row: {
          chatwoot_message_id: string | null
          click_message_id: string | null
          conversation_id: string | null
          created_at: string | null
          decision: string | null
          id: string
          intent: string | null
          metadata: Json | null
          patient_id: string | null
          window_status: string | null
        }
        Insert: {
          chatwoot_message_id?: string | null
          click_message_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          decision?: string | null
          id?: string
          intent?: string | null
          metadata?: Json | null
          patient_id?: string | null
          window_status?: string | null
        }
        Update: {
          chatwoot_message_id?: string | null
          click_message_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          decision?: string | null
          id?: string
          intent?: string | null
          metadata?: Json | null
          patient_id?: string | null
          window_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_compliance_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_consents: {
        Row: {
          consent_status: string
          consent_text: string
          created_at: string
          id: string
          ip_address: string | null
          name: string | null
          person_id: string | null
          phone: string
          purpose: string
          revoked_at: string | null
          revoked_reason: string | null
          source: string
          tenant_id: string | null
          term_version: string
          user_agent: string | null
        }
        Insert: {
          consent_status?: string
          consent_text: string
          created_at?: string
          id?: string
          ip_address?: string | null
          name?: string | null
          person_id?: string | null
          phone: string
          purpose: string
          revoked_at?: string | null
          revoked_reason?: string | null
          source: string
          tenant_id?: string | null
          term_version: string
          user_agent?: string | null
        }
        Update: {
          consent_status?: string
          consent_text?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          name?: string | null
          person_id?: string | null
          phone?: string
          purpose?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          source?: string
          tenant_id?: string | null
          term_version?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      whatsapp_contacts: {
        Row: {
          clinic_id: string
          created_at: string | null
          email: string | null
          id: string
          metadata: Json | null
          name: string | null
          patient_id: string | null
          phone: string
          profile_pic_url: string | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          patient_id?: string | null
          phone: string
          profile_pic_url?: string | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          patient_id?: string | null
          phone?: string
          profile_pic_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_events: {
        Row: {
          block_reason: string | null
          clinic_id: string
          created_at: string
          deduplication_key: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          patient_id: string | null
          payload: Json
          processed_at: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          block_reason?: string | null
          clinic_id: string
          created_at?: string
          deduplication_key: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          patient_id?: string | null
          payload?: Json
          processed_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          block_reason?: string | null
          clinic_id?: string
          created_at?: string
          deduplication_key?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          patient_id?: string | null
          payload?: Json
          processed_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inbound_decisions: {
        Row: {
          canonical_string: string | null
          clinic_id: string | null
          created_at: string | null
          decision: string
          id: string
          inbound_event: string
          integration_id: string | null
          nonce: string | null
          patient_id: string | null
          payload: Json | null
          phone: string
          reason_code: string | null
          request_id: string | null
          signature: string | null
        }
        Insert: {
          canonical_string?: string | null
          clinic_id?: string | null
          created_at?: string | null
          decision: string
          id?: string
          inbound_event: string
          integration_id?: string | null
          nonce?: string | null
          patient_id?: string | null
          payload?: Json | null
          phone: string
          reason_code?: string | null
          request_id?: string | null
          signature?: string | null
        }
        Update: {
          canonical_string?: string | null
          clinic_id?: string | null
          created_at?: string | null
          decision?: string
          id?: string
          inbound_event?: string
          integration_id?: string | null
          nonce?: string | null
          patient_id?: string | null
          payload?: Json | null
          phone?: string
          reason_code?: string | null
          request_id?: string | null
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_decisions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_decisions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_decisions_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_decisions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inbound_nonces: {
        Row: {
          api_key_id: string
          clinic_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          integration_id: string | null
          nonce: string
          request_timestamp: string
        }
        Insert: {
          api_key_id: string
          clinic_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          integration_id?: string | null
          nonce: string
          request_timestamp: string
        }
        Update: {
          api_key_id?: string
          clinic_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          integration_id?: string | null
          nonce?: string
          request_timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_nonces_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_integrations"
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
            foreignKeyName: "whatsapp_incoming_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
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
      whatsapp_integration_credentials: {
        Row: {
          api_key_hash: string
          api_key_id: string
          clinic_id: string
          created_at: string
          dry_run: boolean
          hmac_secret: string
          id: string
          instance_id: string | null
          integration: string
          is_active: boolean
          last_used_at: string | null
          notes: string | null
          phone_number_id: string | null
          rate_limit_per_minute: number
          updated_at: string
        }
        Insert: {
          api_key_hash: string
          api_key_id: string
          clinic_id: string
          created_at?: string
          dry_run?: boolean
          hmac_secret: string
          id?: string
          instance_id?: string | null
          integration?: string
          is_active?: boolean
          last_used_at?: string | null
          notes?: string | null
          phone_number_id?: string | null
          rate_limit_per_minute?: number
          updated_at?: string
        }
        Update: {
          api_key_hash?: string
          api_key_id?: string
          clinic_id?: string
          created_at?: string
          dry_run?: boolean
          hmac_secret?: string
          id?: string
          instance_id?: string | null
          integration?: string
          is_active?: boolean
          last_used_at?: string | null
          notes?: string | null
          phone_number_id?: string | null
          rate_limit_per_minute?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_integration_credentials_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_integration_credentials_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_integrations: {
        Row: {
          api_key_hash: string
          clinic_id: string
          created_at: string | null
          hmac_secret_vault_key: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          api_key_hash: string
          clinic_id: string
          created_at?: string | null
          hmac_secret_vault_key: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          api_key_hash?: string
          clinic_id?: string
          created_at?: string | null
          hmac_secret_vault_key?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_integrations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_integrations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_status: {
        Row: {
          created_at: string
          error_code: string | null
          error_details: string | null
          error_title: string | null
          id: string
          raw: Json | null
          recipient_id: string | null
          status: string | null
          timestamp_meta: string | null
          wamid: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_details?: string | null
          error_title?: string | null
          id?: string
          raw?: Json | null
          recipient_id?: string | null
          status?: string | null
          timestamp_meta?: string | null
          wamid?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_details?: string | null
          error_title?: string | null
          id?: string
          raw?: Json | null
          recipient_id?: string | null
          status?: string | null
          timestamp_meta?: string | null
          wamid?: string | null
        }
        Relationships: []
      }
      whatsapp_meta_templates: {
        Row: {
          category: string
          components: Json
          created_at: string
          deprecated_at: string | null
          deprecation_reason: string | null
          id: string
          language: string
          last_synced_at: string
          meta_template_id: string | null
          name: string
          quality_score: string | null
          raw_payload: Json | null
          rejection_reason: string | null
          status: string
          updated_at: string
          variables_count: number
        }
        Insert: {
          category: string
          components?: Json
          created_at?: string
          deprecated_at?: string | null
          deprecation_reason?: string | null
          id?: string
          language?: string
          last_synced_at?: string
          meta_template_id?: string | null
          name: string
          quality_score?: string | null
          raw_payload?: Json | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          variables_count?: number
        }
        Update: {
          category?: string
          components?: Json
          created_at?: string
          deprecated_at?: string | null
          deprecation_reason?: string | null
          id?: string
          language?: string
          last_synced_at?: string
          meta_template_id?: string | null
          name?: string
          quality_score?: string | null
          raw_payload?: Json | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          variables_count?: number
        }
        Relationships: []
      }
      whatsapp_module_settings: {
        Row: {
          auto_assign: boolean | null
          away_message: string | null
          clinic_id: string
          closed_message: string | null
          created_at: string | null
          id: string
          max_idle_time_minutes: number | null
          updated_at: string | null
          welcome_message: string | null
          working_hours: Json | null
        }
        Insert: {
          auto_assign?: boolean | null
          away_message?: string | null
          clinic_id: string
          closed_message?: string | null
          created_at?: string | null
          id?: string
          max_idle_time_minutes?: number | null
          updated_at?: string | null
          welcome_message?: string | null
          working_hours?: Json | null
        }
        Update: {
          auto_assign?: boolean | null
          away_message?: string | null
          clinic_id?: string
          closed_message?: string | null
          created_at?: string | null
          id?: string
          max_idle_time_minutes?: number | null
          updated_at?: string | null
          welcome_message?: string | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_module_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_module_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_one_shot_authorizations: {
        Row: {
          authorized_by: string | null
          clinic_id: string | null
          cpf: string
          created_at: string | null
          expires_at: string
          id: string
          idempotency_key: string
          patient_id: string | null
          phone: string
          result_payload: Json | null
          status: Database["public"]["Enums"]["whatsapp_one_shot_status"] | null
          template_language: string | null
          template_name: string
          updated_at: string | null
          used_at: string | null
        }
        Insert: {
          authorized_by?: string | null
          clinic_id?: string | null
          cpf: string
          created_at?: string | null
          expires_at?: string
          id?: string
          idempotency_key: string
          patient_id?: string | null
          phone: string
          result_payload?: Json | null
          status?:
            | Database["public"]["Enums"]["whatsapp_one_shot_status"]
            | null
          template_language?: string | null
          template_name: string
          updated_at?: string | null
          used_at?: string | null
        }
        Update: {
          authorized_by?: string | null
          clinic_id?: string | null
          cpf?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          idempotency_key?: string
          patient_id?: string | null
          phone?: string
          result_payload?: Json | null
          status?:
            | Database["public"]["Enums"]["whatsapp_one_shot_status"]
            | null
          template_language?: string | null
          template_name?: string
          updated_at?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_one_shot_authorizations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_one_shot_authorizations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_one_shot_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_operator_sectors: {
        Row: {
          created_at: string | null
          id: string
          operator_id: string
          sector_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          operator_id: string
          sector_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          operator_id?: string
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_operator_sectors_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_operator_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_operators: {
        Row: {
          clinic_id: string
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          max_concurrent_tickets: number | null
          name: string
          role: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          max_concurrent_tickets?: number | null
          name: string
          role?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          max_concurrent_tickets?: number | null
          name?: string
          role?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_operators_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_operators_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_opt_ins: {
        Row: {
          clinic_id: string
          consented_at: string
          created_at: string
          id: string
          phone: string
          source: string
        }
        Insert: {
          clinic_id: string
          consented_at?: string
          created_at?: string
          id?: string
          phone: string
          source?: string
        }
        Update: {
          clinic_id?: string
          consented_at?: string
          created_at?: string
          id?: string
          phone?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_opt_ins_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_opt_ins_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_opt_outs: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          opted_out_at: string
          phone: string
          reactivated_at: string | null
          reactivated_by: string | null
          reason: string | null
          source: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          opted_out_at?: string
          phone: string
          reactivated_at?: string | null
          reactivated_by?: string | null
          reason?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          opted_out_at?: string
          phone?: string
          reactivated_at?: string | null
          reactivated_by?: string | null
          reason?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_outbox: {
        Row: {
          attempts: number
          category: string | null
          clinic_id: string
          compliance_checked_at: string | null
          compliance_reason: string | null
          compliance_status: string | null
          content: string | null
          conversation_id: number | null
          created_at: string
          deduplication_key: string
          dry_run: boolean
          error_code: string | null
          error_message: string | null
          event_id: string | null
          gate_reason: string | null
          id: string
          patient_id: string | null
          payload: Json
          phone: string
          processed_at: string | null
          provider: string | null
          provider_message_id: string | null
          purpose: string | null
          scheduled_at: string
          status: string
          template_name: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          category?: string | null
          clinic_id: string
          compliance_checked_at?: string | null
          compliance_reason?: string | null
          compliance_status?: string | null
          content?: string | null
          conversation_id?: number | null
          created_at?: string
          deduplication_key: string
          dry_run?: boolean
          error_code?: string | null
          error_message?: string | null
          event_id?: string | null
          gate_reason?: string | null
          id?: string
          patient_id?: string | null
          payload?: Json
          phone: string
          processed_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          purpose?: string | null
          scheduled_at?: string
          status?: string
          template_name: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          category?: string | null
          clinic_id?: string
          compliance_checked_at?: string | null
          compliance_reason?: string | null
          compliance_status?: string | null
          content?: string | null
          conversation_id?: number | null
          created_at?: string
          deduplication_key?: string
          dry_run?: boolean
          error_code?: string | null
          error_message?: string | null
          event_id?: string | null
          gate_reason?: string | null
          id?: string
          patient_id?: string | null
          payload?: Json
          phone?: string
          processed_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          purpose?: string | null
          scheduled_at?: string
          status?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_outbox_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_events"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_phone_identity: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          identified_via: string
          patient_id: string
          phone: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          identified_via?: string
          patient_id: string
          phone: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          identified_via?: string
          patient_id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_phone_identity_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_policy_events: {
        Row: {
          clinic_id: string | null
          created_at: string
          event: string
          id: string
          meta_error_code: string | null
          payload: Json
          phone: string | null
          source_function: string | null
          template_name: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          event: string
          id?: string
          meta_error_code?: string | null
          payload?: Json
          phone?: string | null
          source_function?: string | null
          template_name?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          event?: string
          id?: string
          meta_error_code?: string | null
          payload?: Json
          phone?: string | null
          source_function?: string | null
          template_name?: string | null
        }
        Relationships: []
      }
      whatsapp_quick_replies: {
        Row: {
          clinic_id: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          sector_id: string | null
          shortcut: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          sector_id?: string | null
          shortcut?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          sector_id?: string | null
          shortcut?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_quick_replies_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_quick_replies_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_quick_replies_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sectors: {
        Row: {
          clinic_id: string
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sectors_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_sectors_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          phone: string
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          phone: string
          state?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          phone?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_template_logs: {
        Row: {
          category: string | null
          clinic_id: string | null
          delivered_at: string | null
          failed_at: string | null
          id: string
          interaction_score_at_send: number | null
          meta_error_code: string | null
          meta_message_id: string | null
          optin_source: string | null
          payload: Json
          phone: string
          purpose: string | null
          read_at: string | null
          reason: string | null
          sent_at: string
          status: string
          template_name: string
          triggered_by: string | null
        }
        Insert: {
          category?: string | null
          clinic_id?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          interaction_score_at_send?: number | null
          meta_error_code?: string | null
          meta_message_id?: string | null
          optin_source?: string | null
          payload?: Json
          phone: string
          purpose?: string | null
          read_at?: string | null
          reason?: string | null
          sent_at?: string
          status: string
          template_name: string
          triggered_by?: string | null
        }
        Update: {
          category?: string | null
          clinic_id?: string | null
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          interaction_score_at_send?: number | null
          meta_error_code?: string | null
          meta_message_id?: string | null
          optin_source?: string | null
          payload?: Json
          phone?: string
          purpose?: string | null
          read_at?: string | null
          reason?: string | null
          sent_at?: string
          status?: string
          template_name?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          language: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          language?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          language?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_ticket_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          media_mime_type: string | null
          media_url: string | null
          message_type: string | null
          metadata: Json | null
          read_at: string | null
          sender_id: string | null
          sender_name: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          read_at?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type: string
          ticket_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          read_at?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_tickets: {
        Row: {
          assigned_operator_id: string | null
          clinic_id: string
          closed_at: string | null
          closed_by: string | null
          contact_id: string
          created_at: string | null
          first_response_at: string | null
          id: string
          is_bot_active: boolean | null
          last_inbound_at: string | null
          last_message: string | null
          last_message_at: string | null
          operator_id: string | null
          priority: string | null
          protocol: string | null
          sector_id: string | null
          status: string | null
          subject: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_operator_id?: string | null
          clinic_id: string
          closed_at?: string | null
          closed_by?: string | null
          contact_id: string
          created_at?: string | null
          first_response_at?: string | null
          id?: string
          is_bot_active?: boolean | null
          last_inbound_at?: string | null
          last_message?: string | null
          last_message_at?: string | null
          operator_id?: string | null
          priority?: string | null
          protocol?: string | null
          sector_id?: string | null
          status?: string | null
          subject?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_operator_id?: string | null
          clinic_id?: string
          closed_at?: string | null
          closed_by?: string | null
          contact_id?: string
          created_at?: string | null
          first_response_at?: string | null
          id?: string
          is_bot_active?: boolean | null
          last_inbound_at?: string | null
          last_message?: string | null
          last_message_at?: string | null
          operator_id?: string | null
          priority?: string | null
          protocol?: string | null
          sector_id?: string | null
          status?: string | null
          subject?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_tickets_assigned_operator_id_fkey"
            columns: ["assigned_operator_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_tickets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_tickets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_tickets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_tickets_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_tickets_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_dedup: {
        Row: {
          created_at: string
          dedup_key: string
          source: string
        }
        Insert: {
          created_at?: string
          dedup_key: string
          source: string
        }
        Update: {
          created_at?: string
          dedup_key?: string
          source?: string
        }
        Relationships: []
      }
      whazing_messages: {
        Row: {
          body: string | null
          created_at: string
          from_me: boolean
          id: string
          media_type: string | null
          media_url: string | null
          message_id: string | null
          sender_name: string | null
          sender_phone: string | null
          status: string | null
          ticket_id: string
          timestamp: number | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          from_me?: boolean
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          ticket_id: string
          timestamp?: number | null
        }
        Update: {
          body?: string | null
          created_at?: string
          from_me?: boolean
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          ticket_id?: string
          timestamp?: number | null
        }
        Relationships: []
      }
      whazing_queue_users: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          queue_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          queue_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          queue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whazing_queue_users_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "whazing_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      whazing_queues: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      whazing_quick_responses: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          media_type: string | null
          media_url: string | null
          shortcut: string | null
          title: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          media_type?: string | null
          media_url?: string | null
          shortcut?: string | null
          title: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          media_type?: string | null
          media_url?: string | null
          shortcut?: string | null
          title?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      whazing_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      whazing_ticket_tags: {
        Row: {
          created_at: string
          id: string
          tag_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tag_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tag_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whazing_ticket_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "whazing_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      whazing_tickets: {
        Row: {
          assigned_queue_id: string | null
          bot_active: boolean
          closed_at: string | null
          contact_name: string | null
          contact_number: string
          holiday_notified: boolean | null
          holiday_notified_at: string | null
          id: string
          last_message: string | null
          opened_at: string | null
          profile_pic_url: string | null
          queue_id: string | null
          raw_data: Json | null
          status: string
          subject: string | null
          ticket_id: string
          ticket_number: number | null
          updated_at: string | null
          user_id_whazing: string | null
        }
        Insert: {
          assigned_queue_id?: string | null
          bot_active?: boolean
          closed_at?: string | null
          contact_name?: string | null
          contact_number: string
          holiday_notified?: boolean | null
          holiday_notified_at?: string | null
          id?: string
          last_message?: string | null
          opened_at?: string | null
          profile_pic_url?: string | null
          queue_id?: string | null
          raw_data?: Json | null
          status?: string
          subject?: string | null
          ticket_id: string
          ticket_number?: number | null
          updated_at?: string | null
          user_id_whazing?: string | null
        }
        Update: {
          assigned_queue_id?: string | null
          bot_active?: boolean
          closed_at?: string | null
          contact_name?: string | null
          contact_number?: string
          holiday_notified?: boolean | null
          holiday_notified_at?: string | null
          id?: string
          last_message?: string | null
          opened_at?: string | null
          profile_pic_url?: string | null
          queue_id?: string | null
          raw_data?: Json | null
          status?: string
          subject?: string | null
          ticket_id?: string
          ticket_number?: number | null
          updated_at?: string | null
          user_id_whazing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whazing_tickets_assigned_queue_id_fkey"
            columns: ["assigned_queue_id"]
            isOneToOne: false
            referencedRelation: "whazing_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      zapresponder_configs: {
        Row: {
          api_token: string
          clinic_id: string | null
          created_at: string
          id: string
          instance_id: string | null
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          api_token: string
          clinic_id?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Update: {
          api_token?: string
          clinic_id?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapresponder_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapresponder_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      zapster_configs: {
        Row: {
          clinic_id: string
          connected_at: string | null
          created_at: string
          id: string
          instance_id: string
          is_active: boolean
          is_connected: boolean
          last_status_check: string | null
          notes: string | null
          phone_number: string | null
          updated_at: string
          webhook_id: string | null
        }
        Insert: {
          clinic_id: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_id: string
          is_active?: boolean
          is_connected?: boolean
          last_status_check?: string | null
          notes?: string | null
          phone_number?: string | null
          updated_at?: string
          webhook_id?: string | null
        }
        Update: {
          clinic_id?: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_id?: string
          is_active?: boolean
          is_connected?: boolean
          last_status_check?: string | null
          notes?: string | null
          phone_number?: string | null
          updated_at?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapster_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapster_configs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      zapster_webhook_logs: {
        Row: {
          clinic_id: string | null
          created_at: string
          error_message: string | null
          event_id: string | null
          event_type: string
          forwarded_response: string | null
          forwarded_status: number | null
          id: string
          instance_id: string | null
          message_preview: string | null
          payload: Json | null
          sender: string | null
          status: string
          summary: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type: string
          forwarded_response?: string | null
          forwarded_status?: number | null
          id?: string
          instance_id?: string | null
          message_preview?: string | null
          payload?: Json | null
          sender?: string | null
          status?: string
          summary?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          forwarded_response?: string | null
          forwarded_status?: number | null
          id?: string
          instance_id?: string | null
          message_preview?: string | null
          payload?: Json | null
          sender?: string | null
          status?: string
          summary?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      annual_cash_flow: {
        Row: {
          balance: number | null
          clinic_id: string | null
          expense: number | null
          income: number | null
          month: number | null
          pending_total: number | null
          transaction_count: number | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_flow_summary: {
        Row: {
          clinic_id: string | null
          expense_paid: number | null
          expense_pending: number | null
          income_paid: number | null
          income_pending: number | null
          movement_date: string | null
          transaction_count: number | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_balances: {
        Row: {
          bank_name: string | null
          calculated_balance: number | null
          clinic_id: string | null
          current_balance: number | null
          id: string | null
          initial_balance: number | null
          name: string | null
          total_expense: number | null
          total_income: number | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      homologacao_availability: {
        Row: {
          appointment_date: string | null
          clinic_id: string | null
          end_time: string | null
          id: string | null
          professional_id: string | null
          start_time: string | null
          status: string | null
        }
        Insert: {
          appointment_date?: string | null
          clinic_id?: string | null
          end_time?: string | null
          id?: string | null
          professional_id?: string | null
          start_time?: string | null
          status?: string | null
        }
        Update: {
          appointment_date?: string | null
          clinic_id?: string | null
          end_time?: string | null
          id?: string | null
          professional_id?: string | null
          start_time?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homologacao_appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homologacao_appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "homologacao_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_health_score_v: {
        Row: {
          bad_templates: number | null
          blocked_24h: number | null
          failed_24h: number | null
          health_label: string | null
          health_score: number | null
          optouts_24h: number | null
          sent_24h: number | null
        }
        Relationships: []
      }
      public_clinic_info: {
        Row: {
          address: string | null
          app_unavailable: boolean | null
          app_unavailable_message: string | null
          birthday_enabled: boolean | null
          booking_months_ahead: number | null
          city: string | null
          closing_time: string | null
          created_at: string | null
          custom_map_embed_url: string | null
          email: string | null
          entity_nomenclature: string | null
          holidays_enabled: boolean | null
          id: string | null
          is_blocked: boolean | null
          logo_url: string | null
          map_view_type: string | null
          max_appointments_per_cpf_month: number | null
          min_advance_booking_hours: number | null
          name: string | null
          opening_time: string | null
          phone: string | null
          reminder_enabled: boolean | null
          reminder_hours: number | null
          slug: string | null
          state_code: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          app_unavailable?: boolean | null
          app_unavailable_message?: string | null
          birthday_enabled?: boolean | null
          booking_months_ahead?: number | null
          city?: string | null
          closing_time?: string | null
          created_at?: string | null
          custom_map_embed_url?: string | null
          email?: string | null
          entity_nomenclature?: string | null
          holidays_enabled?: boolean | null
          id?: string | null
          is_blocked?: boolean | null
          logo_url?: string | null
          map_view_type?: string | null
          max_appointments_per_cpf_month?: number | null
          min_advance_booking_hours?: number | null
          name?: string | null
          opening_time?: string | null
          phone?: string | null
          reminder_enabled?: boolean | null
          reminder_hours?: number | null
          slug?: string | null
          state_code?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          app_unavailable?: boolean | null
          app_unavailable_message?: string | null
          birthday_enabled?: boolean | null
          booking_months_ahead?: number | null
          city?: string | null
          closing_time?: string | null
          created_at?: string | null
          custom_map_embed_url?: string | null
          email?: string | null
          entity_nomenclature?: string | null
          holidays_enabled?: boolean | null
          id?: string | null
          is_blocked?: boolean | null
          logo_url?: string | null
          map_view_type?: string | null
          max_appointments_per_cpf_month?: number | null
          min_advance_booking_hours?: number | null
          name?: string | null
          opening_time?: string | null
          phone?: string | null
          reminder_enabled?: boolean | null
          reminder_hours?: number | null
          slug?: string | null
          state_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_professionals: {
        Row: {
          avatar_url: string | null
          bio: string | null
          clinic_id: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          slug: string | null
          specialty: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          slug?: string | null
          specialty?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          clinic_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          slug?: string | null
          specialty?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
        ]
      }
      sindical_dependentes: {
        Row: {
          birth_date: string | null
          card_expires_at: string | null
          card_number: string | null
          clinic_id: string | null
          cpf: string | null
          cpf_photo_url: string | null
          created_at: string | null
          id: string | null
          inactivated_at: string | null
          inactivation_reason: string | null
          insurance_plan_id: string | null
          is_active: boolean | null
          name: string | null
          notes: string | null
          patient_id: string | null
          pending_approval: boolean | null
          phone: string | null
          relationship: string | null
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          card_expires_at?: string | null
          card_number?: string | null
          clinic_id?: string | null
          cpf?: string | null
          cpf_photo_url?: string | null
          created_at?: string | null
          id?: string | null
          inactivated_at?: string | null
          inactivation_reason?: string | null
          insurance_plan_id?: string | null
          is_active?: boolean | null
          name?: string | null
          notes?: string | null
          patient_id?: string | null
          pending_approval?: boolean | null
          phone?: string | null
          relationship?: string | null
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          card_expires_at?: string | null
          card_number?: string | null
          clinic_id?: string | null
          cpf?: string | null
          cpf_photo_url?: string | null
          created_at?: string | null
          id?: string | null
          inactivated_at?: string | null
          inactivation_reason?: string | null
          insurance_plan_id?: string | null
          is_active?: boolean | null
          name?: string | null
          notes?: string | null
          patient_id?: string | null
          pending_approval?: boolean | null
          phone?: string | null
          relationship?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_dependents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_dependents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "public_clinic_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_dependents_insurance_plan_id_fkey"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_dependents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      act_on_appointment_by_token: {
        Args: { _action: string; _reason?: string; _token: string }
        Returns: string
      }
      act_on_homologacao_by_token: {
        Args: { _action: string; _reason?: string; _token: string }
        Returns: string
      }
      authenticate_patient_hybrid: {
        Args: { p_cpf: string; p_password: string }
        Returns: Json
      }
      calc_interaction_score: {
        Args: { _clinic_id: string; _phone: string }
        Returns: number
      }
      can_access_chat_attachment: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_access_clinic_full_info: {
        Args: { check_clinic_id: string }
        Returns: boolean
      }
      can_access_email_inbox: { Args: { _user_id: string }; Returns: boolean }
      can_access_legal_document: {
        Args: { object_name: string }
        Returns: boolean
      }
      can_mobile_cancel_homologacao: {
        Args: { p_appointment_id: string; p_employee_cpf: string }
        Returns: boolean
      }
      can_patient_create_authorization: {
        Args: { p_clinic_id: string; p_patient_id: string }
        Returns: boolean
      }
      cancel_expired_negotiations: { Args: never; Returns: number }
      check_patient_first_access: {
        Args: { p_cpf: string; p_email: string }
        Returns: {
          clinic_id: string
          patient_email: string
          patient_id: string
          patient_name: string
        }[]
      }
      check_patient_has_password: {
        Args: { p_patient_id: string }
        Returns: boolean
      }
      check_whatsapp_multiattendance_access: {
        Args: { p_clinic_id: string }
        Returns: boolean
      }
      check_whatsapp_tenant_binding: {
        Args: { _clinic_id: string; _integration_id: string }
        Returns: boolean
      }
      cleanup_whatsapp_incoming_logs: { Args: never; Returns: undefined }
      clinic_has_addon: {
        Args: { _addon_key: string; _clinic_id: string }
        Returns: boolean
      }
      complete_first_access: {
        Args: { p_email: string; p_password: string; p_token: string }
        Returns: boolean
      }
      count_union_activity_log: {
        Args: {
          p_clinic_id: string
          p_entity_type?: string
          p_from?: string
          p_search?: string
          p_to?: string
          p_user_id?: string
        }
        Returns: number
      }
      create_first_access_token: {
        Args: { p_email: string; p_patient_id: string }
        Returns: string
      }
      create_password_reset_token: {
        Args: { p_email: string }
        Returns: {
          message: string
          patient_name: string
          success: boolean
          token: string
        }[]
      }
      find_patient_for_first_access: { Args: { p_cpf: string }; Returns: Json }
      generate_associado_matricula: {
        Args: { p_sindicato_id: string }
        Returns: string
      }
      generate_authorization_hash: { Args: never; Returns: string }
      generate_authorization_number: {
        Args: { p_clinic_id: string }
        Returns: string
      }
      generate_card_number:
        | { Args: { p_clinic_id: string }; Returns: string }
        | {
            Args: { p_clinic_id: string; p_patient_id?: string }
            Returns: string
          }
      generate_contribution_access_token: { Args: never; Returns: string }
      generate_employer_access_code: { Args: never; Returns: string }
      generate_employer_registration_number: {
        Args: { p_clinic_id: string }
        Returns: string
      }
      generate_homologacao_protocol: {
        Args: { p_clinic_id: string }
        Returns: string
      }
      generate_negotiation_code: {
        Args: { p_clinic_id: string }
        Returns: string
      }
      generate_patient_registration_number: {
        Args: { p_clinic_id: string }
        Returns: string
      }
      generate_queue_ticket: {
        Args: { p_queue_id: string }
        Returns: {
          ticket_number: number
          ticket_prefix: string
        }[]
      }
      generate_quote_number: { Args: { p_clinic_id: string }; Returns: string }
      generate_signature_token: { Args: never; Returns: string }
      generate_tiss_guide_number: {
        Args: { p_clinic_id: string; p_guide_type: string }
        Returns: string
      }
      get_anamnese_by_public_token: { Args: { p_token: string }; Returns: Json }
      get_anamnese_by_token: {
        Args: { p_token: string }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "anamnese_responses"
          isOneToOne: false
          isSetofReturn: true
        }
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
      get_appointment_by_confirmation_token: {
        Args: { _token: string }
        Returns: {
          appointment_date: string
          clinic_address: string
          clinic_name: string
          clinic_phone: string
          id: string
          patient_name: string
          professional_name: string
          start_time: string
          status: string
        }[]
      }
      get_appointment_slots: {
        Args: { p_clinic_id: string; p_date: string; p_professional_id: string }
        Returns: {
          appointment_date: string
          clinic_id: string
          end_time: string
          professional_id: string
          start_time: string
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
      get_available_professionals_for_patient: {
        Args: { p_patient_id: string }
        Returns: {
          appointment_duration: number
          avatar_url: string
          clinic_id: string
          id: string
          name: string
          specialty: string
        }[]
      }
      get_available_users_for_queue: {
        Args: { p_clinic_id: string }
        Returns: {
          role: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_booking_window_end_date: {
        Args: { p_clinic_id: string }
        Returns: string
      }
      get_clinic_message_usage: {
        Args: { _clinic_id: string; _month_year?: string }
        Returns: {
          max_allowed: number
          remaining: number
          used: number
        }[]
      }
      get_clinic_queue_panel: {
        Args: { p_clinic_id: string }
        Returns: {
          called_at: string
          id: string
          patient_name: string
          professional_name: string
          professional_specialty: string
          queue_name: string
          room_name: string
          status: string
          ticket: string
        }[]
      }
      get_contribution_by_public_token: {
        Args: { p_token: string }
        Returns: Json
      }
      get_contribution_by_token: {
        Args: { p_token: string }
        Returns: {
          active_competence_key: string | null
          cash_register_id: string | null
          clinic_id: string
          competence_month: number
          competence_year: number
          contribution_type_id: string
          created_at: string
          created_by: string | null
          divergence_details: Json | null
          due_date: string
          employer_id: string
          financial_category_id: string | null
          has_divergence: boolean | null
          id: string
          imported_at: string | null
          is_editable: boolean | null
          is_negotiated_debt: boolean | null
          is_reconciled: boolean | null
          last_lytex_sync_at: string | null
          lytex_boleto_barcode: string | null
          lytex_boleto_digitable_line: string | null
          lytex_fee_amount: number | null
          lytex_fee_details: Json | null
          lytex_invoice_id: string | null
          lytex_invoice_url: string | null
          lytex_original_status: string | null
          lytex_pix_code: string | null
          lytex_pix_qrcode: string | null
          lytex_raw_data: Json | null
          lytex_transaction_id: string | null
          member_id: string | null
          negotiation_id: string | null
          net_value: number | null
          notes: string | null
          origin: string | null
          paid_at: string | null
          paid_value: number | null
          payment_method: string | null
          portal_due_date_change_count: number
          portal_reissue_count: number
          portal_value_change_count: number
          public_access_token: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_notes: string | null
          status: string
          union_entity_id: string | null
          updated_at: string
          value: number
        }[]
        SetofOptions: {
          from: "*"
          to: "employer_contributions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_homologacao_by_confirmation_token: {
        Args: { _token: string }
        Returns: {
          appointment_date: string
          clinic_address: string
          clinic_name: string
          clinic_phone: string
          company_name: string
          employee_name: string
          id: string
          professional_name: string
          start_time: string
          status: string
        }[]
      }
      get_meta_vault_secret: { Args: { _secret_name: string }; Returns: string }
      get_my_mobile_appointments: {
        Args: never
        Returns: {
          appointment_date: string
          dependent: Json
          dependent_id: string
          end_time: string
          id: string
          notes: string
          procedure: Json
          professional: Json
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          type: Database["public"]["Enums"]["appointment_type"]
        }[]
      }
      get_my_queue_calls: {
        Args: never
        Returns: {
          appointment_id: string
          called_at: string
          id: string
          person_name: string
          professional_name: string
          queue_name: string
          room_name: string
          status: string
          ticket_number: number
          ticket_prefix: string
        }[]
      }
      get_negotiation_preview_by_token: {
        Args: { p_token: string }
        Returns: {
          access_token: string
          cancelled_at: string | null
          clinic_id: string
          contributions_data: Json
          created_at: string
          created_by: string | null
          custom_dates: Json | null
          down_payment: number
          employer_cnpj: string
          employer_id: string
          employer_name: string
          employer_trade_name: string | null
          expires_at: string
          first_due_date: string
          id: string
          installment_value: number
          installments_count: number
          interest_rate_monthly: number
          is_cancelled: boolean
          late_fee_percentage: number
          legal_basis: string | null
          monetary_correction_monthly: number
          negotiation_id: string | null
          total_correction: number
          total_interest: number
          total_late_fee: number
          total_negotiated_value: number
          total_original_value: number
          view_count: number
          viewed_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "negotiation_previews"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_patient_authorizations: {
        Args: { p_patient_id: string }
        Returns: {
          authorization_number: string
          benefit_id: string
          clinic_id: string
          created_at: string
          created_by: string | null
          dependent_id: string | null
          id: string
          is_for_dependent: boolean
          issued_at: string
          last_viewed_at: string | null
          notes: string | null
          patient_id: string
          printed_at: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          union_entity_id: string | null
          updated_at: string
          valid_from: string
          valid_until: string
          validation_hash: string
          view_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "union_authorizations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_patient_dependent_requests: {
        Args: { p_patient_id: string }
        Returns: {
          created_at: string
          dependent_cpf: string
          dependent_id: string
          dependent_name: string
          dependent_relationship: string
          id: string
          rejection_reason: string
          reviewed_at: string
          status: string
        }[]
      }
      get_patient_dependents: {
        Args: { p_patient_id: string }
        Returns: {
          birth_date: string
          card_expires_at: string
          card_number: string
          cpf: string
          created_at: string
          gender: string
          id: string
          is_active: boolean
          name: string
          phone: string
          relationship: string
        }[]
      }
      get_patient_notifications: {
        Args: { p_patient_id: string }
        Returns: {
          body: string
          created_at: string
          data: Json
          id: string
          is_read: boolean
          title: string
          type: string
        }[]
      }
      get_public_contribution_types: {
        Args: { p_token: string }
        Returns: Json
      }
      get_queue_users: {
        Args: { p_queue_id: string }
        Returns: {
          created_at: string
          id: string
          queue_id: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_signature_token: {
        Args: { p_token: string }
        Returns: {
          clinic_id: string
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          ip_address: string | null
          patient_id: string
          token: string
          used_at: string | null
          user_agent: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "signature_request_tokens"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_telemedicine_by_patient_token: {
        Args: { p_token: string }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "telemedicine_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_trial_signup_enabled: { Args: never; Returns: boolean }
      get_union_activity_log: {
        Args: {
          p_clinic_id: string
          p_entity_type?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_to?: string
          p_user_id?: string
        }
        Returns: {
          action: string
          actor_name: string
          actor_user_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string
          new_data: Json
          old_data: Json
          source: string
          user_agent: string
        }[]
      }
      get_user_clinic_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_permissions: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: {
          permission_key: string
        }[]
      }
      get_user_queues: {
        Args: { p_user_id: string }
        Returns: {
          queue_color: string
          queue_id: string
          queue_name: string
        }[]
      }
      get_whazing_messages_for_ticket: {
        Args: { p_clinic_id: string; p_ticket_id: string }
        Returns: {
          body: string | null
          created_at: string
          from_me: boolean
          id: string
          media_type: string | null
          media_url: string | null
          message_id: string | null
          sender_name: string | null
          sender_phone: string | null
          status: string | null
          ticket_id: string
          timestamp: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "whazing_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_whazing_tickets_for_clinic: {
        Args: { p_clinic_id: string }
        Returns: {
          assigned_queue_id: string
          bot_active: boolean
          closed_at: string
          contact_name: string
          contact_number: string
          holiday_notified: boolean
          holiday_notified_at: string
          id: string
          last_message: string
          opened_at: string
          profile_pic_url: string
          queue_id: string
          status: string
          subject: string
          ticket_id: string
          ticket_number: number
          updated_at: string
          user_id_whazing: string
        }[]
      }
      has_clinic_access: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_union_entity_access:
        | { Args: { _user_id: string }; Returns: boolean }
        | {
            Args: { _union_entity_id: string; _user_id: string }
            Returns: boolean
          }
      has_union_homologacao_access: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      has_union_module_access: {
        Args: { p_clinic_id: string; p_user_id: string }
        Returns: boolean
      }
      homologacao_token_matches: { Args: { _token: string }; Returns: boolean }
      invalidate_previous_sessions: {
        Args: {
          p_clinic_id: string
          p_current_session_token: string
          p_user_id: string
        }
        Returns: number
      }
      is_clinic_admin: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_current_patient: { Args: { p_patient_id: string }; Returns: boolean }
      is_holiday: {
        Args: { p_clinic_id: string; p_date: string }
        Returns: {
          holiday_name: string
          holiday_type: string
          is_holiday: boolean
        }[]
      }
      is_patient_card_valid: {
        Args: { p_clinic_id: string; p_patient_id: string }
        Returns: {
          card_number: string
          days_until_expiry: number
          expires_at: string
          is_valid: boolean
        }[]
      }
      is_session_valid: { Args: { p_session_token: string }; Returns: boolean }
      is_super_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      is_union_context: { Args: { p_user_id: string }; Returns: boolean }
      log_reconciliation_action: {
        Args: {
          p_action: string
          p_clinic_id: string
          p_details: Json
          p_new_status: string
          p_origin: string
          p_performed_by: string
          p_previous_status: string
          p_statement_transaction_id: string
          p_transaction_id: string
        }
        Returns: string
      }
      mark_all_notifications_read: {
        Args: { p_patient_id: string }
        Returns: number
      }
      mark_notification_read: {
        Args: { p_notification_id: string; p_patient_id: string }
        Returns: boolean
      }
      month_period_end_anchored: {
        Args: { anchor_day?: number; d: string }
        Returns: string
      }
      month_period_start_anchored: {
        Args: { anchor_day?: number; d: string }
        Returns: string
      }
      normalize_check_number: { Args: { check_num: string }; Returns: string }
      recalculate_union_cash_register_balance: {
        Args: { register_id: string }
        Returns: number
      }
      record_cash_flow_entry: {
        Args: {
          p_amount: number
          p_cash_register_id: string
          p_clinic_id: string
          p_created_by?: string
          p_date: string
          p_description: string
          p_reference_id: string
          p_reference_type: string
          p_source: string
          p_type: string
        }
        Returns: string
      }
      request_dependent_inclusion: {
        Args: {
          p_birth_date: string
          p_clinic_id: string
          p_cpf: string
          p_cpf_photo_back_url?: string
          p_cpf_photo_url: string
          p_gender?: string
          p_holder_doc_back_url?: string
          p_holder_doc_front_url?: string
          p_name: string
          p_patient_id: string
          p_phone: string
          p_relationship: string
        }
        Returns: string
      }
      reset_patient_password_by_birth_year: {
        Args: { p_birth_year: number; p_email: string; p_new_password: string }
        Returns: Json
      }
      reset_patient_password_by_code:
        | {
            Args: { p_code: string; p_email: string; p_new_password: string }
            Returns: Json
          }
        | {
            Args: {
              p_birth_year?: number
              p_code: string
              p_email: string
              p_new_password: string
            }
            Returns: Json
          }
      reset_patient_password_by_cpf_code: {
        Args: { p_code: string; p_cpf: string; p_new_password: string }
        Returns: Json
      }
      reset_patient_password_with_token:
        | {
            Args: { p_email: string; p_new_password: string; p_token: string }
            Returns: {
              message: string
              success: boolean
            }[]
          }
        | {
            Args: {
              p_birth_year?: number
              p_email: string
              p_new_password: string
              p_token: string
            }
            Returns: {
              message: string
              success: boolean
            }[]
          }
      resolve_appointment_family: {
        Args: {
          p_clinic_id: string
          p_dependent_id: string
          p_patient_id: string
        }
        Returns: {
          is_dependent: boolean
          titular_id: string
        }[]
      }
      reverse_transaction: {
        Args: { p_reason: string; p_transaction_id: string; p_user_id?: string }
        Returns: Json
      }
      search_employers_for_filiacao: {
        Args: { _clinic_id: string; _search_term?: string }
        Returns: {
          address: string
          cnpj: string
          id: string
          name: string
          registration_number: string
          trade_name: string
        }[]
      }
      set_clinic_booking_months_ahead: {
        Args: { p_clinic_id: string; p_months_ahead: number }
        Returns: undefined
      }
      set_contribution_type_by_public_token: {
        Args: { p_token: string; p_type_id: string }
        Returns: boolean
      }
      set_meta_vault_secret: {
        Args: { _actor: string; _secret_name: string; _secret_value: string }
        Returns: undefined
      }
      set_patient_password: {
        Args: { p_password: string; p_patient_id: string }
        Returns: boolean
      }
      set_patient_password_direct: {
        Args: { p_password: string; p_patient_id: string }
        Returns: boolean
      }
      sync_all_dependents_card_expiry: {
        Args: { p_clinic_id: string }
        Returns: number
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_anamnese_by_token: {
        Args: {
          p_responsibility_accepted?: boolean
          p_signature_data?: string
          p_signed_at?: string
          p_token: string
        }
        Returns: boolean
      }
      update_expired_authorizations: { Args: never; Returns: undefined }
      update_overdue_contributions: { Args: never; Returns: undefined }
      update_own_dependent_gender: {
        Args: { p_dependent_id: string; p_gender: string }
        Returns: undefined
      }
      update_telemedicine_by_patient_token: {
        Args: { p_status?: string; p_token: string }
        Returns: boolean
      }
      upsert_meta_vault_secret: {
        Args: { _secret_name: string; _secret_value: string }
        Returns: boolean
      }
      user_has_clinic_storage_access: {
        Args: { object_name: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _clinic_id: string; _permission_key: string; _user_id: string }
        Returns: boolean
      }
      validate_authorization_by_hash: {
        Args: { p_hash: string }
        Returns: {
          authorization_number: string
          benefit_name: string
          is_valid: boolean
          status: string
          valid_from: string
          valid_until: string
        }[]
      }
      validate_authorization_full: { Args: { p_hash: string }; Returns: Json }
      verify_employer_for_filiacao: {
        Args: { _employer_id: string }
        Returns: {
          id: string
          name: string
          trade_name: string
        }[]
      }
      verify_patient_password: {
        Args: { p_clinic_id?: string; p_cpf: string; p_password: string }
        Returns: {
          clinic_id: string
          is_active: boolean
          no_show_blocked_until: string
          patient_email: string
          patient_id: string
          patient_name: string
        }[]
      }
      verify_reminder_cron_key: { Args: { _key: string }; Returns: boolean }
      wa_can_send: {
        Args: {
          _category: string
          _clinic_id: string
          _min_score?: number
          _phone: string
          _purpose: string
          _template: string
        }
        Returns: Json
      }
      wa_has_consent: {
        Args: { _phone: string; _tenant_id: string }
        Returns: boolean
      }
      wl_accept_offer: {
        Args: { p_offer_id: string; p_patient_id: string }
        Returns: Json
      }
      wl_decline_offer: {
        Args: { p_offer_id: string; p_patient_id: string }
        Returns: Json
      }
      wl_expire_offers: { Args: never; Returns: Json }
      wl_join_queue: {
        Args: {
          p_clinic_id: string
          p_notes?: string
          p_patient_id: string
          p_professional_id: string
          p_source?: string
          p_specialty_id?: string
        }
        Returns: Json
      }
      wl_log: {
        Args: {
          p_action: string
          p_actor_id?: string
          p_actor_type?: string
          p_clinic_id: string
          p_details?: Json
          p_offer_id?: string
          p_patient_id?: string
          p_professional_id?: string
          p_waiting_list_id?: string
        }
        Returns: undefined
      }
      wl_offer_next_slot: {
        Args: {
          p_appointment_date: string
          p_cancelled_appointment_id?: string
          p_clinic_id: string
          p_end_time: string
          p_professional_id: string
          p_start_time: string
        }
        Returns: Json
      }
      wl_remove_from_queue: {
        Args: { p_reason?: string; p_waiting_list_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "receptionist"
        | "professional"
        | "administrative"
        | "entidade_sindical_admin"
        | "moderator"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
        | "in_progress"
        | "arrived"
        | "blocked"
      appointment_type:
        | "first_visit"
        | "return"
        | "exam"
        | "procedure"
        | "telemedicine"
      chatwoot_connection_status:
        | "NOT_CONFIGURED"
        | "CONFIGURED"
        | "CONNECTED"
        | "ERROR"
      deadline_criticality: "baixa" | "media" | "alta" | "urgente"
      deadline_status: "pendente" | "cumprido" | "descumprido" | "cancelado"
      legal_case_status:
        | "ativo"
        | "suspenso"
        | "arquivado"
        | "encerrado_favoravel"
        | "encerrado_desfavoravel"
        | "acordo"
      legal_case_type:
        | "trabalhista"
        | "civel"
        | "tributario"
        | "administrativo"
        | "coletivo_sindical"
        | "outro"
      legal_risk_level: "baixo" | "medio" | "alto" | "critico"
      patient_gender: "masculino" | "feminino" | "outro" | "prefiro_nao_dizer"
      plan_category: "clinica" | "sindicato"
      specialty_category:
        | "medical"
        | "dental"
        | "aesthetic"
        | "therapy"
        | "massage"
      union_entity_coverage: "municipal" | "estadual" | "nacional"
      union_entity_status: "ativa" | "suspensa" | "em_analise" | "inativa"
      union_entity_type: "sindicato" | "federacao" | "confederacao"
      whatsapp_one_shot_status: "authorized" | "used" | "expired" | "failed"
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
      app_role: [
        "owner",
        "admin",
        "receptionist",
        "professional",
        "administrative",
        "entidade_sindical_admin",
        "moderator",
      ],
      appointment_status: [
        "scheduled",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
        "in_progress",
        "arrived",
        "blocked",
      ],
      appointment_type: [
        "first_visit",
        "return",
        "exam",
        "procedure",
        "telemedicine",
      ],
      chatwoot_connection_status: [
        "NOT_CONFIGURED",
        "CONFIGURED",
        "CONNECTED",
        "ERROR",
      ],
      deadline_criticality: ["baixa", "media", "alta", "urgente"],
      deadline_status: ["pendente", "cumprido", "descumprido", "cancelado"],
      legal_case_status: [
        "ativo",
        "suspenso",
        "arquivado",
        "encerrado_favoravel",
        "encerrado_desfavoravel",
        "acordo",
      ],
      legal_case_type: [
        "trabalhista",
        "civel",
        "tributario",
        "administrativo",
        "coletivo_sindical",
        "outro",
      ],
      legal_risk_level: ["baixo", "medio", "alto", "critico"],
      patient_gender: ["masculino", "feminino", "outro", "prefiro_nao_dizer"],
      plan_category: ["clinica", "sindicato"],
      specialty_category: [
        "medical",
        "dental",
        "aesthetic",
        "therapy",
        "massage",
      ],
      union_entity_coverage: ["municipal", "estadual", "nacional"],
      union_entity_status: ["ativa", "suspensa", "em_analise", "inativa"],
      union_entity_type: ["sindicato", "federacao", "confederacao"],
      whatsapp_one_shot_status: ["authorized", "used", "expired", "failed"],
    },
  },
} as const
