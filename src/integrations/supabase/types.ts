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
      clinics: {
        Row: {
          address: string | null
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          closing_time: string | null
          cnpj: string | null
          created_at: string
          custom_map_embed_url: string | null
          email: string | null
          enforce_schedule_validation: boolean | null
          id: string
          is_blocked: boolean | null
          logo_url: string | null
          map_view_type: string | null
          name: string
          opening_time: string | null
          phone: string | null
          reminder_enabled: boolean | null
          reminder_hours: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          closing_time?: string | null
          cnpj?: string | null
          created_at?: string
          custom_map_embed_url?: string | null
          email?: string | null
          enforce_schedule_validation?: boolean | null
          id?: string
          is_blocked?: boolean | null
          logo_url?: string | null
          map_view_type?: string | null
          name: string
          opening_time?: string | null
          phone?: string | null
          reminder_enabled?: boolean | null
          reminder_hours?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          closing_time?: string | null
          cnpj?: string | null
          created_at?: string
          custom_map_embed_url?: string | null
          email?: string | null
          enforce_schedule_validation?: boolean | null
          id?: string
          is_blocked?: boolean | null
          logo_url?: string | null
          map_view_type?: string | null
          name?: string
          opening_time?: string | null
          phone?: string | null
          reminder_enabled?: boolean | null
          reminder_hours?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
      evolution_configs: {
        Row: {
          api_key: string
          api_url: string
          clinic_id: string
          connected_at: string | null
          created_at: string
          id: string
          instance_name: string
          is_connected: boolean | null
          phone_number: string | null
          qr_code: string | null
          updated_at: string
        }
        Insert: {
          api_key: string
          api_url: string
          clinic_id: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name: string
          is_connected?: boolean | null
          phone_number?: string | null
          qr_code?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          clinic_id?: string
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          is_connected?: boolean | null
          phone_number?: string | null
          qr_code?: string | null
          updated_at?: string
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
          amount: number
          appointment_id: string | null
          category_id: string | null
          clinic_id: string
          created_at: string | null
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          notes: string | null
          paid_date: string | null
          patient_id: string | null
          payment_method: string | null
          procedure_id: string | null
          professional_id: string | null
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          category_id?: string | null
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          patient_id?: string | null
          payment_method?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          category_id?: string | null
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          patient_id?: string | null
          payment_method?: string | null
          procedure_id?: string | null
          professional_id?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
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
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
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
          clinic_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_clinic_message_usage: {
        Args: { _clinic_id: string; _month_year?: string }
        Returns: {
          max_allowed: number
          remaining: number
          used: number
        }[]
      }
      get_user_clinic_ids: { Args: { _user_id: string }; Returns: string[] }
      has_clinic_access: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_clinic_admin: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
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
