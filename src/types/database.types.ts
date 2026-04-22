export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      agencies: {
        Row: {
          city: string | null;
          code: string;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          imo_id: string;
          is_active: boolean;
          logo_url: string | null;
          name: string;
          owner_id: string | null;
          parent_agency_id: string | null;
          settings: Json | null;
          state: string | null;
          street_address: string | null;
          updated_at: string | null;
          website: string | null;
          zip: string | null;
        };
        Insert: {
          city?: string | null;
          code: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          imo_id: string;
          is_active?: boolean;
          logo_url?: string | null;
          name: string;
          owner_id?: string | null;
          parent_agency_id?: string | null;
          settings?: Json | null;
          state?: string | null;
          street_address?: string | null;
          updated_at?: string | null;
          website?: string | null;
          zip?: string | null;
        };
        Update: {
          city?: string | null;
          code?: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          imo_id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          name?: string;
          owner_id?: string | null;
          parent_agency_id?: string | null;
          settings?: Json | null;
          state?: string | null;
          street_address?: string | null;
          updated_at?: string | null;
          website?: string | null;
          zip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agencies_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agencies_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agencies_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agencies_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agencies_parent_agency_id_fkey";
            columns: ["parent_agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_requests: {
        Row: {
          approver_id: string;
          created_agency_id: string | null;
          created_at: string;
          current_agency_id: string;
          id: string;
          imo_id: string;
          proposed_code: string;
          proposed_description: string | null;
          proposed_name: string;
          rejection_reason: string | null;
          requested_at: string;
          requester_id: string;
          reviewed_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          approver_id: string;
          created_agency_id?: string | null;
          created_at?: string;
          current_agency_id: string;
          id?: string;
          imo_id: string;
          proposed_code: string;
          proposed_description?: string | null;
          proposed_name: string;
          rejection_reason?: string | null;
          requested_at?: string;
          requester_id: string;
          reviewed_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          approver_id?: string;
          created_agency_id?: string | null;
          created_at?: string;
          current_agency_id?: string;
          id?: string;
          imo_id?: string;
          proposed_code?: string;
          proposed_description?: string | null;
          proposed_name?: string;
          rejection_reason?: string | null;
          requested_at?: string;
          requester_id?: string;
          reviewed_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_requests_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_requests_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_requests_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_requests_created_agency_id_fkey";
            columns: ["created_agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_requests_current_agency_id_fkey";
            columns: ["current_agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_requests_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_slack_credentials: {
        Row: {
          agency_id: string | null;
          app_name: string | null;
          client_id: string;
          client_secret_encrypted: string;
          created_at: string | null;
          created_by: string | null;
          id: string;
          imo_id: string;
          signing_secret_encrypted: string | null;
          updated_at: string | null;
        };
        Insert: {
          agency_id?: string | null;
          app_name?: string | null;
          client_id: string;
          client_secret_encrypted: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          imo_id: string;
          signing_secret_encrypted?: string | null;
          updated_at?: string | null;
        };
        Update: {
          agency_id?: string | null;
          app_name?: string | null;
          client_id?: string;
          client_secret_encrypted?: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          imo_id?: string;
          signing_secret_encrypted?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agency_slack_credentials_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_slack_credentials_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_slack_credentials_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_slack_credentials_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_slack_credentials_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_contracts: {
        Row: {
          agent_id: string;
          contract_level: number;
          contract_type: string;
          created_at: string | null;
          created_by: string | null;
          effective_date: string;
          expiration_date: string | null;
          id: string;
          imo_id: string | null;
          notes: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          agent_id: string;
          contract_level?: number;
          contract_type: string;
          created_at?: string | null;
          created_by?: string | null;
          effective_date: string;
          expiration_date?: string | null;
          id?: string;
          imo_id?: string | null;
          notes?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          agent_id?: string;
          contract_level?: number;
          contract_type?: string;
          created_at?: string | null;
          created_by?: string | null;
          effective_date?: string;
          expiration_date?: string | null;
          id?: string;
          imo_id?: string | null;
          notes?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_contracts_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_contracts_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_contracts_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_contracts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_contracts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_contracts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_contracts_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_state_licenses: {
        Row: {
          agent_id: string;
          created_at: string | null;
          id: string;
          is_licensed: boolean;
          state_code: string;
          updated_at: string | null;
        };
        Insert: {
          agent_id: string;
          created_at?: string | null;
          id?: string;
          is_licensed?: boolean;
          state_code: string;
          updated_at?: string | null;
        };
        Update: {
          agent_id?: string;
          created_at?: string | null;
          id?: string;
          is_licensed?: boolean;
          state_code?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_state_licenses_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_state_licenses_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_state_licenses_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_writing_numbers: {
        Row: {
          agent_id: string;
          carrier_id: string;
          created_at: string | null;
          created_by: string | null;
          effective_date: string | null;
          id: string;
          imo_id: string | null;
          notes: string | null;
          status: string;
          termination_date: string | null;
          updated_at: string | null;
          writing_number: string;
        };
        Insert: {
          agent_id: string;
          carrier_id: string;
          created_at?: string | null;
          created_by?: string | null;
          effective_date?: string | null;
          id?: string;
          imo_id?: string | null;
          notes?: string | null;
          status?: string;
          termination_date?: string | null;
          updated_at?: string | null;
          writing_number: string;
        };
        Update: {
          agent_id?: string;
          carrier_id?: string;
          created_at?: string | null;
          created_by?: string | null;
          effective_date?: string | null;
          id?: string;
          imo_id?: string | null;
          notes?: string | null;
          status?: string;
          termination_date?: string | null;
          updated_at?: string | null;
          writing_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_writing_numbers_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_writing_numbers_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_writing_numbers_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_writing_numbers_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_writing_numbers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_writing_numbers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_writing_numbers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_writing_numbers_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      alert_rule_evaluations: {
        Row: {
          affected_entity_id: string | null;
          affected_entity_type: string | null;
          affected_user_id: string | null;
          comparison: Database["public"]["Enums"]["alert_comparison"];
          current_value: number | null;
          evaluated_at: string;
          evaluation_context: Json | null;
          id: string;
          notification_id: string | null;
          rule_id: string;
          threshold_value: number;
          triggered: boolean;
        };
        Insert: {
          affected_entity_id?: string | null;
          affected_entity_type?: string | null;
          affected_user_id?: string | null;
          comparison: Database["public"]["Enums"]["alert_comparison"];
          current_value?: number | null;
          evaluated_at?: string;
          evaluation_context?: Json | null;
          id?: string;
          notification_id?: string | null;
          rule_id: string;
          threshold_value: number;
          triggered: boolean;
        };
        Update: {
          affected_entity_id?: string | null;
          affected_entity_type?: string | null;
          affected_user_id?: string | null;
          comparison?: Database["public"]["Enums"]["alert_comparison"];
          current_value?: number | null;
          evaluated_at?: string;
          evaluation_context?: Json | null;
          id?: string;
          notification_id?: string | null;
          rule_id?: string;
          threshold_value?: number;
          triggered?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "alert_rule_evaluations_affected_user_id_fkey";
            columns: ["affected_user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alert_rule_evaluations_affected_user_id_fkey";
            columns: ["affected_user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alert_rule_evaluations_affected_user_id_fkey";
            columns: ["affected_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alert_rule_evaluations_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alert_rule_evaluations_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "alert_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      alert_rule_processing: {
        Row: {
          rule_id: string;
          started_at: string;
          worker_id: string | null;
        };
        Insert: {
          rule_id: string;
          started_at?: string;
          worker_id?: string | null;
        };
        Update: {
          rule_id?: string;
          started_at?: string;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alert_rule_processing_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: true;
            referencedRelation: "alert_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      alert_rules: {
        Row: {
          agency_id: string | null;
          applies_to_downlines: boolean;
          applies_to_self: boolean;
          applies_to_team: boolean;
          comparison: Database["public"]["Enums"]["alert_comparison"];
          consecutive_triggers: number;
          cooldown_hours: number;
          created_at: string;
          description: string | null;
          id: string;
          imo_id: string | null;
          is_active: boolean;
          last_triggered_at: string | null;
          metric: Database["public"]["Enums"]["alert_metric"];
          name: string;
          notify_email: boolean;
          notify_in_app: boolean;
          owner_id: string;
          threshold_unit: string | null;
          threshold_value: number;
          trigger_count: number;
          updated_at: string;
        };
        Insert: {
          agency_id?: string | null;
          applies_to_downlines?: boolean;
          applies_to_self?: boolean;
          applies_to_team?: boolean;
          comparison: Database["public"]["Enums"]["alert_comparison"];
          consecutive_triggers?: number;
          cooldown_hours?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean;
          last_triggered_at?: string | null;
          metric: Database["public"]["Enums"]["alert_metric"];
          name: string;
          notify_email?: boolean;
          notify_in_app?: boolean;
          owner_id: string;
          threshold_unit?: string | null;
          threshold_value: number;
          trigger_count?: number;
          updated_at?: string;
        };
        Update: {
          agency_id?: string | null;
          applies_to_downlines?: boolean;
          applies_to_self?: boolean;
          applies_to_team?: boolean;
          comparison?: Database["public"]["Enums"]["alert_comparison"];
          consecutive_triggers?: number;
          cooldown_hours?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean;
          last_triggered_at?: string | null;
          metric?: Database["public"]["Enums"]["alert_metric"];
          name?: string;
          notify_email?: boolean;
          notify_in_app?: boolean;
          owner_id?: string;
          threshold_unit?: string | null;
          threshold_value?: number;
          trigger_count?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alert_rules_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alert_rules_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      app_config: {
        Row: {
          created_at: string | null;
          description: string | null;
          key: string;
          updated_at: string | null;
          value: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          key: string;
          updated_at?: string | null;
          value: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          key?: string;
          updated_at?: string | null;
          value?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"];
          action_type: string | null;
          agency_id: string | null;
          changed_fields: string[] | null;
          created_at: string;
          description: string | null;
          id: string;
          imo_id: string | null;
          metadata: Json | null;
          new_data: Json | null;
          old_data: Json | null;
          performed_by: string | null;
          performed_by_email: string | null;
          performed_by_name: string | null;
          record_id: string;
          source: Database["public"]["Enums"]["audit_source"];
          table_name: string;
        };
        Insert: {
          action: Database["public"]["Enums"]["audit_action"];
          action_type?: string | null;
          agency_id?: string | null;
          changed_fields?: string[] | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          imo_id?: string | null;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          performed_by?: string | null;
          performed_by_email?: string | null;
          performed_by_name?: string | null;
          record_id: string;
          source?: Database["public"]["Enums"]["audit_source"];
          table_name: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["audit_action"];
          action_type?: string | null;
          agency_id?: string | null;
          changed_fields?: string[] | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          imo_id?: string | null;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          performed_by?: string | null;
          performed_by_email?: string | null;
          performed_by_name?: string | null;
          record_id?: string;
          source?: Database["public"]["Enums"]["audit_source"];
          table_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_policy_attributions: {
        Row: {
          attribution_type: string;
          confidence_score: number;
          conversation_started_at: string | null;
          created_at: string | null;
          external_appointment_id: string | null;
          external_conversation_id: string;
          id: string;
          lead_name: string | null;
          match_method: string;
          policy_id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          attribution_type: string;
          confidence_score?: number;
          conversation_started_at?: string | null;
          created_at?: string | null;
          external_appointment_id?: string | null;
          external_conversation_id: string;
          id?: string;
          lead_name?: string | null;
          match_method: string;
          policy_id: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          attribution_type?: string;
          confidence_score?: number;
          conversation_started_at?: string | null;
          created_at?: string | null;
          external_appointment_id?: string | null;
          external_conversation_id?: string;
          id?: string;
          lead_name?: string | null;
          match_method?: string;
          policy_id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_policy_attributions_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: true;
            referencedRelation: "policies";
            referencedColumns: ["id"];
          },
        ];
      };
      bulk_email_campaigns: {
        Row: {
          audience_id: string | null;
          bounced_count: number;
          brand_settings: Json | null;
          campaign_type: string;
          clicked_count: number;
          completed_at: string | null;
          created_at: string | null;
          delivered_count: number;
          failed_count: number;
          id: string;
          name: string;
          opened_count: number;
          recipient_count: number;
          recipient_filter: Json | null;
          recipient_source: string;
          scheduled_for: string | null;
          send_rate: number | null;
          sent_count: number;
          sms_content: string | null;
          started_at: string | null;
          status: string;
          subject_override: string | null;
          template_id: string | null;
          unsubscribed_count: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          audience_id?: string | null;
          bounced_count?: number;
          brand_settings?: Json | null;
          campaign_type?: string;
          clicked_count?: number;
          completed_at?: string | null;
          created_at?: string | null;
          delivered_count?: number;
          failed_count?: number;
          id?: string;
          name: string;
          opened_count?: number;
          recipient_count?: number;
          recipient_filter?: Json | null;
          recipient_source: string;
          scheduled_for?: string | null;
          send_rate?: number | null;
          sent_count?: number;
          sms_content?: string | null;
          started_at?: string | null;
          status?: string;
          subject_override?: string | null;
          template_id?: string | null;
          unsubscribed_count?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          audience_id?: string | null;
          bounced_count?: number;
          brand_settings?: Json | null;
          campaign_type?: string;
          clicked_count?: number;
          completed_at?: string | null;
          created_at?: string | null;
          delivered_count?: number;
          failed_count?: number;
          id?: string;
          name?: string;
          opened_count?: number;
          recipient_count?: number;
          recipient_filter?: Json | null;
          recipient_source?: string;
          scheduled_for?: string | null;
          send_rate?: number | null;
          sent_count?: number;
          sms_content?: string | null;
          started_at?: string | null;
          status?: string;
          subject_override?: string | null;
          template_id?: string | null;
          unsubscribed_count?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bulk_email_campaigns_audience_id_fkey";
            columns: ["audience_id"];
            isOneToOne: false;
            referencedRelation: "marketing_audiences";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bulk_email_campaigns_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "email_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      bulk_email_recipients: {
        Row: {
          campaign_id: string;
          contact_id: string | null;
          contact_type: string | null;
          created_at: string | null;
          email_address: string;
          email_id: string | null;
          error_message: string | null;
          first_name: string | null;
          id: string;
          last_name: string | null;
          sent_at: string | null;
          status: string;
          variables: Json | null;
        };
        Insert: {
          campaign_id: string;
          contact_id?: string | null;
          contact_type?: string | null;
          created_at?: string | null;
          email_address: string;
          email_id?: string | null;
          error_message?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          sent_at?: string | null;
          status?: string;
          variables?: Json | null;
        };
        Update: {
          campaign_id?: string;
          contact_id?: string | null;
          contact_type?: string | null;
          created_at?: string | null;
          email_address?: string;
          email_id?: string | null;
          error_message?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          sent_at?: string | null;
          status?: string;
          variables?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "bulk_email_recipients_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "bulk_email_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bulk_email_recipients_email_id_fkey";
            columns: ["email_id"];
            isOneToOne: false;
            referencedRelation: "user_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      carrier_build_charts: {
        Row: {
          bmi_data: Json | null;
          build_data: Json;
          carrier_id: string;
          created_at: string;
          id: string;
          imo_id: string;
          is_default: boolean;
          name: string;
          notes: string | null;
          table_type: string;
          updated_at: string;
        };
        Insert: {
          bmi_data?: Json | null;
          build_data?: Json;
          carrier_id: string;
          created_at?: string;
          id?: string;
          imo_id: string;
          is_default?: boolean;
          name: string;
          notes?: string | null;
          table_type?: string;
          updated_at?: string;
        };
        Update: {
          bmi_data?: Json | null;
          build_data?: Json;
          carrier_id?: string;
          created_at?: string;
          id?: string;
          imo_id?: string;
          is_default?: boolean;
          name?: string;
          notes?: string | null;
          table_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carrier_build_charts_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_build_charts_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      carrier_condition_acceptance: {
        Row: {
          acceptance: string;
          approval_likelihood: number | null;
          carrier_id: string;
          condition_code: string;
          created_at: string;
          created_by: string | null;
          extraction_confidence: number | null;
          field_requirements: Json | null;
          health_class_result: string | null;
          id: string;
          imo_id: string;
          notes: string | null;
          product_type: string | null;
          required_fields: Json | null;
          requires_conditions: Json | null;
          review_notes: string | null;
          review_status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          rule_schema_version: number | null;
          source: string | null;
          source_guide_id: string | null;
          source_pages: number[] | null;
          source_snippet: string | null;
          updated_at: string;
        };
        Insert: {
          acceptance: string;
          approval_likelihood?: number | null;
          carrier_id: string;
          condition_code: string;
          created_at?: string;
          created_by?: string | null;
          extraction_confidence?: number | null;
          field_requirements?: Json | null;
          health_class_result?: string | null;
          id?: string;
          imo_id: string;
          notes?: string | null;
          product_type?: string | null;
          required_fields?: Json | null;
          requires_conditions?: Json | null;
          review_notes?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          rule_schema_version?: number | null;
          source?: string | null;
          source_guide_id?: string | null;
          source_pages?: number[] | null;
          source_snippet?: string | null;
          updated_at?: string;
        };
        Update: {
          acceptance?: string;
          approval_likelihood?: number | null;
          carrier_id?: string;
          condition_code?: string;
          created_at?: string;
          created_by?: string | null;
          extraction_confidence?: number | null;
          field_requirements?: Json | null;
          health_class_result?: string | null;
          id?: string;
          imo_id?: string;
          notes?: string | null;
          product_type?: string | null;
          required_fields?: Json | null;
          requires_conditions?: Json | null;
          review_notes?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          rule_schema_version?: number | null;
          source?: string | null;
          source_guide_id?: string | null;
          source_pages?: number[] | null;
          source_snippet?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carrier_condition_acceptance_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_condition_acceptance_condition_code_fkey";
            columns: ["condition_code"];
            isOneToOne: false;
            referencedRelation: "underwriting_health_conditions";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "carrier_condition_acceptance_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_condition_acceptance_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_condition_acceptance_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_condition_acceptance_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_condition_acceptance_source_guide_id_fkey";
            columns: ["source_guide_id"];
            isOneToOne: false;
            referencedRelation: "underwriting_guides";
            referencedColumns: ["id"];
          },
        ];
      };
      carrier_contract_requests: {
        Row: {
          carrier_id: string;
          carrier_instructions: string | null;
          completed_date: string | null;
          contract_document_id: string | null;
          created_at: string | null;
          created_by: string | null;
          id: string;
          in_progress_date: string | null;
          notes: string | null;
          phase_id: string | null;
          recruit_id: string;
          request_order: number;
          requested_date: string;
          status: string;
          supporting_docs: Json | null;
          updated_at: string | null;
          updated_by: string | null;
          writing_number: string | null;
          writing_received_date: string | null;
        };
        Insert: {
          carrier_id: string;
          carrier_instructions?: string | null;
          completed_date?: string | null;
          contract_document_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          in_progress_date?: string | null;
          notes?: string | null;
          phase_id?: string | null;
          recruit_id: string;
          request_order: number;
          requested_date?: string;
          status?: string;
          supporting_docs?: Json | null;
          updated_at?: string | null;
          updated_by?: string | null;
          writing_number?: string | null;
          writing_received_date?: string | null;
        };
        Update: {
          carrier_id?: string;
          carrier_instructions?: string | null;
          completed_date?: string | null;
          contract_document_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          in_progress_date?: string | null;
          notes?: string | null;
          phase_id?: string | null;
          recruit_id?: string;
          request_order?: number;
          requested_date?: string;
          status?: string;
          supporting_docs?: Json | null;
          updated_at?: string | null;
          updated_by?: string | null;
          writing_number?: string | null;
          writing_received_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "carrier_contract_requests_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contract_requests_contract_document_id_fkey";
            columns: ["contract_document_id"];
            isOneToOne: false;
            referencedRelation: "user_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contract_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contract_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contract_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contract_requests_phase_id_fkey";
            columns: ["phase_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_phases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contract_requests_recruit_id_fkey";
            columns: ["recruit_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contract_requests_recruit_id_fkey";
            columns: ["recruit_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contract_requests_recruit_id_fkey";
            columns: ["recruit_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contract_requests_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contract_requests_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contract_requests_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      carrier_contracts: {
        Row: {
          agent_id: string;
          approved_date: string | null;
          carrier_id: string;
          created_at: string | null;
          created_by: string | null;
          id: string;
          notes: string | null;
          requested_date: string | null;
          status: string;
          submitted_date: string | null;
          updated_at: string | null;
          writing_number: string | null;
        };
        Insert: {
          agent_id: string;
          approved_date?: string | null;
          carrier_id: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          requested_date?: string | null;
          status?: string;
          submitted_date?: string | null;
          updated_at?: string | null;
          writing_number?: string | null;
        };
        Update: {
          agent_id?: string;
          approved_date?: string | null;
          carrier_id?: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          requested_date?: string | null;
          status?: string;
          submitted_date?: string | null;
          updated_at?: string | null;
          writing_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "carrier_contracts_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contracts_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contracts_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contracts_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contracts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contracts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_contracts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      carrier_underwriting_criteria: {
        Row: {
          carrier_id: string;
          created_at: string | null;
          criteria: Json;
          extracted_at: string | null;
          extraction_confidence: number | null;
          extraction_error: string | null;
          extraction_status: string | null;
          guide_id: string | null;
          id: string;
          imo_id: string;
          is_active: boolean | null;
          product_id: string | null;
          review_notes: string | null;
          review_status: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          source_excerpts: Json | null;
          updated_at: string | null;
          version: number | null;
        };
        Insert: {
          carrier_id: string;
          created_at?: string | null;
          criteria?: Json;
          extracted_at?: string | null;
          extraction_confidence?: number | null;
          extraction_error?: string | null;
          extraction_status?: string | null;
          guide_id?: string | null;
          id?: string;
          imo_id: string;
          is_active?: boolean | null;
          product_id?: string | null;
          review_notes?: string | null;
          review_status?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_excerpts?: Json | null;
          updated_at?: string | null;
          version?: number | null;
        };
        Update: {
          carrier_id?: string;
          created_at?: string | null;
          criteria?: Json;
          extracted_at?: string | null;
          extraction_confidence?: number | null;
          extraction_error?: string | null;
          extraction_status?: string | null;
          guide_id?: string | null;
          id?: string;
          imo_id?: string;
          is_active?: boolean | null;
          product_id?: string | null;
          review_notes?: string | null;
          review_status?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_excerpts?: Json | null;
          updated_at?: string | null;
          version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "carrier_underwriting_criteria_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_underwriting_criteria_guide_id_fkey";
            columns: ["guide_id"];
            isOneToOne: false;
            referencedRelation: "underwriting_guides";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_underwriting_criteria_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_underwriting_criteria_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_underwriting_criteria_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_underwriting_criteria_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carrier_underwriting_criteria_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      carriers: {
        Row: {
          advance_cap: number | null;
          code: string | null;
          commission_structure: Json | null;
          contact_info: Json | null;
          contracting_metadata: Json | null;
          created_at: string | null;
          id: string;
          imo_id: string | null;
          is_active: boolean | null;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          advance_cap?: number | null;
          code?: string | null;
          commission_structure?: Json | null;
          contact_info?: Json | null;
          contracting_metadata?: Json | null;
          created_at?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean | null;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          advance_cap?: number | null;
          code?: string | null;
          commission_structure?: Json | null;
          contact_info?: Json | null;
          contracting_metadata?: Json | null;
          created_at?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean | null;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "carriers_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      chargebacks: {
        Row: {
          chargeback_amount: number;
          chargeback_date: string;
          commission_id: string | null;
          created_at: string | null;
          id: string;
          reason: string | null;
          resolution_date: string | null;
          resolution_notes: string | null;
          status: Database["public"]["Enums"]["chargeback_status"] | null;
          updated_at: string | null;
        };
        Insert: {
          chargeback_amount: number;
          chargeback_date: string;
          commission_id?: string | null;
          created_at?: string | null;
          id?: string;
          reason?: string | null;
          resolution_date?: string | null;
          resolution_notes?: string | null;
          status?: Database["public"]["Enums"]["chargeback_status"] | null;
          updated_at?: string | null;
        };
        Update: {
          chargeback_amount?: number;
          chargeback_date?: string;
          commission_id?: string | null;
          created_at?: string | null;
          id?: string;
          reason?: string | null;
          resolution_date?: string | null;
          resolution_notes?: string | null;
          status?: Database["public"]["Enums"]["chargeback_status"] | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "chargebacks_commission_id_fkey";
            columns: ["commission_id"];
            isOneToOne: false;
            referencedRelation: "commission_earning_detail";
            referencedColumns: ["commission_id"];
          },
          {
            foreignKeyName: "chargebacks_commission_id_fkey";
            columns: ["commission_id"];
            isOneToOne: false;
            referencedRelation: "commission_earning_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chargebacks_commission_id_fkey";
            columns: ["commission_id"];
            isOneToOne: false;
            referencedRelation: "commissions";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_bot_agents: {
        Row: {
          billing_exempt: boolean;
          created_at: string | null;
          error_message: string | null;
          external_agent_id: string;
          id: string;
          provisioning_status: string;
          tier_id: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          billing_exempt?: boolean;
          created_at?: string | null;
          error_message?: string | null;
          external_agent_id: string;
          id?: string;
          provisioning_status?: string;
          tier_id?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          billing_exempt?: boolean;
          created_at?: string | null;
          error_message?: string | null;
          external_agent_id?: string;
          id?: string;
          provisioning_status?: string;
          tier_id?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_bot_agents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_bot_agents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_bot_agents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_bot_conversation_reviews: {
        Row: {
          agent_snapshot: Json | null;
          close_lead_id: string | null;
          conversation_snapshot: Json | null;
          conversation_status: string | null;
          created_at: string;
          external_agent_id: string;
          external_conversation_id: string | null;
          findings: Json;
          found_conversation: boolean;
          gaps: Json;
          human_verdict: string | null;
          id: string;
          improvement_brief: string | null;
          inbound_count: number;
          outbound_count: number;
          primary_reason: string;
          primary_reason_code: string;
          prompt_version: string | null;
          resolution_status: string;
          review_mode: string;
          review_payload: Json;
          target_payload: Json;
          timeline: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agent_snapshot?: Json | null;
          close_lead_id?: string | null;
          conversation_snapshot?: Json | null;
          conversation_status?: string | null;
          created_at?: string;
          external_agent_id: string;
          external_conversation_id?: string | null;
          findings?: Json;
          found_conversation?: boolean;
          gaps?: Json;
          human_verdict?: string | null;
          id?: string;
          improvement_brief?: string | null;
          inbound_count?: number;
          outbound_count?: number;
          primary_reason: string;
          primary_reason_code: string;
          prompt_version?: string | null;
          resolution_status?: string;
          review_mode: string;
          review_payload?: Json;
          target_payload?: Json;
          timeline?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agent_snapshot?: Json | null;
          close_lead_id?: string | null;
          conversation_snapshot?: Json | null;
          conversation_status?: string | null;
          created_at?: string;
          external_agent_id?: string;
          external_conversation_id?: string | null;
          findings?: Json;
          found_conversation?: boolean;
          gaps?: Json;
          human_verdict?: string | null;
          id?: string;
          improvement_brief?: string | null;
          inbound_count?: number;
          outbound_count?: number;
          primary_reason?: string;
          primary_reason_code?: string;
          prompt_version?: string | null;
          resolution_status?: string;
          review_mode?: string;
          review_payload?: Json;
          target_payload?: Json;
          timeline?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_bot_conversation_reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_bot_conversation_reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_bot_conversation_reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_bot_playground_runs: {
        Row: {
          chat_bot_agent_id: string;
          close_lead_id: string;
          created_at: string;
          final_reply: string;
          guardrail_violations: Json;
          id: string;
          inbound_override: string | null;
          metadata: Json;
          mode: string;
          raw_reply: string;
          system_prompt: string | null;
          system_prompt_override: string | null;
          user_id: string;
          would_send: boolean;
        };
        Insert: {
          chat_bot_agent_id: string;
          close_lead_id: string;
          created_at?: string;
          final_reply: string;
          guardrail_violations?: Json;
          id?: string;
          inbound_override?: string | null;
          metadata?: Json;
          mode: string;
          raw_reply: string;
          system_prompt?: string | null;
          system_prompt_override?: string | null;
          user_id: string;
          would_send: boolean;
        };
        Update: {
          chat_bot_agent_id?: string;
          close_lead_id?: string;
          created_at?: string;
          final_reply?: string;
          guardrail_violations?: Json;
          id?: string;
          inbound_override?: string | null;
          metadata?: Json;
          mode?: string;
          raw_reply?: string;
          system_prompt?: string | null;
          system_prompt_override?: string | null;
          user_id?: string;
          would_send?: boolean;
        };
        Relationships: [];
      };
      chat_bot_team_overrides: {
        Row: {
          created_at: string;
          granted_by: string | null;
          id: string;
          reason: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          granted_by?: string | null;
          id?: string;
          reason?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string | null;
          id?: string;
          reason?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_bot_team_overrides_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_bot_team_overrides_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_bot_team_overrides_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_bot_team_overrides_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_bot_team_overrides_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_bot_team_overrides_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          address: string | null;
          created_at: string | null;
          date_of_birth: string | null;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          state: string | null;
          status: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string | null;
          date_of_birth?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          state?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string | null;
          date_of_birth?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          state?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      close_ai_generations: {
        Row: {
          close_child_ids: string[] | null;
          close_id: string | null;
          created_at: string;
          generation_type: string;
          id: string;
          input_tokens: number | null;
          model_used: string;
          options: Json;
          output_json: Json;
          output_tokens: number | null;
          prompt: string;
          saved_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          close_child_ids?: string[] | null;
          close_id?: string | null;
          created_at?: string;
          generation_type: string;
          id?: string;
          input_tokens?: number | null;
          model_used: string;
          options?: Json;
          output_json: Json;
          output_tokens?: number | null;
          prompt: string;
          saved_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          close_child_ids?: string[] | null;
          close_id?: string | null;
          created_at?: string;
          generation_type?: string;
          id?: string;
          input_tokens?: number | null;
          model_used?: string;
          options?: Json;
          output_json?: Json;
          output_tokens?: number | null;
          prompt?: string;
          saved_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      close_config: {
        Row: {
          ai_smart_view_id: string | null;
          ai_smart_view_synced_at: string | null;
          api_key_encrypted: string;
          created_at: string;
          id: string;
          is_active: boolean;
          last_verified_at: string | null;
          organization_id: string | null;
          organization_name: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_smart_view_id?: string | null;
          ai_smart_view_synced_at?: string | null;
          api_key_encrypted: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_verified_at?: string | null;
          organization_id?: string | null;
          organization_name?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_smart_view_id?: string | null;
          ai_smart_view_synced_at?: string | null;
          api_key_encrypted?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_verified_at?: string | null;
          organization_id?: string | null;
          organization_name?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "close_config_user_profiles_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "close_config_user_profiles_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "close_config_user_profiles_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      close_kpi_cache: {
        Row: {
          cache_key: string;
          expires_at: string;
          fetched_at: string;
          id: string;
          resource_key: string;
          resource_scope: string;
          result: Json;
          user_id: string;
          widget_id: string | null;
        };
        Insert: {
          cache_key: string;
          expires_at?: string;
          fetched_at?: string;
          id?: string;
          resource_key: string;
          resource_scope?: string;
          result?: Json;
          user_id: string;
          widget_id?: string | null;
        };
        Update: {
          cache_key?: string;
          expires_at?: string;
          fetched_at?: string;
          id?: string;
          resource_key?: string;
          resource_scope?: string;
          result?: Json;
          user_id?: string;
          widget_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "close_kpi_cache_widget_id_fkey";
            columns: ["widget_id"];
            isOneToOne: false;
            referencedRelation: "close_kpi_widgets";
            referencedColumns: ["id"];
          },
        ];
      };
      close_kpi_dashboards: {
        Row: {
          created_at: string;
          global_config: Json;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          global_config?: Json;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          global_config?: Json;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      close_kpi_widget_templates: {
        Row: {
          category: string;
          created_at: string;
          default_config: Json;
          description: string | null;
          icon: string | null;
          id: string;
          name: string;
          sort_order: number;
          widget_type: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          default_config?: Json;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          widget_type: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          default_config?: Json;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          widget_type?: string;
        };
        Relationships: [];
      };
      close_kpi_widgets: {
        Row: {
          config: Json;
          created_at: string;
          dashboard_id: string;
          id: string;
          position_order: number;
          size: string;
          title: string;
          updated_at: string;
          user_id: string;
          widget_type: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          dashboard_id: string;
          id?: string;
          position_order?: number;
          size?: string;
          title: string;
          updated_at?: string;
          user_id: string;
          widget_type: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          dashboard_id?: string;
          id?: string;
          position_order?: number;
          size?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          widget_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "close_kpi_widgets_dashboard_id_fkey";
            columns: ["dashboard_id"];
            isOneToOne: false;
            referencedRelation: "close_kpi_dashboards";
            referencedColumns: ["id"];
          },
        ];
      };
      close_webhook_logs: {
        Row: {
          changed_fields: string[] | null;
          error_message: string | null;
          event_action: string | null;
          id: string;
          lead_id: string | null;
          opportunity_id: string | null;
          organization_id: string | null;
          outcome: string;
          outcome_reason: string | null;
          raw_payload: Json | null;
          received_at: string;
          status_label: string | null;
          user_id: string | null;
        };
        Insert: {
          changed_fields?: string[] | null;
          error_message?: string | null;
          event_action?: string | null;
          id?: string;
          lead_id?: string | null;
          opportunity_id?: string | null;
          organization_id?: string | null;
          outcome: string;
          outcome_reason?: string | null;
          raw_payload?: Json | null;
          received_at?: string;
          status_label?: string | null;
          user_id?: string | null;
        };
        Update: {
          changed_fields?: string[] | null;
          error_message?: string | null;
          event_action?: string | null;
          id?: string;
          lead_id?: string | null;
          opportunity_id?: string | null;
          organization_id?: string | null;
          outcome?: string;
          outcome_reason?: string | null;
          raw_payload?: Json | null;
          received_at?: string;
          status_label?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      commissions: {
        Row: {
          advance_months: number;
          amount: number;
          chargeback_amount: number | null;
          chargeback_date: string | null;
          chargeback_reason: string | null;
          created_at: string | null;
          earned_amount: number;
          id: string;
          imo_id: string | null;
          last_payment_date: string | null;
          month_number: number | null;
          months_paid: number;
          notes: string | null;
          original_advance: number | null;
          overage_amount: number | null;
          overage_start_month: number | null;
          payment_date: string | null;
          policy_id: string | null;
          related_advance_id: string | null;
          status: string;
          type: string;
          unearned_amount: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          advance_months?: number;
          amount: number;
          chargeback_amount?: number | null;
          chargeback_date?: string | null;
          chargeback_reason?: string | null;
          created_at?: string | null;
          earned_amount?: number;
          id?: string;
          imo_id?: string | null;
          last_payment_date?: string | null;
          month_number?: number | null;
          months_paid?: number;
          notes?: string | null;
          original_advance?: number | null;
          overage_amount?: number | null;
          overage_start_month?: number | null;
          payment_date?: string | null;
          policy_id?: string | null;
          related_advance_id?: string | null;
          status?: string;
          type: string;
          unearned_amount?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          advance_months?: number;
          amount?: number;
          chargeback_amount?: number | null;
          chargeback_date?: string | null;
          chargeback_reason?: string | null;
          created_at?: string | null;
          earned_amount?: number;
          id?: string;
          imo_id?: string | null;
          last_payment_date?: string | null;
          month_number?: number | null;
          months_paid?: number;
          notes?: string | null;
          original_advance?: number | null;
          overage_amount?: number | null;
          overage_start_month?: number | null;
          payment_date?: string | null;
          policy_id?: string | null;
          related_advance_id?: string | null;
          status?: string;
          type?: string;
          unearned_amount?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commissions_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: false;
            referencedRelation: "policies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_related_advance_id_fkey";
            columns: ["related_advance_id"];
            isOneToOne: false;
            referencedRelation: "commission_earning_detail";
            referencedColumns: ["commission_id"];
          },
          {
            foreignKeyName: "commissions_related_advance_id_fkey";
            columns: ["related_advance_id"];
            isOneToOne: false;
            referencedRelation: "commission_earning_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_related_advance_id_fkey";
            columns: ["related_advance_id"];
            isOneToOne: false;
            referencedRelation: "commissions";
            referencedColumns: ["id"];
          },
        ];
      };
      communication_preferences: {
        Row: {
          contact_id: string;
          contact_type: string;
          created_at: string | null;
          do_not_contact: boolean | null;
          email_opt_in: boolean | null;
          id: string;
          preferred_channel: string | null;
          slack_enabled: boolean | null;
          sms_opt_in: boolean | null;
          unsubscribe_reason: string | null;
          unsubscribed_at: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          contact_id: string;
          contact_type: string;
          created_at?: string | null;
          do_not_contact?: boolean | null;
          email_opt_in?: boolean | null;
          id?: string;
          preferred_channel?: string | null;
          slack_enabled?: boolean | null;
          sms_opt_in?: boolean | null;
          unsubscribe_reason?: string | null;
          unsubscribed_at?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          contact_id?: string;
          contact_type?: string;
          created_at?: string | null;
          do_not_contact?: boolean | null;
          email_opt_in?: boolean | null;
          id?: string;
          preferred_channel?: string | null;
          slack_enabled?: boolean | null;
          sms_opt_in?: boolean | null;
          unsubscribe_reason?: string | null;
          unsubscribed_at?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      comp_guide: {
        Row: {
          bonus_percentage: number | null;
          carrier_id: string | null;
          commission_percentage: number;
          contract_level: number;
          created_at: string | null;
          effective_date: string;
          expiration_date: string | null;
          id: string;
          imo_id: string | null;
          maximum_premium: number | null;
          minimum_premium: number | null;
          product_id: string | null;
          product_type: Database["public"]["Enums"]["product_type"];
          updated_at: string | null;
        };
        Insert: {
          bonus_percentage?: number | null;
          carrier_id?: string | null;
          commission_percentage: number;
          contract_level: number;
          created_at?: string | null;
          effective_date: string;
          expiration_date?: string | null;
          id?: string;
          imo_id?: string | null;
          maximum_premium?: number | null;
          minimum_premium?: number | null;
          product_id?: string | null;
          product_type: Database["public"]["Enums"]["product_type"];
          updated_at?: string | null;
        };
        Update: {
          bonus_percentage?: number | null;
          carrier_id?: string | null;
          commission_percentage?: number;
          contract_level?: number;
          created_at?: string | null;
          effective_date?: string;
          expiration_date?: string | null;
          id?: string;
          imo_id?: string | null;
          maximum_premium?: number | null;
          minimum_premium?: number | null;
          product_id?: string | null;
          product_type?: Database["public"]["Enums"]["product_type"];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "comp_guide_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comp_guide_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comp_guide_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      constants: {
        Row: {
          category: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          key: string;
          updated_at: string | null;
          value: number;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          key: string;
          updated_at?: string | null;
          value: number;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          key?: string;
          updated_at?: string | null;
          value?: number;
        };
        Relationships: [];
      };
      contact_favorites: {
        Row: {
          client_id: string | null;
          contact_user_id: string | null;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          client_id?: string | null;
          contact_user_id?: string | null;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          client_id?: string | null;
          contact_user_id?: string | null;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_favorites_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_favorites_contact_user_id_fkey";
            columns: ["contact_user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_favorites_contact_user_id_fkey";
            columns: ["contact_user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_favorites_contact_user_id_fkey";
            columns: ["contact_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contract_documents: {
        Row: {
          agent_id: string;
          contract_id: string | null;
          created_at: string | null;
          document_name: string;
          document_type: string;
          expires_at: string | null;
          file_path: string;
          file_size: number | null;
          id: string;
          imo_id: string | null;
          mime_type: string | null;
          notes: string | null;
          review_notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string | null;
          updated_at: string | null;
          uploaded_by: string | null;
        };
        Insert: {
          agent_id: string;
          contract_id?: string | null;
          created_at?: string | null;
          document_name: string;
          document_type: string;
          expires_at?: string | null;
          file_path: string;
          file_size?: number | null;
          id?: string;
          imo_id?: string | null;
          mime_type?: string | null;
          notes?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string | null;
          updated_at?: string | null;
          uploaded_by?: string | null;
        };
        Update: {
          agent_id?: string;
          contract_id?: string | null;
          created_at?: string | null;
          document_name?: string;
          document_type?: string;
          expires_at?: string | null;
          file_path?: string;
          file_size?: number | null;
          id?: string;
          imo_id?: string | null;
          mime_type?: string | null;
          notes?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string | null;
          updated_at?: string | null;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contract_documents_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "agent_contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cross_org_clone_log: {
        Row: {
          caller_id: string;
          cloned_at: string;
          error_code: string | null;
          error_message: string | null;
          id: string;
          item_type: string;
          source_item_id: string;
          status: string;
          target_child_ids: string[] | null;
          target_id: string;
          target_item_id: string | null;
          warnings: Json | null;
        };
        Insert: {
          caller_id: string;
          cloned_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          item_type: string;
          source_item_id: string;
          status: string;
          target_child_ids?: string[] | null;
          target_id: string;
          target_item_id?: string | null;
          warnings?: Json | null;
        };
        Update: {
          caller_id?: string;
          cloned_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          item_type?: string;
          source_item_id?: string;
          status?: string;
          target_child_ids?: string[] | null;
          target_id?: string;
          target_item_id?: string | null;
          warnings?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "cross_org_clone_log_caller_id_fkey";
            columns: ["caller_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cross_org_clone_log_caller_id_fkey";
            columns: ["caller_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cross_org_clone_log_caller_id_fkey";
            columns: ["caller_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cross_org_clone_log_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cross_org_clone_log_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cross_org_clone_log_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      custom_domains: {
        Row: {
          created_at: string;
          hostname: string;
          id: string;
          imo_id: string;
          last_error: string | null;
          provider: string;
          provider_domain_id: string | null;
          provider_metadata: Json | null;
          status: Database["public"]["Enums"]["custom_domain_status"];
          updated_at: string;
          user_id: string;
          verification_token: string;
          verified_at: string | null;
        };
        Insert: {
          created_at?: string;
          hostname: string;
          id?: string;
          imo_id: string;
          last_error?: string | null;
          provider?: string;
          provider_domain_id?: string | null;
          provider_metadata?: Json | null;
          status?: Database["public"]["Enums"]["custom_domain_status"];
          updated_at?: string;
          user_id: string;
          verification_token: string;
          verified_at?: string | null;
        };
        Update: {
          created_at?: string;
          hostname?: string;
          id?: string;
          imo_id?: string;
          last_error?: string | null;
          provider?: string;
          provider_domain_id?: string | null;
          provider_metadata?: Json | null;
          status?: Database["public"]["Enums"]["custom_domain_status"];
          updated_at?: string;
          user_id?: string;
          verification_token?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "custom_domains_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_sales_logs: {
        Row: {
          channel_id: string;
          created_at: string | null;
          first_sale_group_id: string | null;
          first_seller_id: string | null;
          hierarchy_depth: number | null;
          id: string;
          imo_id: string;
          last_ap_milestone: number | null;
          last_policy_milestone: number | null;
          last_post_attempted_at: string | null;
          last_post_error: string | null;
          last_sms_milestone_date: string | null;
          leaderboard_message_ts: string | null;
          log_date: string;
          pending_policy_data: Json | null;
          slack_integration_id: string | null;
          title: string | null;
          title_set_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          channel_id: string;
          created_at?: string | null;
          first_sale_group_id?: string | null;
          first_seller_id?: string | null;
          hierarchy_depth?: number | null;
          id?: string;
          imo_id: string;
          last_ap_milestone?: number | null;
          last_policy_milestone?: number | null;
          last_post_attempted_at?: string | null;
          last_post_error?: string | null;
          last_sms_milestone_date?: string | null;
          leaderboard_message_ts?: string | null;
          log_date?: string;
          pending_policy_data?: Json | null;
          slack_integration_id?: string | null;
          title?: string | null;
          title_set_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          channel_id?: string;
          created_at?: string | null;
          first_sale_group_id?: string | null;
          first_seller_id?: string | null;
          hierarchy_depth?: number | null;
          id?: string;
          imo_id?: string;
          last_ap_milestone?: number | null;
          last_policy_milestone?: number | null;
          last_post_attempted_at?: string | null;
          last_post_error?: string | null;
          last_sms_milestone_date?: string | null;
          leaderboard_message_ts?: string | null;
          log_date?: string;
          pending_policy_data?: Json | null;
          slack_integration_id?: string | null;
          title?: string | null;
          title_set_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "daily_sales_logs_first_seller_id_fkey";
            columns: ["first_seller_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_logs_first_seller_id_fkey";
            columns: ["first_seller_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_logs_first_seller_id_fkey";
            columns: ["first_seller_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_logs_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_sales_logs_slack_integration_id_fkey";
            columns: ["slack_integration_id"];
            isOneToOne: false;
            referencedRelation: "slack_integrations";
            referencedColumns: ["id"];
          },
        ];
      };
      elevenlabs_config: {
        Row: {
          api_key_encrypted: string;
          created_at: string;
          default_voice_id: string | null;
          default_voice_name: string | null;
          id: string;
          imo_id: string;
          is_active: boolean;
          updated_at: string;
        };
        Insert: {
          api_key_encrypted: string;
          created_at?: string;
          default_voice_id?: string | null;
          default_voice_name?: string | null;
          id?: string;
          imo_id: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          api_key_encrypted?: string;
          created_at?: string;
          default_voice_id?: string | null;
          default_voice_name?: string | null;
          id?: string;
          imo_id?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "elevenlabs_config_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: true;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      email_labels: {
        Row: {
          color: string;
          created_at: string | null;
          icon: string | null;
          id: string;
          is_system: boolean;
          message_count: number;
          name: string;
          sort_order: number;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          is_system?: boolean;
          message_count?: number;
          name: string;
          sort_order?: number;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          is_system?: boolean;
          message_count?: number;
          name?: string;
          sort_order?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      email_queue: {
        Row: {
          body_html: string;
          body_text: string | null;
          created_at: string | null;
          error_message: string | null;
          id: string;
          recipient_id: string | null;
          sent_at: string | null;
          status: string;
          subject: string;
          template_id: string | null;
          updated_at: string | null;
          variables: Json | null;
        };
        Insert: {
          body_html: string;
          body_text?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          recipient_id?: string | null;
          sent_at?: string | null;
          status?: string;
          subject: string;
          template_id?: string | null;
          updated_at?: string | null;
          variables?: Json | null;
        };
        Update: {
          body_html?: string;
          body_text?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          recipient_id?: string | null;
          sent_at?: string | null;
          status?: string;
          subject?: string;
          template_id?: string | null;
          updated_at?: string | null;
          variables?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_queue_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_queue_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_queue_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_queue_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "email_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      email_quota_tracking: {
        Row: {
          cost_cents: number;
          date: string;
          emails_sent: number | null;
          id: string;
          provider: string;
          user_id: string;
        };
        Insert: {
          cost_cents?: number;
          date?: string;
          emails_sent?: number | null;
          id?: string;
          provider: string;
          user_id: string;
        };
        Update: {
          cost_cents?: number;
          date?: string;
          emails_sent?: number | null;
          id?: string;
          provider?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_quota_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_quota_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_quota_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      email_scheduled: {
        Row: {
          created_at: string | null;
          email_id: string | null;
          error_message: string | null;
          id: string;
          max_retries: number | null;
          processed_at: string | null;
          retry_count: number | null;
          scheduled_for: string;
          status: string;
          timezone: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          email_id?: string | null;
          error_message?: string | null;
          id?: string;
          max_retries?: number | null;
          processed_at?: string | null;
          retry_count?: number | null;
          scheduled_for: string;
          status?: string;
          timezone?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          email_id?: string | null;
          error_message?: string | null;
          id?: string;
          max_retries?: number | null;
          processed_at?: string | null;
          retry_count?: number | null;
          scheduled_for?: string;
          status?: string;
          timezone?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_scheduled_email_id_fkey";
            columns: ["email_id"];
            isOneToOne: false;
            referencedRelation: "user_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      email_signatures: {
        Row: {
          content_html: string;
          content_text: string;
          created_at: string | null;
          id: string;
          include_social_links: boolean | null;
          is_default: boolean;
          name: string;
          social_links: Json | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          content_html: string;
          content_text: string;
          created_at?: string | null;
          id?: string;
          include_social_links?: boolean | null;
          is_default?: boolean;
          name: string;
          social_links?: Json | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          content_html?: string;
          content_text?: string;
          created_at?: string | null;
          id?: string;
          include_social_links?: boolean | null;
          is_default?: boolean;
          name?: string;
          social_links?: Json | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      email_snippets: {
        Row: {
          category: string | null;
          content_html: string;
          content_text: string;
          created_at: string | null;
          id: string;
          last_used_at: string | null;
          name: string;
          shortcut: string | null;
          updated_at: string | null;
          usage_count: number | null;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          content_html: string;
          content_text: string;
          created_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          name: string;
          shortcut?: string | null;
          updated_at?: string | null;
          usage_count?: number | null;
          user_id: string;
        };
        Update: {
          category?: string | null;
          content_html?: string;
          content_text?: string;
          created_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          name?: string;
          shortcut?: string | null;
          updated_at?: string | null;
          usage_count?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      email_templates: {
        Row: {
          blocks: Json | null;
          body_html: string;
          body_text: string | null;
          category: string | null;
          created_at: string | null;
          created_by: string | null;
          id: string;
          is_active: boolean | null;
          is_block_template: boolean | null;
          is_global: boolean | null;
          name: string;
          subject: string;
          updated_at: string | null;
          usage_count: number | null;
          variables: string[] | null;
        };
        Insert: {
          blocks?: Json | null;
          body_html: string;
          body_text?: string | null;
          category?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_block_template?: boolean | null;
          is_global?: boolean | null;
          name: string;
          subject: string;
          updated_at?: string | null;
          usage_count?: number | null;
          variables?: string[] | null;
        };
        Update: {
          blocks?: Json | null;
          body_html?: string;
          body_text?: string | null;
          category?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_block_template?: boolean | null;
          is_global?: boolean | null;
          name?: string;
          subject?: string;
          updated_at?: string | null;
          usage_count?: number | null;
          variables?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      email_threads: {
        Row: {
          created_at: string | null;
          id: string;
          is_archived: boolean;
          is_starred: boolean;
          labels: string[] | null;
          last_message_at: string;
          message_count: number;
          participant_emails: string[];
          snippet: string | null;
          subject: string;
          subject_hash: string;
          unread_count: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_archived?: boolean;
          is_starred?: boolean;
          labels?: string[] | null;
          last_message_at?: string;
          message_count?: number;
          participant_emails?: string[];
          snippet?: string | null;
          subject: string;
          subject_hash: string;
          unread_count?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_archived?: boolean;
          is_starred?: boolean;
          labels?: string[] | null;
          last_message_at?: string;
          message_count?: number;
          participant_emails?: string[];
          snippet?: string | null;
          subject?: string;
          subject_hash?: string;
          unread_count?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      email_tracking_events: {
        Row: {
          city: string | null;
          country: string | null;
          created_at: string | null;
          device_type: string | null;
          email_id: string;
          event_type: string;
          id: string;
          ip_address: unknown;
          link_index: number | null;
          link_url: string | null;
          tracking_id: string;
          user_agent: string | null;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          created_at?: string | null;
          device_type?: string | null;
          email_id: string;
          event_type: string;
          id?: string;
          ip_address?: unknown;
          link_index?: number | null;
          link_url?: string | null;
          tracking_id: string;
          user_agent?: string | null;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          created_at?: string | null;
          device_type?: string | null;
          email_id?: string;
          event_type?: string;
          id?: string;
          ip_address?: unknown;
          link_index?: number | null;
          link_url?: string | null;
          tracking_id?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_tracking_events_email_id_fkey";
            columns: ["email_id"];
            isOneToOne: false;
            referencedRelation: "user_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      email_tracking_links: {
        Row: {
          click_count: number | null;
          created_at: string | null;
          email_id: string;
          first_clicked_at: string | null;
          id: string;
          link_index: number;
          link_text: string | null;
          original_url: string;
          tracking_id: string;
        };
        Insert: {
          click_count?: number | null;
          created_at?: string | null;
          email_id: string;
          first_clicked_at?: string | null;
          id?: string;
          link_index: number;
          link_text?: string | null;
          original_url: string;
          tracking_id: string;
        };
        Update: {
          click_count?: number | null;
          created_at?: string | null;
          email_id?: string;
          first_clicked_at?: string | null;
          id?: string;
          link_index?: number;
          link_text?: string | null;
          original_url?: string;
          tracking_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_tracking_links_email_id_fkey";
            columns: ["email_id"];
            isOneToOne: false;
            referencedRelation: "user_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      email_triggers: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          delay_minutes: number | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          template_id: string;
          trigger_config: Json;
          trigger_type: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          delay_minutes?: number | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          template_id: string;
          trigger_config: Json;
          trigger_type: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          delay_minutes?: number | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          template_id?: string;
          trigger_config?: Json;
          trigger_type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_triggers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_triggers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_triggers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_triggers_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "email_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      email_watch_subscriptions: {
        Row: {
          created_at: string | null;
          expiration: string | null;
          history_id: string | null;
          id: string;
          provider: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          expiration?: string | null;
          history_id?: string | null;
          id?: string;
          provider: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          expiration?: string | null;
          history_id?: string | null;
          id?: string;
          provider?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_watch_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_watch_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_watch_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      email_webhook_events: {
        Row: {
          created_at: string | null;
          email_id: string | null;
          event_id: string;
          event_type: string;
          id: string;
          message_id: string | null;
          payload: Json | null;
          processed_at: string | null;
          provider: string;
        };
        Insert: {
          created_at?: string | null;
          email_id?: string | null;
          event_id: string;
          event_type: string;
          id?: string;
          message_id?: string | null;
          payload?: Json | null;
          processed_at?: string | null;
          provider: string;
        };
        Update: {
          created_at?: string | null;
          email_id?: string | null;
          event_id?: string;
          event_type?: string;
          id?: string;
          message_id?: string | null;
          payload?: Json | null;
          processed_at?: string | null;
          provider?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_webhook_events_email_id_fkey";
            columns: ["email_id"];
            isOneToOne: false;
            referencedRelation: "user_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_templates: {
        Row: {
          amount: number;
          category: string;
          created_at: string | null;
          description: string | null;
          expense_type: Database["public"]["Enums"]["expense_type"];
          id: string;
          is_tax_deductible: boolean;
          notes: string | null;
          recurring_frequency: string | null;
          template_name: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string | null;
          description?: string | null;
          expense_type?: Database["public"]["Enums"]["expense_type"];
          id?: string;
          is_tax_deductible?: boolean;
          notes?: string | null;
          recurring_frequency?: string | null;
          template_name: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string | null;
          description?: string | null;
          expense_type?: Database["public"]["Enums"]["expense_type"];
          id?: string;
          is_tax_deductible?: boolean;
          notes?: string | null;
          recurring_frequency?: string | null;
          template_name?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          agency_id: string | null;
          amount: number;
          category: string;
          created_at: string | null;
          date: string;
          description: string;
          expense_type: Database["public"]["Enums"]["expense_type"];
          id: string;
          imo_id: string | null;
          is_recurring: boolean | null;
          is_tax_deductible: boolean;
          lead_purchase_id: string | null;
          name: string;
          notes: string | null;
          receipt_url: string | null;
          recurring_end_date: string | null;
          recurring_frequency: string | null;
          recurring_group_id: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          agency_id?: string | null;
          amount: number;
          category: string;
          created_at?: string | null;
          date: string;
          description: string;
          expense_type?: Database["public"]["Enums"]["expense_type"];
          id?: string;
          imo_id?: string | null;
          is_recurring?: boolean | null;
          is_tax_deductible?: boolean;
          lead_purchase_id?: string | null;
          name: string;
          notes?: string | null;
          receipt_url?: string | null;
          recurring_end_date?: string | null;
          recurring_frequency?: string | null;
          recurring_group_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          agency_id?: string | null;
          amount?: number;
          category?: string;
          created_at?: string | null;
          date?: string;
          description?: string;
          expense_type?: Database["public"]["Enums"]["expense_type"];
          id?: string;
          imo_id?: string | null;
          is_recurring?: boolean | null;
          is_tax_deductible?: boolean;
          lead_purchase_id?: string | null;
          name?: string;
          notes?: string | null;
          receipt_url?: string | null;
          recurring_end_date?: string | null;
          recurring_frequency?: string | null;
          recurring_group_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_lead_purchase_id_fkey";
            columns: ["lead_purchase_id"];
            isOneToOne: false;
            referencedRelation: "lead_purchases";
            referencedColumns: ["id"];
          },
        ];
      };
      global_expense_categories: {
        Row: {
          category_type: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          category_type?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category_type?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      gmail_integrations: {
        Row: {
          access_token_encrypted: string;
          api_calls_reset_at: string | null;
          api_calls_today: number | null;
          connection_status: Database["public"]["Enums"]["gmail_connection_status"];
          created_at: string | null;
          gmail_address: string;
          gmail_name: string | null;
          gmail_picture_url: string | null;
          gmail_user_id: string;
          history_id: string | null;
          id: string;
          is_active: boolean;
          last_connected_at: string | null;
          last_error: string | null;
          last_error_at: string | null;
          last_full_sync_at: string | null;
          last_refresh_at: string | null;
          last_synced_at: string | null;
          refresh_token_encrypted: string;
          scopes: string[];
          token_expires_at: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          access_token_encrypted: string;
          api_calls_reset_at?: string | null;
          api_calls_today?: number | null;
          connection_status?: Database["public"]["Enums"]["gmail_connection_status"];
          created_at?: string | null;
          gmail_address: string;
          gmail_name?: string | null;
          gmail_picture_url?: string | null;
          gmail_user_id: string;
          history_id?: string | null;
          id?: string;
          is_active?: boolean;
          last_connected_at?: string | null;
          last_error?: string | null;
          last_error_at?: string | null;
          last_full_sync_at?: string | null;
          last_refresh_at?: string | null;
          last_synced_at?: string | null;
          refresh_token_encrypted: string;
          scopes?: string[];
          token_expires_at: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          access_token_encrypted?: string;
          api_calls_reset_at?: string | null;
          api_calls_today?: number | null;
          connection_status?: Database["public"]["Enums"]["gmail_connection_status"];
          created_at?: string | null;
          gmail_address?: string;
          gmail_name?: string | null;
          gmail_picture_url?: string | null;
          gmail_user_id?: string;
          history_id?: string | null;
          id?: string;
          is_active?: boolean;
          last_connected_at?: string | null;
          last_error?: string | null;
          last_error_at?: string | null;
          last_full_sync_at?: string | null;
          last_refresh_at?: string | null;
          last_synced_at?: string | null;
          refresh_token_encrypted?: string;
          scopes?: string[];
          token_expires_at?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      gmail_sync_log: {
        Row: {
          created_at: string | null;
          duration_ms: number | null;
          error_message: string | null;
          history_id_after: string | null;
          history_id_before: string | null;
          id: string;
          integration_id: string;
          messages_failed: number | null;
          messages_synced: number | null;
          status: string;
          sync_type: string;
        };
        Insert: {
          created_at?: string | null;
          duration_ms?: number | null;
          error_message?: string | null;
          history_id_after?: string | null;
          history_id_before?: string | null;
          id?: string;
          integration_id: string;
          messages_failed?: number | null;
          messages_synced?: number | null;
          status: string;
          sync_type: string;
        };
        Update: {
          created_at?: string | null;
          duration_ms?: number | null;
          error_message?: string | null;
          history_id_after?: string | null;
          history_id_before?: string | null;
          id?: string;
          integration_id?: string;
          messages_failed?: number | null;
          messages_synced?: number | null;
          status?: string;
          sync_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gmail_sync_log_integration_id_fkey";
            columns: ["integration_id"];
            isOneToOne: false;
            referencedRelation: "gmail_integrations";
            referencedColumns: ["id"];
          },
        ];
      };
      hierarchy_invitations: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          invitee_email: string;
          invitee_id: string | null;
          inviter_id: string;
          message: string | null;
          responded_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          invitee_email: string;
          invitee_id?: string | null;
          inviter_id: string;
          message?: string | null;
          responded_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          invitee_email?: string;
          invitee_id?: string | null;
          inviter_id?: string;
          message?: string | null;
          responded_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      imos: {
        Row: {
          city: string | null;
          code: string;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          logo_url: string | null;
          name: string;
          primary_color: string | null;
          secondary_color: string | null;
          settings: Json | null;
          state: string | null;
          street_address: string | null;
          updated_at: string | null;
          website: string | null;
          zip: string | null;
        };
        Insert: {
          city?: string | null;
          code: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          name: string;
          primary_color?: string | null;
          secondary_color?: string | null;
          settings?: Json | null;
          state?: string | null;
          street_address?: string | null;
          updated_at?: string | null;
          website?: string | null;
          zip?: string | null;
        };
        Update: {
          city?: string | null;
          code?: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          name?: string;
          primary_color?: string | null;
          secondary_color?: string | null;
          settings?: Json | null;
          state?: string | null;
          street_address?: string | null;
          updated_at?: string | null;
          website?: string | null;
          zip?: string | null;
        };
        Relationships: [];
      };
      instagram_conversations: {
        Row: {
          auto_reminder_enabled: boolean | null;
          auto_reminder_hours: number | null;
          auto_reminder_template_id: string | null;
          can_reply_until: string | null;
          contact_notes: string | null;
          created_at: string | null;
          id: string;
          instagram_conversation_id: string;
          integration_id: string;
          is_priority: boolean | null;
          last_inbound_at: string | null;
          last_message_at: string | null;
          last_message_direction:
            | Database["public"]["Enums"]["message_direction"]
            | null;
          last_message_preview: string | null;
          participant_avatar_cached_at: string | null;
          participant_avatar_cached_url: string | null;
          participant_email: string | null;
          participant_instagram_id: string;
          participant_name: string | null;
          participant_phone: string | null;
          participant_profile_picture_url: string | null;
          participant_username: string | null;
          priority_notes: string | null;
          priority_set_at: string | null;
          priority_set_by: string | null;
          recruiting_lead_id: string | null;
          unread_count: number | null;
          updated_at: string | null;
        };
        Insert: {
          auto_reminder_enabled?: boolean | null;
          auto_reminder_hours?: number | null;
          auto_reminder_template_id?: string | null;
          can_reply_until?: string | null;
          contact_notes?: string | null;
          created_at?: string | null;
          id?: string;
          instagram_conversation_id: string;
          integration_id: string;
          is_priority?: boolean | null;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_direction?:
            | Database["public"]["Enums"]["message_direction"]
            | null;
          last_message_preview?: string | null;
          participant_avatar_cached_at?: string | null;
          participant_avatar_cached_url?: string | null;
          participant_email?: string | null;
          participant_instagram_id: string;
          participant_name?: string | null;
          participant_phone?: string | null;
          participant_profile_picture_url?: string | null;
          participant_username?: string | null;
          priority_notes?: string | null;
          priority_set_at?: string | null;
          priority_set_by?: string | null;
          recruiting_lead_id?: string | null;
          unread_count?: number | null;
          updated_at?: string | null;
        };
        Update: {
          auto_reminder_enabled?: boolean | null;
          auto_reminder_hours?: number | null;
          auto_reminder_template_id?: string | null;
          can_reply_until?: string | null;
          contact_notes?: string | null;
          created_at?: string | null;
          id?: string;
          instagram_conversation_id?: string;
          integration_id?: string;
          is_priority?: boolean | null;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_direction?:
            | Database["public"]["Enums"]["message_direction"]
            | null;
          last_message_preview?: string | null;
          participant_avatar_cached_at?: string | null;
          participant_avatar_cached_url?: string | null;
          participant_email?: string | null;
          participant_instagram_id?: string;
          participant_name?: string | null;
          participant_phone?: string | null;
          participant_profile_picture_url?: string | null;
          participant_username?: string | null;
          priority_notes?: string | null;
          priority_set_at?: string | null;
          priority_set_by?: string | null;
          recruiting_lead_id?: string | null;
          unread_count?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_instagram_conversations_recruiting_lead";
            columns: ["recruiting_lead_id"];
            isOneToOne: false;
            referencedRelation: "recruiting_leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "instagram_conversations_integration_id_fkey";
            columns: ["integration_id"];
            isOneToOne: false;
            referencedRelation: "instagram_integrations";
            referencedColumns: ["id"];
          },
        ];
      };
      instagram_integrations: {
        Row: {
          access_token_encrypted: string;
          api_calls_reset_at: string | null;
          api_calls_this_hour: number | null;
          connection_status: Database["public"]["Enums"]["instagram_connection_status"];
          created_at: string | null;
          facebook_page_id: string | null;
          facebook_page_name: string | null;
          id: string;
          imo_id: string;
          instagram_name: string | null;
          instagram_profile_picture_url: string | null;
          instagram_user_id: string;
          instagram_username: string;
          is_active: boolean;
          last_connected_at: string | null;
          last_error: string | null;
          last_error_at: string | null;
          last_refresh_at: string | null;
          scopes: string[];
          token_expires_at: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          access_token_encrypted: string;
          api_calls_reset_at?: string | null;
          api_calls_this_hour?: number | null;
          connection_status?: Database["public"]["Enums"]["instagram_connection_status"];
          created_at?: string | null;
          facebook_page_id?: string | null;
          facebook_page_name?: string | null;
          id?: string;
          imo_id: string;
          instagram_name?: string | null;
          instagram_profile_picture_url?: string | null;
          instagram_user_id: string;
          instagram_username: string;
          is_active?: boolean;
          last_connected_at?: string | null;
          last_error?: string | null;
          last_error_at?: string | null;
          last_refresh_at?: string | null;
          scopes?: string[];
          token_expires_at?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          access_token_encrypted?: string;
          api_calls_reset_at?: string | null;
          api_calls_this_hour?: number | null;
          connection_status?: Database["public"]["Enums"]["instagram_connection_status"];
          created_at?: string | null;
          facebook_page_id?: string | null;
          facebook_page_name?: string | null;
          id?: string;
          imo_id?: string;
          instagram_name?: string | null;
          instagram_profile_picture_url?: string | null;
          instagram_user_id?: string;
          instagram_username?: string;
          is_active?: boolean;
          last_connected_at?: string | null;
          last_error?: string | null;
          last_error_at?: string | null;
          last_refresh_at?: string | null;
          scopes?: string[];
          token_expires_at?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "instagram_integrations_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      instagram_job_queue: {
        Row: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          id: string;
          integration_id: string | null;
          job_type: Database["public"]["Enums"]["instagram_job_type"];
          last_error: string | null;
          max_attempts: number;
          payload: Json;
          priority: number;
          scheduled_for: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["instagram_job_status"];
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          integration_id?: string | null;
          job_type: Database["public"]["Enums"]["instagram_job_type"];
          last_error?: string | null;
          max_attempts?: number;
          payload: Json;
          priority?: number;
          scheduled_for?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["instagram_job_status"];
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          integration_id?: string | null;
          job_type?: Database["public"]["Enums"]["instagram_job_type"];
          last_error?: string | null;
          max_attempts?: number;
          payload?: Json;
          priority?: number;
          scheduled_for?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["instagram_job_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "instagram_job_queue_integration_id_fkey";
            columns: ["integration_id"];
            isOneToOne: false;
            referencedRelation: "instagram_integrations";
            referencedColumns: ["id"];
          },
        ];
      };
      instagram_message_templates: {
        Row: {
          category: string | null;
          content: string;
          created_at: string | null;
          created_by: string | null;
          id: string;
          imo_id: string;
          is_active: boolean | null;
          last_used_at: string | null;
          message_stage: string | null;
          name: string;
          platform: string;
          updated_at: string | null;
          use_count: number | null;
          user_id: string | null;
        };
        Insert: {
          category?: string | null;
          content: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          imo_id: string;
          is_active?: boolean | null;
          last_used_at?: string | null;
          message_stage?: string | null;
          name: string;
          platform?: string;
          updated_at?: string | null;
          use_count?: number | null;
          user_id?: string | null;
        };
        Update: {
          category?: string | null;
          content?: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          imo_id?: string;
          is_active?: boolean | null;
          last_used_at?: string | null;
          message_stage?: string | null;
          name?: string;
          platform?: string;
          updated_at?: string | null;
          use_count?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "instagram_message_templates_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      instagram_messages: {
        Row: {
          conversation_id: string;
          created_at: string | null;
          delivered_at: string | null;
          direction: Database["public"]["Enums"]["message_direction"];
          id: string;
          instagram_message_id: string;
          media_cached_at: string | null;
          media_cached_url: string | null;
          media_type: string | null;
          media_url: string | null;
          message_text: string | null;
          message_type: Database["public"]["Enums"]["instagram_message_type"];
          read_at: string | null;
          scheduled_message_id: string | null;
          sender_instagram_id: string;
          sender_username: string | null;
          sent_at: string;
          status: Database["public"]["Enums"]["instagram_message_status"];
          story_id: string | null;
          story_url: string | null;
          template_id: string | null;
        };
        Insert: {
          conversation_id: string;
          created_at?: string | null;
          delivered_at?: string | null;
          direction: Database["public"]["Enums"]["message_direction"];
          id?: string;
          instagram_message_id: string;
          media_cached_at?: string | null;
          media_cached_url?: string | null;
          media_type?: string | null;
          media_url?: string | null;
          message_text?: string | null;
          message_type?: Database["public"]["Enums"]["instagram_message_type"];
          read_at?: string | null;
          scheduled_message_id?: string | null;
          sender_instagram_id: string;
          sender_username?: string | null;
          sent_at: string;
          status?: Database["public"]["Enums"]["instagram_message_status"];
          story_id?: string | null;
          story_url?: string | null;
          template_id?: string | null;
        };
        Update: {
          conversation_id?: string;
          created_at?: string | null;
          delivered_at?: string | null;
          direction?: Database["public"]["Enums"]["message_direction"];
          id?: string;
          instagram_message_id?: string;
          media_cached_at?: string | null;
          media_cached_url?: string | null;
          media_type?: string | null;
          media_url?: string | null;
          message_text?: string | null;
          message_type?: Database["public"]["Enums"]["instagram_message_type"];
          read_at?: string | null;
          scheduled_message_id?: string | null;
          sender_instagram_id?: string;
          sender_username?: string | null;
          sent_at?: string;
          status?: Database["public"]["Enums"]["instagram_message_status"];
          story_id?: string | null;
          story_url?: string | null;
          template_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "instagram_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "instagram_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      instagram_scheduled_messages: {
        Row: {
          conversation_id: string;
          created_at: string | null;
          error_message: string | null;
          id: string;
          is_auto_reminder: boolean | null;
          message_text: string;
          messaging_window_expires_at: string;
          retry_count: number | null;
          scheduled_by: string;
          scheduled_for: string;
          sent_at: string | null;
          sent_message_id: string | null;
          status: Database["public"]["Enums"]["scheduled_message_status"];
          template_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          conversation_id: string;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          is_auto_reminder?: boolean | null;
          message_text: string;
          messaging_window_expires_at: string;
          retry_count?: number | null;
          scheduled_by: string;
          scheduled_for: string;
          sent_at?: string | null;
          sent_message_id?: string | null;
          status?: Database["public"]["Enums"]["scheduled_message_status"];
          template_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          conversation_id?: string;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          is_auto_reminder?: boolean | null;
          message_text?: string;
          messaging_window_expires_at?: string;
          retry_count?: number | null;
          scheduled_by?: string;
          scheduled_for?: string;
          sent_at?: string | null;
          sent_message_id?: string | null;
          status?: Database["public"]["Enums"]["scheduled_message_status"];
          template_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "instagram_scheduled_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "instagram_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "instagram_scheduled_messages_sent_message_id_fkey";
            columns: ["sent_message_id"];
            isOneToOne: false;
            referencedRelation: "instagram_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "instagram_scheduled_messages_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "instagram_message_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "instagram_scheduled_messages_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "message_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      instagram_template_categories: {
        Row: {
          created_at: string | null;
          display_order: number | null;
          id: string;
          is_active: boolean | null;
          name: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      instagram_usage_tracking: {
        Row: {
          api_calls_made: number | null;
          created_at: string | null;
          id: string;
          imo_id: string;
          messages_received: number | null;
          messages_sent: number | null;
          period_end: string;
          period_start: string;
          scheduled_messages_sent: number | null;
          templates_used: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          api_calls_made?: number | null;
          created_at?: string | null;
          id?: string;
          imo_id: string;
          messages_received?: number | null;
          messages_sent?: number | null;
          period_end: string;
          period_start: string;
          scheduled_messages_sent?: number | null;
          templates_used?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          api_calls_made?: number | null;
          created_at?: string | null;
          id?: string;
          imo_id?: string;
          messages_received?: number | null;
          messages_sent?: number | null;
          period_end?: string;
          period_start?: string;
          scheduled_messages_sent?: number | null;
          templates_used?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "instagram_usage_tracking_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      join_requests: {
        Row: {
          agency_id: string | null;
          approver_id: string;
          created_at: string;
          id: string;
          imo_id: string;
          message: string | null;
          rejection_reason: string | null;
          requested_at: string;
          requested_upline_id: string | null;
          requester_id: string;
          reviewed_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          agency_id?: string | null;
          approver_id: string;
          created_at?: string;
          id?: string;
          imo_id: string;
          message?: string | null;
          rejection_reason?: string | null;
          requested_at?: string;
          requested_upline_id?: string | null;
          requester_id: string;
          reviewed_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string | null;
          approver_id?: string;
          created_at?: string;
          id?: string;
          imo_id?: string;
          message?: string | null;
          rejection_reason?: string | null;
          requested_at?: string;
          requested_upline_id?: string | null;
          requester_id?: string;
          reviewed_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "join_requests_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_requested_upline_id_fkey";
            columns: ["requested_upline_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_requested_upline_id_fkey";
            columns: ["requested_upline_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_requested_upline_id_fkey";
            columns: ["requested_upline_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      landing_page_settings: {
        Row: {
          about_content: string | null;
          about_enabled: boolean | null;
          about_headline: string | null;
          about_image_url: string | null;
          about_video_url: string | null;
          accent_color: string | null;
          contact_address: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          faq_enabled: boolean | null;
          faq_headline: string | null;
          faq_items: Json | null;
          final_cta_enabled: boolean | null;
          final_cta_headline: string | null;
          final_cta_link: string | null;
          final_cta_subheadline: string | null;
          final_cta_text: string | null;
          gallery_enabled: boolean | null;
          gallery_featured_url: string | null;
          gallery_headline: string | null;
          gallery_images: Json | null;
          gallery_subheadline: string | null;
          hero_cta_link: string | null;
          hero_cta_text: string | null;
          hero_headline: string | null;
          hero_image_url: string | null;
          hero_subheadline: string | null;
          hero_video_url: string | null;
          id: string;
          imo_id: string;
          login_access_type: string | null;
          logo_dark_url: string | null;
          logo_light_url: string | null;
          meta_description: string | null;
          meta_title: string | null;
          og_image_url: string | null;
          opportunity_enabled: boolean | null;
          opportunity_headline: string | null;
          opportunity_steps: Json | null;
          opportunity_subheadline: string | null;
          primary_color: string | null;
          requirements_enabled: boolean | null;
          requirements_headline: string | null;
          requirements_items: Json | null;
          requirements_subheadline: string | null;
          secondary_color: string | null;
          section_order: Json | null;
          social_links: Json | null;
          stats_data: Json | null;
          stats_enabled: boolean | null;
          tech_enabled: boolean | null;
          tech_features: Json | null;
          tech_headline: string | null;
          tech_subheadline: string | null;
          testimonials: Json | null;
          testimonials_enabled: boolean | null;
          testimonials_headline: string | null;
          testimonials_subheadline: string | null;
          updated_at: string;
        };
        Insert: {
          about_content?: string | null;
          about_enabled?: boolean | null;
          about_headline?: string | null;
          about_image_url?: string | null;
          about_video_url?: string | null;
          accent_color?: string | null;
          contact_address?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          faq_enabled?: boolean | null;
          faq_headline?: string | null;
          faq_items?: Json | null;
          final_cta_enabled?: boolean | null;
          final_cta_headline?: string | null;
          final_cta_link?: string | null;
          final_cta_subheadline?: string | null;
          final_cta_text?: string | null;
          gallery_enabled?: boolean | null;
          gallery_featured_url?: string | null;
          gallery_headline?: string | null;
          gallery_images?: Json | null;
          gallery_subheadline?: string | null;
          hero_cta_link?: string | null;
          hero_cta_text?: string | null;
          hero_headline?: string | null;
          hero_image_url?: string | null;
          hero_subheadline?: string | null;
          hero_video_url?: string | null;
          id?: string;
          imo_id: string;
          login_access_type?: string | null;
          logo_dark_url?: string | null;
          logo_light_url?: string | null;
          meta_description?: string | null;
          meta_title?: string | null;
          og_image_url?: string | null;
          opportunity_enabled?: boolean | null;
          opportunity_headline?: string | null;
          opportunity_steps?: Json | null;
          opportunity_subheadline?: string | null;
          primary_color?: string | null;
          requirements_enabled?: boolean | null;
          requirements_headline?: string | null;
          requirements_items?: Json | null;
          requirements_subheadline?: string | null;
          secondary_color?: string | null;
          section_order?: Json | null;
          social_links?: Json | null;
          stats_data?: Json | null;
          stats_enabled?: boolean | null;
          tech_enabled?: boolean | null;
          tech_features?: Json | null;
          tech_headline?: string | null;
          tech_subheadline?: string | null;
          testimonials?: Json | null;
          testimonials_enabled?: boolean | null;
          testimonials_headline?: string | null;
          testimonials_subheadline?: string | null;
          updated_at?: string;
        };
        Update: {
          about_content?: string | null;
          about_enabled?: boolean | null;
          about_headline?: string | null;
          about_image_url?: string | null;
          about_video_url?: string | null;
          accent_color?: string | null;
          contact_address?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          faq_enabled?: boolean | null;
          faq_headline?: string | null;
          faq_items?: Json | null;
          final_cta_enabled?: boolean | null;
          final_cta_headline?: string | null;
          final_cta_link?: string | null;
          final_cta_subheadline?: string | null;
          final_cta_text?: string | null;
          gallery_enabled?: boolean | null;
          gallery_featured_url?: string | null;
          gallery_headline?: string | null;
          gallery_images?: Json | null;
          gallery_subheadline?: string | null;
          hero_cta_link?: string | null;
          hero_cta_text?: string | null;
          hero_headline?: string | null;
          hero_image_url?: string | null;
          hero_subheadline?: string | null;
          hero_video_url?: string | null;
          id?: string;
          imo_id?: string;
          login_access_type?: string | null;
          logo_dark_url?: string | null;
          logo_light_url?: string | null;
          meta_description?: string | null;
          meta_title?: string | null;
          og_image_url?: string | null;
          opportunity_enabled?: boolean | null;
          opportunity_headline?: string | null;
          opportunity_steps?: Json | null;
          opportunity_subheadline?: string | null;
          primary_color?: string | null;
          requirements_enabled?: boolean | null;
          requirements_headline?: string | null;
          requirements_items?: Json | null;
          requirements_subheadline?: string | null;
          secondary_color?: string | null;
          section_order?: Json | null;
          social_links?: Json | null;
          stats_data?: Json | null;
          stats_enabled?: boolean | null;
          tech_enabled?: boolean | null;
          tech_features?: Json | null;
          tech_headline?: string | null;
          tech_subheadline?: string | null;
          testimonials?: Json | null;
          testimonials_enabled?: boolean | null;
          testimonials_headline?: string | null;
          testimonials_subheadline?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "landing_page_settings_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: true;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_drop_jobs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_leads: number;
          error_message: string | null;
          failed_leads: number;
          id: string;
          lead_source_label: string;
          recipient_smart_view_id: string | null;
          recipient_smart_view_name: string | null;
          recipient_user_id: string;
          sender_user_id: string;
          sequence_id: string | null;
          sequence_name: string | null;
          smart_view_id: string;
          smart_view_name: string;
          status: string;
          total_leads: number;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_leads?: number;
          error_message?: string | null;
          failed_leads?: number;
          id?: string;
          lead_source_label: string;
          recipient_smart_view_id?: string | null;
          recipient_smart_view_name?: string | null;
          recipient_user_id: string;
          sender_user_id: string;
          sequence_id?: string | null;
          sequence_name?: string | null;
          smart_view_id: string;
          smart_view_name: string;
          status?: string;
          total_leads?: number;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_leads?: number;
          error_message?: string | null;
          failed_leads?: number;
          id?: string;
          lead_source_label?: string;
          recipient_smart_view_id?: string | null;
          recipient_smart_view_name?: string | null;
          recipient_user_id?: string;
          sender_user_id?: string;
          sequence_id?: string | null;
          sequence_name?: string | null;
          smart_view_id?: string;
          smart_view_name?: string;
          status?: string;
          total_leads?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lead_drop_jobs_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_drop_jobs_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_drop_jobs_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_drop_jobs_sender_user_id_fkey";
            columns: ["sender_user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_drop_jobs_sender_user_id_fkey";
            columns: ["sender_user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_drop_jobs_sender_user_id_fkey";
            columns: ["sender_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_drop_results: {
        Row: {
          created_at: string;
          dest_lead_id: string | null;
          error_message: string | null;
          id: string;
          job_id: string;
          source_lead_id: string;
          source_lead_name: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          dest_lead_id?: string | null;
          error_message?: string | null;
          id?: string;
          job_id: string;
          source_lead_id: string;
          source_lead_name?: string | null;
          status: string;
        };
        Update: {
          created_at?: string;
          dest_lead_id?: string | null;
          error_message?: string | null;
          id?: string;
          job_id?: string;
          source_lead_id?: string;
          source_lead_name?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_drop_results_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "lead_drop_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_heat_agent_weights: {
        Row: {
          created_at: string;
          id: string;
          last_trained_at: string | null;
          sample_size: number;
          updated_at: string;
          user_id: string;
          version: number;
          weights: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_trained_at?: string | null;
          sample_size?: number;
          updated_at?: string;
          user_id: string;
          version?: number;
          weights?: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_trained_at?: string | null;
          sample_size?: number;
          updated_at?: string;
          user_id?: string;
          version?: number;
          weights?: Json;
        };
        Relationships: [];
      };
      lead_heat_ai_portfolio_analysis: {
        Row: {
          analysis: Json;
          analyzed_at: string;
          anomalies: Json | null;
          expires_at: string;
          id: string;
          model_used: string | null;
          recommendations: Json | null;
          tokens_used: number | null;
          user_id: string;
          weight_adjustments: Json | null;
        };
        Insert: {
          analysis?: Json;
          analyzed_at?: string;
          anomalies?: Json | null;
          expires_at?: string;
          id?: string;
          model_used?: string | null;
          recommendations?: Json | null;
          tokens_used?: number | null;
          user_id: string;
          weight_adjustments?: Json | null;
        };
        Update: {
          analysis?: Json;
          analyzed_at?: string;
          anomalies?: Json | null;
          expires_at?: string;
          id?: string;
          model_used?: string | null;
          recommendations?: Json | null;
          tokens_used?: number | null;
          user_id?: string;
          weight_adjustments?: Json | null;
        };
        Relationships: [];
      };
      lead_heat_outcomes: {
        Row: {
          breakdown_at_outcome: Json | null;
          close_lead_id: string;
          close_opp_id: string | null;
          created_at: string;
          id: string;
          metadata: Json | null;
          occurred_at: string;
          opp_value: number | null;
          outcome_type: string;
          score_at_outcome: number | null;
          signals_at_outcome: Json | null;
          user_id: string;
        };
        Insert: {
          breakdown_at_outcome?: Json | null;
          close_lead_id: string;
          close_opp_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          occurred_at?: string;
          opp_value?: number | null;
          outcome_type: string;
          score_at_outcome?: number | null;
          signals_at_outcome?: Json | null;
          user_id: string;
        };
        Update: {
          breakdown_at_outcome?: Json | null;
          close_lead_id?: string;
          close_opp_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          occurred_at?: string;
          opp_value?: number | null;
          outcome_type?: string;
          score_at_outcome?: number | null;
          signals_at_outcome?: Json | null;
          user_id?: string;
        };
        Relationships: [];
      };
      lead_heat_scores: {
        Row: {
          ai_insights: Json | null;
          ai_insights_generated_at: string | null;
          breakdown: Json;
          close_lead_id: string;
          created_at: string;
          display_name: string | null;
          heat_level: string;
          id: string;
          last_activity_at: string | null;
          opp_snapshot: Json | null;
          percentile_rank: number | null;
          previous_score: number | null;
          score: number;
          scored_at: string;
          scoring_model_version: string | null;
          signals: Json;
          trend: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_insights?: Json | null;
          ai_insights_generated_at?: string | null;
          breakdown?: Json;
          close_lead_id: string;
          created_at?: string;
          display_name?: string | null;
          heat_level?: string;
          id?: string;
          last_activity_at?: string | null;
          opp_snapshot?: Json | null;
          percentile_rank?: number | null;
          previous_score?: number | null;
          score?: number;
          scored_at?: string;
          scoring_model_version?: string | null;
          signals?: Json;
          trend?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_insights?: Json | null;
          ai_insights_generated_at?: string | null;
          breakdown?: Json;
          close_lead_id?: string;
          created_at?: string;
          display_name?: string | null;
          heat_level?: string;
          id?: string;
          last_activity_at?: string | null;
          opp_snapshot?: Json | null;
          percentile_rank?: number | null;
          previous_score?: number | null;
          score?: number;
          scored_at?: string;
          scoring_model_version?: string | null;
          signals?: Json;
          trend?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lead_heat_scoring_runs: {
        Row: {
          ai_calls_made: number | null;
          completed_at: string | null;
          duration_ms: number | null;
          error_message: string | null;
          id: string;
          is_truncated: boolean | null;
          leads_scored: number | null;
          leads_total: number | null;
          run_type: string;
          started_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          ai_calls_made?: number | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          is_truncated?: boolean | null;
          leads_scored?: number | null;
          leads_total?: number | null;
          run_type?: string;
          started_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          ai_calls_made?: number | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          is_truncated?: boolean | null;
          leads_scored?: number | null;
          leads_total?: number | null;
          run_type?: string;
          started_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lead_heat_status_config: {
        Row: {
          classification_source: string;
          classified_at: string;
          close_status_id: string;
          close_status_label: string;
          is_rankable: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          classification_source: string;
          classified_at?: string;
          close_status_id: string;
          close_status_label: string;
          is_rankable: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          classification_source?: string;
          classified_at?: string;
          close_status_id?: string;
          close_status_label?: string;
          is_rankable?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lead_purchases: {
        Row: {
          agency_id: string | null;
          commission_earned: number;
          cost_per_lead: number | null;
          created_at: string;
          expense_id: string | null;
          id: string;
          imo_id: string | null;
          lead_count: number;
          lead_freshness: Database["public"]["Enums"]["lead_freshness"];
          notes: string | null;
          policies_sold: number;
          purchase_date: string;
          purchase_name: string | null;
          roi_percentage: number | null;
          total_cost: number;
          updated_at: string;
          user_id: string;
          vendor_id: string;
        };
        Insert: {
          agency_id?: string | null;
          commission_earned?: number;
          cost_per_lead?: number | null;
          created_at?: string;
          expense_id?: string | null;
          id?: string;
          imo_id?: string | null;
          lead_count: number;
          lead_freshness?: Database["public"]["Enums"]["lead_freshness"];
          notes?: string | null;
          policies_sold?: number;
          purchase_date: string;
          purchase_name?: string | null;
          roi_percentage?: number | null;
          total_cost: number;
          updated_at?: string;
          user_id: string;
          vendor_id: string;
        };
        Update: {
          agency_id?: string | null;
          commission_earned?: number;
          cost_per_lead?: number | null;
          created_at?: string;
          expense_id?: string | null;
          id?: string;
          imo_id?: string | null;
          lead_count?: number;
          lead_freshness?: Database["public"]["Enums"]["lead_freshness"];
          notes?: string | null;
          policies_sold?: number;
          purchase_date?: string;
          purchase_name?: string | null;
          roi_percentage?: number | null;
          total_cost?: number;
          updated_at?: string;
          user_id?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_purchases_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_purchases_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_purchases_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_purchases_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "lead_vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_vendors: {
        Row: {
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string;
          id: string;
          imo_id: string;
          name: string;
          notes: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          imo_id: string;
          name: string;
          notes?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          imo_id?: string;
          name?: string;
          notes?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_vendors_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      marketing_audience_members: {
        Row: {
          audience_id: string;
          contact_id: string | null;
          contact_type: string;
          created_at: string | null;
          email: string;
          first_name: string | null;
          id: string;
          last_name: string | null;
          metadata: Json | null;
          phone: string | null;
        };
        Insert: {
          audience_id: string;
          contact_id?: string | null;
          contact_type: string;
          created_at?: string | null;
          email: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          metadata?: Json | null;
          phone?: string | null;
        };
        Update: {
          audience_id?: string;
          contact_id?: string | null;
          contact_type?: string;
          created_at?: string | null;
          email?: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          metadata?: Json | null;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "marketing_audience_members_audience_id_fkey";
            columns: ["audience_id"];
            isOneToOne: false;
            referencedRelation: "marketing_audiences";
            referencedColumns: ["id"];
          },
        ];
      };
      marketing_audiences: {
        Row: {
          audience_type: string;
          contact_count: number | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          filters: Json | null;
          id: string;
          name: string;
          source_pool: string;
          updated_at: string | null;
        };
        Insert: {
          audience_type?: string;
          contact_count?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          filters?: Json | null;
          id?: string;
          name: string;
          source_pool: string;
          updated_at?: string | null;
        };
        Update: {
          audience_type?: string;
          contact_count?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          filters?: Json | null;
          id?: string;
          name?: string;
          source_pool?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      marketing_brand_settings: {
        Row: {
          accent_color: string | null;
          company_name: string | null;
          created_by: string | null;
          font_family: string | null;
          footer_text: string | null;
          id: string;
          logo_url: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          social_links: Json | null;
          updated_at: string | null;
        };
        Insert: {
          accent_color?: string | null;
          company_name?: string | null;
          created_by?: string | null;
          font_family?: string | null;
          footer_text?: string | null;
          id?: string;
          logo_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          social_links?: Json | null;
          updated_at?: string | null;
        };
        Update: {
          accent_color?: string | null;
          company_name?: string | null;
          created_by?: string | null;
          font_family?: string | null;
          footer_text?: string | null;
          id?: string;
          logo_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          social_links?: Json | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      marketing_external_contacts: {
        Row: {
          company: string | null;
          created_at: string | null;
          created_by: string | null;
          email: string;
          first_name: string | null;
          id: string;
          last_name: string | null;
          metadata: Json | null;
          phone: string | null;
          source: string | null;
          tags: string[] | null;
          updated_at: string | null;
        };
        Insert: {
          company?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          email: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          metadata?: Json | null;
          phone?: string | null;
          source?: string | null;
          tags?: string[] | null;
          updated_at?: string | null;
        };
        Update: {
          company?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          email?: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          metadata?: Json | null;
          phone?: string | null;
          source?: string | null;
          tags?: string[] | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      message_threads: {
        Row: {
          created_at: string | null;
          created_by: string;
          id: string;
          last_message_at: string | null;
          participant_ids: string[];
          subject: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by: string;
          id?: string;
          last_message_at?: string | null;
          participant_ids: string[];
          subject: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string;
          id?: string;
          last_message_at?: string | null;
          participant_ids?: string[];
          subject?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_threads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_threads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_threads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          created_at: string | null;
          id: string;
          read_by: string[] | null;
          sender_id: string;
          thread_id: string;
          updated_at: string | null;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          id?: string;
          read_by?: string[] | null;
          sender_id: string;
          thread_id: string;
          updated_at?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          id?: string;
          read_by?: string[] | null;
          sender_id?: string;
          thread_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "message_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_digest_log: {
        Row: {
          email_message_id: string | null;
          email_sent_to: string;
          error_message: string | null;
          id: string;
          notification_count: number;
          notification_ids: string[];
          sent_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          email_message_id?: string | null;
          email_sent_to: string;
          error_message?: string | null;
          id?: string;
          notification_count: number;
          notification_ids: string[];
          sent_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          email_message_id?: string | null;
          email_sent_to?: string;
          error_message?: string | null;
          id?: string;
          notification_count?: number;
          notification_ids?: string[];
          sent_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_digest_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_digest_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_digest_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          browser_push_enabled: boolean | null;
          browser_push_subscription: Json | null;
          created_at: string | null;
          email_digest_enabled: boolean | null;
          email_digest_frequency: string | null;
          email_digest_time: string | null;
          email_digest_timezone: string | null;
          id: string;
          in_app_enabled: boolean | null;
          last_digest_sent_at: string | null;
          notify_on_click: boolean | null;
          notify_on_open: boolean | null;
          notify_on_reply: boolean | null;
          quiet_hours_enabled: boolean | null;
          quiet_hours_end: string | null;
          quiet_hours_start: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          browser_push_enabled?: boolean | null;
          browser_push_subscription?: Json | null;
          created_at?: string | null;
          email_digest_enabled?: boolean | null;
          email_digest_frequency?: string | null;
          email_digest_time?: string | null;
          email_digest_timezone?: string | null;
          id?: string;
          in_app_enabled?: boolean | null;
          last_digest_sent_at?: string | null;
          notify_on_click?: boolean | null;
          notify_on_open?: boolean | null;
          notify_on_reply?: boolean | null;
          quiet_hours_enabled?: boolean | null;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          browser_push_enabled?: boolean | null;
          browser_push_subscription?: Json | null;
          created_at?: string | null;
          email_digest_enabled?: boolean | null;
          email_digest_frequency?: string | null;
          email_digest_time?: string | null;
          email_digest_timezone?: string | null;
          id?: string;
          in_app_enabled?: boolean | null;
          last_digest_sent_at?: string | null;
          notify_on_click?: boolean | null;
          notify_on_open?: boolean | null;
          notify_on_reply?: boolean | null;
          quiet_hours_enabled?: boolean | null;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          expires_at: string | null;
          id: string;
          message: string | null;
          metadata: Json | null;
          read: boolean;
          title: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          message?: string | null;
          metadata?: Json | null;
          read?: boolean;
          title: string;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          message?: string | null;
          metadata?: Json | null;
          read?: boolean;
          title?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      onboarding_phases: {
        Row: {
          blocked_reason: string | null;
          completed_at: string | null;
          created_at: string | null;
          id: string;
          notes: string | null;
          phase_name: string;
          phase_order: number;
          started_at: string | null;
          status: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          blocked_reason?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          phase_name: string;
          phase_order: number;
          started_at?: string | null;
          status?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          blocked_reason?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          phase_name?: string;
          phase_order?: number;
          started_at?: string | null;
          status?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_phases_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "onboarding_phases_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "onboarding_phases_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      override_commissions: {
        Row: {
          advance_months: number | null;
          agency_id: string | null;
          base_agent_id: string;
          base_commission_amount: number;
          base_comp_level: number;
          carrier_id: string;
          chargeback_amount: number | null;
          chargeback_date: string | null;
          chargeback_reason: string | null;
          created_at: string | null;
          earned_amount: number | null;
          hierarchy_depth: number;
          id: string;
          imo_id: string | null;
          months_paid: number | null;
          override_agent_id: string;
          override_commission_amount: number;
          override_comp_level: number;
          payment_date: string | null;
          policy_id: string;
          policy_premium: number;
          product_id: string | null;
          status: string;
          unearned_amount: number | null;
          updated_at: string | null;
        };
        Insert: {
          advance_months?: number | null;
          agency_id?: string | null;
          base_agent_id: string;
          base_commission_amount: number;
          base_comp_level: number;
          carrier_id: string;
          chargeback_amount?: number | null;
          chargeback_date?: string | null;
          chargeback_reason?: string | null;
          created_at?: string | null;
          earned_amount?: number | null;
          hierarchy_depth: number;
          id?: string;
          imo_id?: string | null;
          months_paid?: number | null;
          override_agent_id: string;
          override_commission_amount: number;
          override_comp_level: number;
          payment_date?: string | null;
          policy_id: string;
          policy_premium: number;
          product_id?: string | null;
          status?: string;
          unearned_amount?: number | null;
          updated_at?: string | null;
        };
        Update: {
          advance_months?: number | null;
          agency_id?: string | null;
          base_agent_id?: string;
          base_commission_amount?: number;
          base_comp_level?: number;
          carrier_id?: string;
          chargeback_amount?: number | null;
          chargeback_date?: string | null;
          chargeback_reason?: string | null;
          created_at?: string | null;
          earned_amount?: number | null;
          hierarchy_depth?: number;
          id?: string;
          imo_id?: string | null;
          months_paid?: number | null;
          override_agent_id?: string;
          override_commission_amount?: number;
          override_comp_level?: number;
          payment_date?: string | null;
          policy_id?: string;
          policy_premium?: number;
          product_id?: string | null;
          status?: string;
          unearned_amount?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "override_commissions_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_base_agent_id_fkey";
            columns: ["base_agent_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_base_agent_id_fkey";
            columns: ["base_agent_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_base_agent_id_fkey";
            columns: ["base_agent_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_override_agent_id_fkey";
            columns: ["override_agent_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_override_agent_id_fkey";
            columns: ["override_agent_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_override_agent_id_fkey";
            columns: ["override_agent_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: false;
            referencedRelation: "policies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          action: string;
          code: string;
          created_at: string | null;
          description: string | null;
          id: string;
          resource: string;
          scope: string | null;
        };
        Insert: {
          action: string;
          code: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          resource: string;
          scope?: string | null;
        };
        Update: {
          action?: string;
          code?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          resource?: string;
          scope?: string | null;
        };
        Relationships: [];
      };
      phase_checklist_items: {
        Row: {
          can_be_completed_by: string;
          created_at: string | null;
          document_type: string | null;
          external_link: string | null;
          id: string;
          is_active: boolean | null;
          is_required: boolean | null;
          item_description: string | null;
          item_name: string;
          item_order: number;
          item_type: string;
          metadata: Json | null;
          phase_id: string;
          requires_verification: boolean | null;
          updated_at: string | null;
          verification_by: string | null;
          visible_to_recruit: boolean;
        };
        Insert: {
          can_be_completed_by: string;
          created_at?: string | null;
          document_type?: string | null;
          external_link?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_required?: boolean | null;
          item_description?: string | null;
          item_name: string;
          item_order: number;
          item_type: string;
          metadata?: Json | null;
          phase_id: string;
          requires_verification?: boolean | null;
          updated_at?: string | null;
          verification_by?: string | null;
          visible_to_recruit?: boolean;
        };
        Update: {
          can_be_completed_by?: string;
          created_at?: string | null;
          document_type?: string | null;
          external_link?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_required?: boolean | null;
          item_description?: string | null;
          item_name?: string;
          item_order?: number;
          item_type?: string;
          metadata?: Json | null;
          phase_id?: string;
          requires_verification?: boolean | null;
          updated_at?: string | null;
          verification_by?: string | null;
          visible_to_recruit?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "phase_checklist_items_phase_id_fkey";
            columns: ["phase_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_phases";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_automation_logs: {
        Row: {
          automation_id: string;
          error_message: string | null;
          id: string;
          metadata: Json | null;
          recruit_id: string;
          status: string;
          triggered_at: string | null;
          triggered_date: string | null;
        };
        Insert: {
          automation_id: string;
          error_message?: string | null;
          id?: string;
          metadata?: Json | null;
          recruit_id: string;
          status: string;
          triggered_at?: string | null;
          triggered_date?: string | null;
        };
        Update: {
          automation_id?: string;
          error_message?: string | null;
          id?: string;
          metadata?: Json | null;
          recruit_id?: string;
          status?: string;
          triggered_at?: string | null;
          triggered_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_automation_logs_automation_id_fkey";
            columns: ["automation_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_automations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_automation_logs_recruit_id_fkey";
            columns: ["recruit_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_automation_logs_recruit_id_fkey";
            columns: ["recruit_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_automation_logs_recruit_id_fkey";
            columns: ["recruit_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_automations: {
        Row: {
          checklist_item_id: string | null;
          communication_type:
            | Database["public"]["Enums"]["automation_communication_type"]
            | null;
          created_at: string | null;
          created_by: string | null;
          delay_days: number | null;
          email_body_html: string | null;
          email_subject: string | null;
          email_template_id: string | null;
          id: string;
          imo_id: string | null;
          is_active: boolean | null;
          notification_message: string | null;
          notification_title: string | null;
          phase_id: string | null;
          recipients: Json;
          sender_email: string | null;
          sender_name: string | null;
          sender_type: string | null;
          sms_message: string | null;
          trigger_type: Database["public"]["Enums"]["pipeline_automation_trigger"];
          updated_at: string | null;
        };
        Insert: {
          checklist_item_id?: string | null;
          communication_type?:
            | Database["public"]["Enums"]["automation_communication_type"]
            | null;
          created_at?: string | null;
          created_by?: string | null;
          delay_days?: number | null;
          email_body_html?: string | null;
          email_subject?: string | null;
          email_template_id?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean | null;
          notification_message?: string | null;
          notification_title?: string | null;
          phase_id?: string | null;
          recipients?: Json;
          sender_email?: string | null;
          sender_name?: string | null;
          sender_type?: string | null;
          sms_message?: string | null;
          trigger_type: Database["public"]["Enums"]["pipeline_automation_trigger"];
          updated_at?: string | null;
        };
        Update: {
          checklist_item_id?: string | null;
          communication_type?:
            | Database["public"]["Enums"]["automation_communication_type"]
            | null;
          created_at?: string | null;
          created_by?: string | null;
          delay_days?: number | null;
          email_body_html?: string | null;
          email_subject?: string | null;
          email_template_id?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean | null;
          notification_message?: string | null;
          notification_title?: string | null;
          phase_id?: string | null;
          recipients?: Json;
          sender_email?: string | null;
          sender_name?: string | null;
          sender_type?: string | null;
          sms_message?: string | null;
          trigger_type?: Database["public"]["Enums"]["pipeline_automation_trigger"];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_automations_checklist_item_id_fkey";
            columns: ["checklist_item_id"];
            isOneToOne: false;
            referencedRelation: "phase_checklist_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_automations_email_template_id_fkey";
            columns: ["email_template_id"];
            isOneToOne: false;
            referencedRelation: "email_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_automations_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_automations_phase_id_fkey";
            columns: ["phase_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_phases";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_phases: {
        Row: {
          auto_advance: boolean | null;
          created_at: string | null;
          estimated_days: number | null;
          id: string;
          is_active: boolean | null;
          phase_description: string | null;
          phase_name: string;
          phase_order: number;
          required_approver_role: string | null;
          template_id: string;
          updated_at: string | null;
          visible_to_recruit: boolean;
        };
        Insert: {
          auto_advance?: boolean | null;
          created_at?: string | null;
          estimated_days?: number | null;
          id?: string;
          is_active?: boolean | null;
          phase_description?: string | null;
          phase_name: string;
          phase_order: number;
          required_approver_role?: string | null;
          template_id: string;
          updated_at?: string | null;
          visible_to_recruit?: boolean;
        };
        Update: {
          auto_advance?: boolean | null;
          created_at?: string | null;
          estimated_days?: number | null;
          id?: string;
          is_active?: boolean | null;
          phase_description?: string | null;
          phase_name?: string;
          phase_order?: number;
          required_approver_role?: string | null;
          template_id?: string;
          updated_at?: string | null;
          visible_to_recruit?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_phases_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_templates: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          imo_id: string | null;
          is_active: boolean | null;
          is_default: boolean | null;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean | null;
          is_default?: boolean | null;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean | null;
          is_default?: boolean | null;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_templates_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      policies: {
        Row: {
          agency_id: string | null;
          annual_premium: number | null;
          cancellation_date: string | null;
          cancellation_reason: string | null;
          carrier_id: string;
          client_id: string | null;
          commission_percentage: number | null;
          created_at: string | null;
          effective_date: string;
          expiration_date: string | null;
          id: string;
          imo_id: string | null;
          lead_purchase_id: string | null;
          lead_source_type:
            | Database["public"]["Enums"]["lead_source_type"]
            | null;
          lifecycle_status: string | null;
          monthly_premium: number;
          notes: string | null;
          payment_frequency:
            | Database["public"]["Enums"]["payment_frequency"]
            | null;
          policy_number: string | null;
          product: Database["public"]["Enums"]["product_type"];
          product_id: string | null;
          referral_source: string | null;
          status: string;
          submit_date: string;
          term_length: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          agency_id?: string | null;
          annual_premium?: number | null;
          cancellation_date?: string | null;
          cancellation_reason?: string | null;
          carrier_id: string;
          client_id?: string | null;
          commission_percentage?: number | null;
          created_at?: string | null;
          effective_date: string;
          expiration_date?: string | null;
          id?: string;
          imo_id?: string | null;
          lead_purchase_id?: string | null;
          lead_source_type?:
            | Database["public"]["Enums"]["lead_source_type"]
            | null;
          lifecycle_status?: string | null;
          monthly_premium: number;
          notes?: string | null;
          payment_frequency?:
            | Database["public"]["Enums"]["payment_frequency"]
            | null;
          policy_number?: string | null;
          product: Database["public"]["Enums"]["product_type"];
          product_id?: string | null;
          referral_source?: string | null;
          status?: string;
          submit_date?: string;
          term_length?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          agency_id?: string | null;
          annual_premium?: number | null;
          cancellation_date?: string | null;
          cancellation_reason?: string | null;
          carrier_id?: string;
          client_id?: string | null;
          commission_percentage?: number | null;
          created_at?: string | null;
          effective_date?: string;
          expiration_date?: string | null;
          id?: string;
          imo_id?: string | null;
          lead_purchase_id?: string | null;
          lead_source_type?:
            | Database["public"]["Enums"]["lead_source_type"]
            | null;
          lifecycle_status?: string | null;
          monthly_premium?: number;
          notes?: string | null;
          payment_frequency?:
            | Database["public"]["Enums"]["payment_frequency"]
            | null;
          policy_number?: string | null;
          product?: Database["public"]["Enums"]["product_type"];
          product_id?: string | null;
          referral_source?: string | null;
          status?: string;
          submit_date?: string;
          term_length?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "policies_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policies_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policies_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policies_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policies_lead_purchase_id_fkey";
            columns: ["lead_purchase_id"];
            isOneToOne: false;
            referencedRelation: "lead_purchases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policies_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      premium_matrix: {
        Row: {
          age: number;
          created_at: string;
          created_by: string | null;
          face_amount: number;
          gender: string;
          health_class: string;
          id: string;
          imo_id: string;
          monthly_premium: number;
          product_id: string;
          term_years: number | null;
          tobacco_class: string;
          updated_at: string;
        };
        Insert: {
          age: number;
          created_at?: string;
          created_by?: string | null;
          face_amount: number;
          gender: string;
          health_class: string;
          id?: string;
          imo_id: string;
          monthly_premium: number;
          product_id: string;
          term_years?: number | null;
          tobacco_class: string;
          updated_at?: string;
        };
        Update: {
          age?: number;
          created_at?: string;
          created_by?: string | null;
          face_amount?: number;
          gender?: string;
          health_class?: string;
          id?: string;
          imo_id?: string;
          monthly_premium?: number;
          product_id?: string;
          term_years?: number | null;
          tobacco_class?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "premium_matrix_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premium_matrix_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      presentation_markers: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          label: string;
          marker_type: string;
          submission_id: string;
          timestamp_seconds: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          label: string;
          marker_type?: string;
          submission_id: string;
          timestamp_seconds: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          label?: string;
          marker_type?: string;
          submission_id?: string;
          timestamp_seconds?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "presentation_markers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presentation_markers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presentation_markers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presentation_markers_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "presentation_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      presentation_submissions: {
        Row: {
          agency_id: string;
          created_at: string;
          description: string | null;
          duration_seconds: number | null;
          file_name: string;
          file_size: number;
          id: string;
          imo_id: string;
          mime_type: string;
          recording_type: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          reviewer_notes: string | null;
          status: string;
          storage_path: string;
          title: string;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          description?: string | null;
          duration_seconds?: number | null;
          file_name: string;
          file_size: number;
          id?: string;
          imo_id: string;
          mime_type: string;
          recording_type?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewer_notes?: string | null;
          status?: string;
          storage_path: string;
          title: string;
          updated_at?: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          description?: string | null;
          duration_seconds?: number | null;
          file_name?: string;
          file_size?: number;
          id?: string;
          imo_id?: string;
          mime_type?: string;
          recording_type?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewer_notes?: string | null;
          status?: string;
          storage_path?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "presentation_submissions_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presentation_submissions_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presentation_submissions_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presentation_submissions_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presentation_submissions_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presentation_submissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presentation_submissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presentation_submissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      product_commission_overrides: {
        Row: {
          bonus_percentage: number | null;
          commission_percentage: number;
          comp_level: Database["public"]["Enums"]["comp_level"];
          created_at: string | null;
          effective_date: string;
          expiration_date: string | null;
          id: string;
          notes: string | null;
          product_id: string;
          updated_at: string | null;
        };
        Insert: {
          bonus_percentage?: number | null;
          commission_percentage: number;
          comp_level: Database["public"]["Enums"]["comp_level"];
          created_at?: string | null;
          effective_date?: string;
          expiration_date?: string | null;
          id?: string;
          notes?: string | null;
          product_id: string;
          updated_at?: string | null;
        };
        Update: {
          bonus_percentage?: number | null;
          commission_percentage?: number;
          comp_level?: Database["public"]["Enums"]["comp_level"];
          created_at?: string | null;
          effective_date?: string;
          expiration_date?: string | null;
          id?: string;
          notes?: string | null;
          product_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_commission_overrides_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_rate_table: {
        Row: {
          age_band_end: number;
          age_band_start: number;
          created_at: string;
          created_by: string | null;
          effective_date: string;
          expiration_date: string | null;
          gender: string;
          health_class: string;
          id: string;
          imo_id: string;
          notes: string | null;
          product_id: string;
          rate_per_thousand: number;
          tobacco_class: string;
          updated_at: string;
        };
        Insert: {
          age_band_end: number;
          age_band_start: number;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string;
          expiration_date?: string | null;
          gender: string;
          health_class: string;
          id?: string;
          imo_id: string;
          notes?: string | null;
          product_id: string;
          rate_per_thousand: number;
          tobacco_class: string;
          updated_at?: string;
        };
        Update: {
          age_band_end?: number;
          age_band_start?: number;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string;
          expiration_date?: string | null;
          gender?: string;
          health_class?: string;
          id?: string;
          imo_id?: string;
          notes?: string | null;
          product_id?: string;
          rate_per_thousand?: number;
          tobacco_class?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_rate_table_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_rate_table_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          build_chart_id: string | null;
          carrier_id: string;
          code: string | null;
          commission_percentage: number | null;
          created_at: string | null;
          description: string | null;
          id: string;
          imo_id: string | null;
          is_active: boolean | null;
          max_age: number | null;
          max_face_amount: number | null;
          max_premium: number | null;
          metadata: Json | null;
          min_age: number | null;
          min_face_amount: number | null;
          min_premium: number | null;
          name: string;
          product_type: Database["public"]["Enums"]["product_type"];
          updated_at: string | null;
        };
        Insert: {
          build_chart_id?: string | null;
          carrier_id: string;
          code?: string | null;
          commission_percentage?: number | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean | null;
          max_age?: number | null;
          max_face_amount?: number | null;
          max_premium?: number | null;
          metadata?: Json | null;
          min_age?: number | null;
          min_face_amount?: number | null;
          min_premium?: number | null;
          name: string;
          product_type: Database["public"]["Enums"]["product_type"];
          updated_at?: string | null;
        };
        Update: {
          build_chart_id?: string | null;
          carrier_id?: string;
          code?: string | null;
          commission_percentage?: number | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean | null;
          max_age?: number | null;
          max_face_amount?: number | null;
          max_premium?: number | null;
          metadata?: Json | null;
          min_age?: number | null;
          min_face_amount?: number | null;
          min_premium?: number | null;
          name?: string;
          product_type?: Database["public"]["Enums"]["product_type"];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_build_chart_id_fkey";
            columns: ["build_chart_id"];
            isOneToOne: false;
            referencedRelation: "carrier_build_charts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      recommendation_outcomes: {
        Row: {
          actual_health_class: string | null;
          actual_premium: number | null;
          carrier_id: string;
          client_age: number;
          client_bmi: number | null;
          client_gender: string;
          client_state: string;
          conditions_reported: string[] | null;
          created_at: string;
          face_amount_requested: number;
          health_tier: string | null;
          id: string;
          imo_id: string;
          outcome: string | null;
          outcome_notes: string | null;
          outcome_recorded_at: string | null;
          policy_id: string | null;
          predicted_approval_likelihood: number | null;
          predicted_health_class: string | null;
          predicted_premium: number | null;
          product_id: string;
          recommendation_rank: number | null;
          recommendation_reason: string | null;
          recommended_at: string;
          selected_at: string | null;
          session_id: string | null;
          tobacco_class: string | null;
          updated_at: string;
          user_id: string | null;
          was_selected: boolean | null;
        };
        Insert: {
          actual_health_class?: string | null;
          actual_premium?: number | null;
          carrier_id: string;
          client_age: number;
          client_bmi?: number | null;
          client_gender: string;
          client_state: string;
          conditions_reported?: string[] | null;
          created_at?: string;
          face_amount_requested: number;
          health_tier?: string | null;
          id?: string;
          imo_id: string;
          outcome?: string | null;
          outcome_notes?: string | null;
          outcome_recorded_at?: string | null;
          policy_id?: string | null;
          predicted_approval_likelihood?: number | null;
          predicted_health_class?: string | null;
          predicted_premium?: number | null;
          product_id: string;
          recommendation_rank?: number | null;
          recommendation_reason?: string | null;
          recommended_at?: string;
          selected_at?: string | null;
          session_id?: string | null;
          tobacco_class?: string | null;
          updated_at?: string;
          user_id?: string | null;
          was_selected?: boolean | null;
        };
        Update: {
          actual_health_class?: string | null;
          actual_premium?: number | null;
          carrier_id?: string;
          client_age?: number;
          client_bmi?: number | null;
          client_gender?: string;
          client_state?: string;
          conditions_reported?: string[] | null;
          created_at?: string;
          face_amount_requested?: number;
          health_tier?: string | null;
          id?: string;
          imo_id?: string;
          outcome?: string | null;
          outcome_notes?: string | null;
          outcome_recorded_at?: string | null;
          policy_id?: string | null;
          predicted_approval_likelihood?: number | null;
          predicted_health_class?: string | null;
          predicted_premium?: number | null;
          product_id?: string;
          recommendation_rank?: number | null;
          recommendation_reason?: string | null;
          recommended_at?: string;
          selected_at?: string | null;
          session_id?: string | null;
          tobacco_class?: string | null;
          updated_at?: string;
          user_id?: string | null;
          was_selected?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "recommendation_outcomes_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_outcomes_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_outcomes_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: false;
            referencedRelation: "policies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_outcomes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendation_outcomes_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "underwriting_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      recruit_checklist_progress: {
        Row: {
          agency_id: string | null;
          checklist_item_id: string;
          completed_at: string | null;
          completed_by: string | null;
          completion_details: Json | null;
          created_at: string | null;
          document_id: string | null;
          id: string;
          imo_id: string | null;
          metadata: Json | null;
          notes: string | null;
          rejection_reason: string | null;
          response_data: Json | null;
          status: string;
          updated_at: string | null;
          user_id: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          agency_id?: string | null;
          checklist_item_id: string;
          completed_at?: string | null;
          completed_by?: string | null;
          completion_details?: Json | null;
          created_at?: string | null;
          document_id?: string | null;
          id?: string;
          imo_id?: string | null;
          metadata?: Json | null;
          notes?: string | null;
          rejection_reason?: string | null;
          response_data?: Json | null;
          status?: string;
          updated_at?: string | null;
          user_id: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          agency_id?: string | null;
          checklist_item_id?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          completion_details?: Json | null;
          created_at?: string | null;
          document_id?: string | null;
          id?: string;
          imo_id?: string | null;
          metadata?: Json | null;
          notes?: string | null;
          rejection_reason?: string | null;
          response_data?: Json | null;
          status?: string;
          updated_at?: string | null;
          user_id?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recruit_checklist_progress_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_checklist_item_id_fkey";
            columns: ["checklist_item_id"];
            isOneToOne: false;
            referencedRelation: "phase_checklist_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "user_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_checklist_progress_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recruit_invitations: {
        Row: {
          city: string | null;
          completed_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          first_name: string | null;
          id: string;
          invite_token: string;
          inviter_id: string;
          last_name: string | null;
          last_resent_at: string | null;
          message: string | null;
          phone: string | null;
          recruit_id: string | null;
          resend_count: number;
          sent_at: string | null;
          state: string | null;
          status: string;
          updated_at: string;
          upline_id: string | null;
          viewed_at: string | null;
        };
        Insert: {
          city?: string | null;
          completed_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          first_name?: string | null;
          id?: string;
          invite_token?: string;
          inviter_id: string;
          last_name?: string | null;
          last_resent_at?: string | null;
          message?: string | null;
          phone?: string | null;
          recruit_id?: string | null;
          resend_count?: number;
          sent_at?: string | null;
          state?: string | null;
          status?: string;
          updated_at?: string;
          upline_id?: string | null;
          viewed_at?: string | null;
        };
        Update: {
          city?: string | null;
          completed_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          first_name?: string | null;
          id?: string;
          invite_token?: string;
          inviter_id?: string;
          last_name?: string | null;
          last_resent_at?: string | null;
          message?: string | null;
          phone?: string | null;
          recruit_id?: string | null;
          resend_count?: number;
          sent_at?: string | null;
          state?: string | null;
          status?: string;
          updated_at?: string;
          upline_id?: string | null;
          viewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recruit_invitations_inviter_id_fkey";
            columns: ["inviter_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_invitations_inviter_id_fkey";
            columns: ["inviter_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_invitations_inviter_id_fkey";
            columns: ["inviter_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_invitations_recruit_id_fkey";
            columns: ["recruit_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_invitations_recruit_id_fkey";
            columns: ["recruit_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_invitations_recruit_id_fkey";
            columns: ["recruit_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_invitations_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_invitations_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_invitations_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recruit_phase_progress: {
        Row: {
          agency_id: string | null;
          blocked_reason: string | null;
          completed_at: string | null;
          created_at: string | null;
          id: string;
          imo_id: string | null;
          notes: string | null;
          phase_id: string;
          started_at: string | null;
          status: string;
          template_id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          agency_id?: string | null;
          blocked_reason?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          imo_id?: string | null;
          notes?: string | null;
          phase_id: string;
          started_at?: string | null;
          status?: string;
          template_id: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          agency_id?: string | null;
          blocked_reason?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          imo_id?: string | null;
          notes?: string | null;
          phase_id?: string;
          started_at?: string | null;
          status?: string;
          template_id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recruit_phase_progress_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_phase_progress_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_phase_progress_phase_id_fkey";
            columns: ["phase_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_phases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_phase_progress_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_phase_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_phase_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruit_phase_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recruiting_leads: {
        Row: {
          agency_id: string | null;
          availability: string;
          city: string;
          converted_at: string | null;
          converted_recruit_id: string | null;
          created_at: string;
          current_imo_name: string | null;
          discovery_call_scheduled: boolean | null;
          discovery_call_scheduled_at: string | null;
          discovery_call_url: string | null;
          email: string;
          first_name: string;
          id: string;
          imo_id: string;
          income_goals: string | null;
          instagram_conversation_id: string | null;
          instagram_username: string | null;
          insurance_experience: string;
          ip_address: unknown;
          is_licensed: boolean | null;
          last_name: string;
          lead_source: string | null;
          phone: string;
          recruiter_id: string;
          referrer_url: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          specialties: string[] | null;
          state: string;
          status: string;
          submitted_at: string;
          updated_at: string;
          user_agent: string | null;
          utm_campaign: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          why_interested: string;
        };
        Insert: {
          agency_id?: string | null;
          availability: string;
          city: string;
          converted_at?: string | null;
          converted_recruit_id?: string | null;
          created_at?: string;
          current_imo_name?: string | null;
          discovery_call_scheduled?: boolean | null;
          discovery_call_scheduled_at?: string | null;
          discovery_call_url?: string | null;
          email: string;
          first_name: string;
          id?: string;
          imo_id: string;
          income_goals?: string | null;
          instagram_conversation_id?: string | null;
          instagram_username?: string | null;
          insurance_experience: string;
          ip_address?: unknown;
          is_licensed?: boolean | null;
          last_name: string;
          lead_source?: string | null;
          phone: string;
          recruiter_id: string;
          referrer_url?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          specialties?: string[] | null;
          state: string;
          status?: string;
          submitted_at?: string;
          updated_at?: string;
          user_agent?: string | null;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          why_interested: string;
        };
        Update: {
          agency_id?: string | null;
          availability?: string;
          city?: string;
          converted_at?: string | null;
          converted_recruit_id?: string | null;
          created_at?: string;
          current_imo_name?: string | null;
          discovery_call_scheduled?: boolean | null;
          discovery_call_scheduled_at?: string | null;
          discovery_call_url?: string | null;
          email?: string;
          first_name?: string;
          id?: string;
          imo_id?: string;
          income_goals?: string | null;
          instagram_conversation_id?: string | null;
          instagram_username?: string | null;
          insurance_experience?: string;
          ip_address?: unknown;
          is_licensed?: boolean | null;
          last_name?: string;
          lead_source?: string | null;
          phone?: string;
          recruiter_id?: string;
          referrer_url?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          specialties?: string[] | null;
          state?: string;
          status?: string;
          submitted_at?: string;
          updated_at?: string;
          user_agent?: string | null;
          utm_campaign?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          why_interested?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recruiting_leads_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiting_leads_converted_recruit_id_fkey";
            columns: ["converted_recruit_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiting_leads_converted_recruit_id_fkey";
            columns: ["converted_recruit_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiting_leads_converted_recruit_id_fkey";
            columns: ["converted_recruit_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiting_leads_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiting_leads_instagram_conversation_id_fkey";
            columns: ["instagram_conversation_id"];
            isOneToOne: false;
            referencedRelation: "instagram_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiting_leads_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiting_leads_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recruiting_leads_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recruiting_page_settings: {
        Row: {
          about_text: string | null;
          accent_color: string | null;
          calendly_url: string | null;
          created_at: string;
          cta_text: string | null;
          default_city: string | null;
          default_state: string | null;
          disclaimer_text: string | null;
          display_name: string | null;
          enabled_features: Json | null;
          headline: string | null;
          hero_image_url: string | null;
          id: string;
          imo_id: string;
          layout_variant: string | null;
          logo_dark_url: string | null;
          logo_light_url: string | null;
          logo_size: string | null;
          primary_color: string | null;
          social_links: Json | null;
          subheadline: string | null;
          support_phone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          about_text?: string | null;
          accent_color?: string | null;
          calendly_url?: string | null;
          created_at?: string;
          cta_text?: string | null;
          default_city?: string | null;
          default_state?: string | null;
          disclaimer_text?: string | null;
          display_name?: string | null;
          enabled_features?: Json | null;
          headline?: string | null;
          hero_image_url?: string | null;
          id?: string;
          imo_id: string;
          layout_variant?: string | null;
          logo_dark_url?: string | null;
          logo_light_url?: string | null;
          logo_size?: string | null;
          primary_color?: string | null;
          social_links?: Json | null;
          subheadline?: string | null;
          support_phone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          about_text?: string | null;
          accent_color?: string | null;
          calendly_url?: string | null;
          created_at?: string;
          cta_text?: string | null;
          default_city?: string | null;
          default_state?: string | null;
          disclaimer_text?: string | null;
          display_name?: string | null;
          enabled_features?: Json | null;
          headline?: string | null;
          hero_image_url?: string | null;
          id?: string;
          imo_id?: string;
          layout_variant?: string | null;
          logo_dark_url?: string | null;
          logo_light_url?: string | null;
          logo_size?: string | null;
          primary_color?: string | null;
          social_links?: Json | null;
          subheadline?: string | null;
          support_phone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recruiting_page_settings_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_item_progress: {
        Row: {
          agency_id: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          item_id: string;
          notes: string | null;
          roadmap_id: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["roadmap_progress_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agency_id: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          item_id: string;
          notes?: string | null;
          roadmap_id: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["roadmap_progress_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agency_id?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          item_id?: string;
          notes?: string | null;
          roadmap_id?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["roadmap_progress_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_item_progress_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_item_progress_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_item_progress_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_item_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_item_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_item_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_items: {
        Row: {
          agency_id: string;
          content_blocks: Json;
          created_at: string;
          estimated_minutes: number | null;
          id: string;
          is_published: boolean;
          is_required: boolean;
          roadmap_id: string;
          section_id: string;
          sort_order: number;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          content_blocks?: Json;
          created_at?: string;
          estimated_minutes?: number | null;
          id?: string;
          is_published?: boolean;
          is_required?: boolean;
          roadmap_id: string;
          section_id: string;
          sort_order: number;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          content_blocks?: Json;
          created_at?: string;
          estimated_minutes?: number | null;
          id?: string;
          is_published?: boolean;
          is_required?: boolean;
          roadmap_id?: string;
          section_id?: string;
          sort_order?: number;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_items_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_items_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_items_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_sections";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_sections: {
        Row: {
          agency_id: string;
          created_at: string;
          description: string | null;
          id: string;
          roadmap_id: string;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          roadmap_id: string;
          sort_order: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          roadmap_id?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_sections_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_sections_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_templates: {
        Row: {
          agency_id: string;
          created_at: string;
          created_by: string;
          description: string | null;
          icon: string | null;
          id: string;
          imo_id: string | null;
          is_default: boolean;
          is_published: boolean;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          agency_id: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          imo_id?: string | null;
          is_default?: boolean;
          is_published?: boolean;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          imo_id?: string | null;
          is_default?: boolean;
          is_published?: boolean;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_templates_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_templates_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          created_at: string | null;
          permission_id: string;
          role_id: string;
        };
        Insert: {
          created_at?: string | null;
          permission_id: string;
          role_id: string;
        };
        Update: {
          created_at?: string | null;
          permission_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string | null;
          description: string | null;
          display_name: string;
          id: string;
          is_system_role: boolean | null;
          name: string;
          parent_role_id: string | null;
          respects_hierarchy: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          display_name: string;
          id?: string;
          is_system_role?: boolean | null;
          name: string;
          parent_role_id?: string | null;
          respects_hierarchy?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          display_name?: string;
          id?: string;
          is_system_role?: boolean | null;
          name?: string;
          parent_role_id?: string | null;
          respects_hierarchy?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "roles_parent_role_id_fkey";
            columns: ["parent_role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      rpc_function_drop_backup: {
        Row: {
          batch_id: string;
          dropped_at: string;
          function_comment: string | null;
          function_def: string;
          function_name: string;
          function_schema: string;
          id: number;
          identity_args: string;
        };
        Insert: {
          batch_id: string;
          dropped_at?: string;
          function_comment?: string | null;
          function_def: string;
          function_name: string;
          function_schema: string;
          id?: number;
          identity_args: string;
        };
        Update: {
          batch_id?: string;
          dropped_at?: string;
          function_comment?: string | null;
          function_def?: string;
          function_name?: string;
          function_schema?: string;
          id?: number;
          identity_args?: string;
        };
        Relationships: [];
      };
      rpc_function_drop_backup_grants: {
        Row: {
          batch_id: string;
          created_at: string;
          function_name: string;
          function_schema: string;
          grant_sql: string;
          id: number;
          identity_args: string;
        };
        Insert: {
          batch_id: string;
          created_at?: string;
          function_name: string;
          function_schema: string;
          grant_sql: string;
          id?: number;
          identity_args: string;
        };
        Update: {
          batch_id?: string;
          created_at?: string;
          function_name?: string;
          function_schema?: string;
          grant_sql?: string;
          id?: number;
          identity_args?: string;
        };
        Relationships: [];
      };
      scheduled_report_deliveries: {
        Row: {
          created_at: string;
          delivered_at: string | null;
          error_message: string | null;
          id: string;
          mailgun_message_id: string | null;
          recipients_sent: Json;
          report_period_end: string;
          report_period_start: string;
          schedule_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          delivered_at?: string | null;
          error_message?: string | null;
          id?: string;
          mailgun_message_id?: string | null;
          recipients_sent?: Json;
          report_period_end: string;
          report_period_start: string;
          schedule_id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          delivered_at?: string | null;
          error_message?: string | null;
          id?: string;
          mailgun_message_id?: string | null;
          recipients_sent?: Json;
          report_period_end?: string;
          report_period_start?: string;
          schedule_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_report_deliveries_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "scheduled_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_reports: {
        Row: {
          agency_id: string | null;
          consecutive_failures: number;
          created_at: string;
          day_of_month: number | null;
          day_of_week: number | null;
          export_format: string;
          frequency: Database["public"]["Enums"]["report_frequency"];
          id: string;
          imo_id: string | null;
          include_charts: boolean;
          include_insights: boolean;
          include_summary: boolean;
          is_active: boolean;
          last_delivery: string | null;
          next_delivery: string;
          owner_id: string;
          preferred_time: string;
          recipients: Json;
          report_config: Json;
          report_type: string;
          schedule_name: string;
          updated_at: string;
        };
        Insert: {
          agency_id?: string | null;
          consecutive_failures?: number;
          created_at?: string;
          day_of_month?: number | null;
          day_of_week?: number | null;
          export_format?: string;
          frequency: Database["public"]["Enums"]["report_frequency"];
          id?: string;
          imo_id?: string | null;
          include_charts?: boolean;
          include_insights?: boolean;
          include_summary?: boolean;
          is_active?: boolean;
          last_delivery?: string | null;
          next_delivery: string;
          owner_id: string;
          preferred_time?: string;
          recipients?: Json;
          report_config?: Json;
          report_type: string;
          schedule_name: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string | null;
          consecutive_failures?: number;
          created_at?: string;
          day_of_month?: number | null;
          day_of_week?: number | null;
          export_format?: string;
          frequency?: Database["public"]["Enums"]["report_frequency"];
          id?: string;
          imo_id?: string | null;
          include_charts?: boolean;
          include_insights?: boolean;
          include_summary?: boolean;
          is_active?: boolean;
          last_delivery?: string | null;
          next_delivery?: string;
          owner_id?: string;
          preferred_time?: string;
          recipients?: Json;
          report_config?: Json;
          report_type?: string;
          schedule_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_reports_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduling_integrations: {
        Row: {
          booking_url: string;
          created_at: string | null;
          display_name: string | null;
          id: string;
          imo_id: string | null;
          instructions: string | null;
          integration_type: string;
          is_active: boolean;
          meeting_id: string | null;
          passcode: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          booking_url: string;
          created_at?: string | null;
          display_name?: string | null;
          id?: string;
          imo_id?: string | null;
          instructions?: string | null;
          integration_type: string;
          is_active?: boolean;
          meeting_id?: string | null;
          passcode?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          booking_url?: string;
          created_at?: string | null;
          display_name?: string | null;
          id?: string;
          imo_id?: string | null;
          instructions?: string | null;
          integration_type?: string;
          is_active?: boolean;
          meeting_id?: string | null;
          passcode?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduling_integrations_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          created_at: string | null;
          currency: string | null;
          default_commission_rate: number | null;
          email_template_limit: number | null;
          fiscal_year_start: number | null;
          id: string;
          notifications_enabled: boolean | null;
          tax_rate: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          currency?: string | null;
          default_commission_rate?: number | null;
          email_template_limit?: number | null;
          fiscal_year_start?: number | null;
          id?: string;
          notifications_enabled?: boolean | null;
          tax_rate?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          currency?: string | null;
          default_commission_rate?: number | null;
          email_template_limit?: number | null;
          fiscal_year_start?: number | null;
          id?: string;
          notifications_enabled?: boolean | null;
          tax_rate?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      signature_submissions: {
        Row: {
          agency_id: string;
          audit_log_url: string | null;
          checklist_progress_id: string | null;
          combined_document_url: string | null;
          completed_at: string | null;
          created_at: string | null;
          declined_at: string | null;
          docuseal_submission_id: number | null;
          expires_at: string | null;
          id: string;
          imo_id: string | null;
          initiated_by: string | null;
          status: string | null;
          target_user_id: string | null;
          template_id: string;
          updated_at: string | null;
          voided_at: string | null;
          voided_by: string | null;
          voided_reason: string | null;
        };
        Insert: {
          agency_id: string;
          audit_log_url?: string | null;
          checklist_progress_id?: string | null;
          combined_document_url?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          declined_at?: string | null;
          docuseal_submission_id?: number | null;
          expires_at?: string | null;
          id?: string;
          imo_id?: string | null;
          initiated_by?: string | null;
          status?: string | null;
          target_user_id?: string | null;
          template_id: string;
          updated_at?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          voided_reason?: string | null;
        };
        Update: {
          agency_id?: string;
          audit_log_url?: string | null;
          checklist_progress_id?: string | null;
          combined_document_url?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          declined_at?: string | null;
          docuseal_submission_id?: number | null;
          expires_at?: string | null;
          id?: string;
          imo_id?: string | null;
          initiated_by?: string | null;
          status?: string | null;
          target_user_id?: string | null;
          template_id?: string;
          updated_at?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          voided_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "signature_submissions_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_checklist_progress_id_fkey";
            columns: ["checklist_progress_id"];
            isOneToOne: false;
            referencedRelation: "recruit_checklist_progress";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_initiated_by_fkey";
            columns: ["initiated_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_initiated_by_fkey";
            columns: ["initiated_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_initiated_by_fkey";
            columns: ["initiated_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "signature_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_voided_by_fkey";
            columns: ["voided_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_voided_by_fkey";
            columns: ["voided_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submissions_voided_by_fkey";
            columns: ["voided_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      signature_submitters: {
        Row: {
          created_at: string | null;
          decline_reason: string | null;
          declined_at: string | null;
          docuseal_submitter_id: number | null;
          email: string;
          embed_url: string | null;
          embed_url_expires_at: string | null;
          id: string;
          ip_address: string | null;
          name: string | null;
          opened_at: string | null;
          role: string;
          sent_at: string | null;
          signed_at: string | null;
          signing_order: number | null;
          status: string | null;
          submission_id: string;
          updated_at: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          decline_reason?: string | null;
          declined_at?: string | null;
          docuseal_submitter_id?: number | null;
          email: string;
          embed_url?: string | null;
          embed_url_expires_at?: string | null;
          id?: string;
          ip_address?: string | null;
          name?: string | null;
          opened_at?: string | null;
          role: string;
          sent_at?: string | null;
          signed_at?: string | null;
          signing_order?: number | null;
          status?: string | null;
          submission_id: string;
          updated_at?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          decline_reason?: string | null;
          declined_at?: string | null;
          docuseal_submitter_id?: number | null;
          email?: string;
          embed_url?: string | null;
          embed_url_expires_at?: string | null;
          id?: string;
          ip_address?: string | null;
          name?: string | null;
          opened_at?: string | null;
          role?: string;
          sent_at?: string | null;
          signed_at?: string | null;
          signing_order?: number | null;
          status?: string | null;
          submission_id?: string;
          updated_at?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "signature_submitters_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "signature_submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submitters_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submitters_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_submitters_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      signature_templates: {
        Row: {
          agency_id: string;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          docuseal_template_id: number | null;
          docuseal_template_slug: string | null;
          id: string;
          imo_id: string | null;
          is_active: boolean | null;
          name: string;
          required_signer_roles: string[] | null;
          signing_order: string | null;
          template_type: string;
          updated_at: string | null;
        };
        Insert: {
          agency_id: string;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          docuseal_template_id?: number | null;
          docuseal_template_slug?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean | null;
          name: string;
          required_signer_roles?: string[] | null;
          signing_order?: string | null;
          template_type?: string;
          updated_at?: string | null;
        };
        Update: {
          agency_id?: string;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          docuseal_template_id?: number | null;
          docuseal_template_slug?: string | null;
          id?: string;
          imo_id?: string | null;
          is_active?: boolean | null;
          name?: string;
          required_signer_roles?: string[] | null;
          signing_order?: string | null;
          template_type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "signature_templates_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_templates_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      slack_channel_configs: {
        Row: {
          agency_id: string | null;
          channel_id: string;
          channel_name: string;
          channel_type: string | null;
          created_at: string | null;
          created_by: string | null;
          filter_config: Json | null;
          id: string;
          imo_id: string;
          include_agent_photo: boolean | null;
          include_client_info: boolean | null;
          include_leaderboard: boolean | null;
          is_active: boolean;
          message_template: Json | null;
          notification_type: Database["public"]["Enums"]["slack_notification_type"];
          slack_integration_id: string;
          updated_at: string | null;
        };
        Insert: {
          agency_id?: string | null;
          channel_id: string;
          channel_name: string;
          channel_type?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          filter_config?: Json | null;
          id?: string;
          imo_id: string;
          include_agent_photo?: boolean | null;
          include_client_info?: boolean | null;
          include_leaderboard?: boolean | null;
          is_active?: boolean;
          message_template?: Json | null;
          notification_type: Database["public"]["Enums"]["slack_notification_type"];
          slack_integration_id: string;
          updated_at?: string | null;
        };
        Update: {
          agency_id?: string | null;
          channel_id?: string;
          channel_name?: string;
          channel_type?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          filter_config?: Json | null;
          id?: string;
          imo_id?: string;
          include_agent_photo?: boolean | null;
          include_client_info?: boolean | null;
          include_leaderboard?: boolean | null;
          is_active?: boolean;
          message_template?: Json | null;
          notification_type?: Database["public"]["Enums"]["slack_notification_type"];
          slack_integration_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "slack_channel_configs_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "slack_channel_configs_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "slack_channel_configs_slack_integration_id_fkey";
            columns: ["slack_integration_id"];
            isOneToOne: false;
            referencedRelation: "slack_integrations";
            referencedColumns: ["id"];
          },
        ];
      };
      slack_integrations: {
        Row: {
          access_token_encrypted: string;
          agency_id: string | null;
          authed_user_email: string | null;
          authed_user_id: string | null;
          bot_name: string | null;
          bot_token_encrypted: string;
          bot_user_id: string;
          connection_status: Database["public"]["Enums"]["slack_connection_status"];
          created_at: string | null;
          created_by: string | null;
          display_name: string | null;
          expires_at: string | null;
          id: string;
          imo_id: string;
          include_client_info: boolean | null;
          include_leaderboard_with_policy: boolean | null;
          is_active: boolean;
          last_connected_at: string | null;
          last_error: string | null;
          last_refresh_at: string | null;
          leaderboard_channel_id: string | null;
          leaderboard_channel_name: string | null;
          policy_channel_id: string | null;
          policy_channel_name: string | null;
          refresh_token_encrypted: string | null;
          scope: string;
          team_id: string;
          team_name: string;
          token_type: string | null;
          updated_at: string | null;
          workspace_logo_url: string | null;
        };
        Insert: {
          access_token_encrypted: string;
          agency_id?: string | null;
          authed_user_email?: string | null;
          authed_user_id?: string | null;
          bot_name?: string | null;
          bot_token_encrypted: string;
          bot_user_id: string;
          connection_status?: Database["public"]["Enums"]["slack_connection_status"];
          created_at?: string | null;
          created_by?: string | null;
          display_name?: string | null;
          expires_at?: string | null;
          id?: string;
          imo_id: string;
          include_client_info?: boolean | null;
          include_leaderboard_with_policy?: boolean | null;
          is_active?: boolean;
          last_connected_at?: string | null;
          last_error?: string | null;
          last_refresh_at?: string | null;
          leaderboard_channel_id?: string | null;
          leaderboard_channel_name?: string | null;
          policy_channel_id?: string | null;
          policy_channel_name?: string | null;
          refresh_token_encrypted?: string | null;
          scope: string;
          team_id: string;
          team_name: string;
          token_type?: string | null;
          updated_at?: string | null;
          workspace_logo_url?: string | null;
        };
        Update: {
          access_token_encrypted?: string;
          agency_id?: string | null;
          authed_user_email?: string | null;
          authed_user_id?: string | null;
          bot_name?: string | null;
          bot_token_encrypted?: string;
          bot_user_id?: string;
          connection_status?: Database["public"]["Enums"]["slack_connection_status"];
          created_at?: string | null;
          created_by?: string | null;
          display_name?: string | null;
          expires_at?: string | null;
          id?: string;
          imo_id?: string;
          include_client_info?: boolean | null;
          include_leaderboard_with_policy?: boolean | null;
          is_active?: boolean;
          last_connected_at?: string | null;
          last_error?: string | null;
          last_refresh_at?: string | null;
          leaderboard_channel_id?: string | null;
          leaderboard_channel_name?: string | null;
          policy_channel_id?: string | null;
          policy_channel_name?: string | null;
          refresh_token_encrypted?: string | null;
          scope?: string;
          team_id?: string;
          team_name?: string;
          token_type?: string | null;
          updated_at?: string | null;
          workspace_logo_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "slack_integrations_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "slack_integrations_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      slack_messages: {
        Row: {
          channel_config_id: string | null;
          channel_id: string;
          created_at: string | null;
          delivered_at: string | null;
          error_message: string | null;
          id: string;
          imo_id: string;
          message_blocks: Json | null;
          message_text: string | null;
          message_ts: string | null;
          notification_type: Database["public"]["Enums"]["slack_notification_type"];
          related_entity_id: string | null;
          related_entity_type: string | null;
          retry_count: number | null;
          sent_at: string | null;
          slack_integration_id: string;
          status: Database["public"]["Enums"]["slack_message_status"];
          thread_ts: string | null;
        };
        Insert: {
          channel_config_id?: string | null;
          channel_id: string;
          created_at?: string | null;
          delivered_at?: string | null;
          error_message?: string | null;
          id?: string;
          imo_id: string;
          message_blocks?: Json | null;
          message_text?: string | null;
          message_ts?: string | null;
          notification_type: Database["public"]["Enums"]["slack_notification_type"];
          related_entity_id?: string | null;
          related_entity_type?: string | null;
          retry_count?: number | null;
          sent_at?: string | null;
          slack_integration_id: string;
          status?: Database["public"]["Enums"]["slack_message_status"];
          thread_ts?: string | null;
        };
        Update: {
          channel_config_id?: string | null;
          channel_id?: string;
          created_at?: string | null;
          delivered_at?: string | null;
          error_message?: string | null;
          id?: string;
          imo_id?: string;
          message_blocks?: Json | null;
          message_text?: string | null;
          message_ts?: string | null;
          notification_type?: Database["public"]["Enums"]["slack_notification_type"];
          related_entity_id?: string | null;
          related_entity_type?: string | null;
          retry_count?: number | null;
          sent_at?: string | null;
          slack_integration_id?: string;
          status?: Database["public"]["Enums"]["slack_message_status"];
          thread_ts?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "slack_messages_channel_config_id_fkey";
            columns: ["channel_config_id"];
            isOneToOne: false;
            referencedRelation: "slack_channel_configs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "slack_messages_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "slack_messages_slack_integration_id_fkey";
            columns: ["slack_integration_id"];
            isOneToOne: false;
            referencedRelation: "slack_integrations";
            referencedColumns: ["id"];
          },
        ];
      };
      slack_webhooks: {
        Row: {
          channel_name: string;
          created_at: string | null;
          created_by: string | null;
          id: string;
          imo_id: string;
          include_client_info: boolean | null;
          include_leaderboard: boolean | null;
          is_active: boolean | null;
          notifications_enabled: boolean | null;
          updated_at: string | null;
          webhook_url: string;
          workspace_name: string | null;
        };
        Insert: {
          channel_name: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          imo_id: string;
          include_client_info?: boolean | null;
          include_leaderboard?: boolean | null;
          is_active?: boolean | null;
          notifications_enabled?: boolean | null;
          updated_at?: string | null;
          webhook_url: string;
          workspace_name?: string | null;
        };
        Update: {
          channel_name?: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          imo_id?: string;
          include_client_info?: boolean | null;
          include_leaderboard?: boolean | null;
          is_active?: boolean | null;
          notifications_enabled?: boolean | null;
          updated_at?: string | null;
          webhook_url?: string;
          workspace_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "slack_webhooks_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      state_classifications: {
        Row: {
          agency_id: string;
          classification: string;
          created_at: string | null;
          id: string;
          state_code: string;
          updated_at: string | null;
        };
        Insert: {
          agency_id: string;
          classification?: string;
          created_at?: string | null;
          id?: string;
          state_code: string;
          updated_at?: string | null;
        };
        Update: {
          agency_id?: string;
          classification?: string;
          created_at?: string | null;
          id?: string;
          state_code?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "state_classifications_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_addons: {
        Row: {
          created_at: string | null;
          description: string | null;
          display_name: string;
          id: string;
          is_active: boolean | null;
          name: string;
          price_annual: number;
          price_monthly: number;
          sort_order: number | null;
          stripe_price_id_annual: string | null;
          stripe_price_id_monthly: string | null;
          tier_config: Json | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          display_name: string;
          id?: string;
          is_active?: boolean | null;
          name: string;
          price_annual?: number;
          price_monthly?: number;
          sort_order?: number | null;
          stripe_price_id_annual?: string | null;
          stripe_price_id_monthly?: string | null;
          tier_config?: Json | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          display_name?: string;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          price_annual?: number;
          price_monthly?: number;
          sort_order?: number | null;
          stripe_price_id_annual?: string | null;
          stripe_price_id_monthly?: string | null;
          tier_config?: Json | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      subscription_events: {
        Row: {
          created_at: string;
          error_message: string | null;
          event_data: Json;
          event_name: string | null;
          event_type: string;
          id: string;
          processed_at: string | null;
          stripe_event_id: string | null;
          stripe_webhook_id: string | null;
          subscription_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          event_data?: Json;
          event_name?: string | null;
          event_type: string;
          id?: string;
          processed_at?: string | null;
          stripe_event_id?: string | null;
          stripe_webhook_id?: string | null;
          subscription_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          event_data?: Json;
          event_name?: string | null;
          event_type?: string;
          id?: string;
          processed_at?: string | null;
          stripe_event_id?: string | null;
          stripe_webhook_id?: string | null;
          subscription_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "user_subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_payments: {
        Row: {
          amount: number;
          billing_reason: string | null;
          card_brand: string | null;
          card_last_four: string | null;
          created_at: string;
          currency: string;
          discount_amount: number;
          id: string;
          invoice_url: string | null;
          paid_at: string | null;
          receipt_url: string | null;
          refund_amount: number | null;
          refunded_at: string | null;
          status: string;
          stripe_invoice_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_subscription_id: string | null;
          subscription_id: string | null;
          tax_amount: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          billing_reason?: string | null;
          card_brand?: string | null;
          card_last_four?: string | null;
          created_at?: string;
          currency?: string;
          discount_amount?: number;
          id?: string;
          invoice_url?: string | null;
          paid_at?: string | null;
          receipt_url?: string | null;
          refund_amount?: number | null;
          refunded_at?: string | null;
          status?: string;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_id?: string | null;
          tax_amount?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          billing_reason?: string | null;
          card_brand?: string | null;
          card_last_four?: string | null;
          created_at?: string;
          currency?: string;
          discount_amount?: number;
          id?: string;
          invoice_url?: string | null;
          paid_at?: string | null;
          receipt_url?: string | null;
          refund_amount?: number | null;
          refunded_at?: string | null;
          status?: string;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_id?: string | null;
          tax_amount?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "user_subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_plan_changes: {
        Row: {
          change_type: string;
          changed_by: string;
          created_at: string | null;
          id: string;
          new_value: Json | null;
          notes: string | null;
          old_value: Json | null;
          plan_id: string;
        };
        Insert: {
          change_type: string;
          changed_by: string;
          created_at?: string | null;
          id?: string;
          new_value?: Json | null;
          notes?: string | null;
          old_value?: Json | null;
          plan_id: string;
        };
        Update: {
          change_type?: string;
          changed_by?: string;
          created_at?: string | null;
          id?: string;
          new_value?: Json | null;
          notes?: string | null;
          old_value?: Json | null;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_plan_changes_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_plan_changes_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_plan_changes_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_plan_changes_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_plans: {
        Row: {
          analytics_sections: string[];
          announcement_features: string[];
          created_at: string;
          description: string | null;
          display_name: string;
          email_limit: number;
          features: Json;
          id: string;
          is_active: boolean;
          name: string;
          price_annual: number;
          price_monthly: number;
          sms_enabled: boolean;
          sort_order: number;
          stripe_price_id_annual: string | null;
          stripe_price_id_monthly: string | null;
          stripe_product_id: string | null;
          team_size_limit: number | null;
          updated_at: string;
        };
        Insert: {
          analytics_sections?: string[];
          announcement_features?: string[];
          created_at?: string;
          description?: string | null;
          display_name: string;
          email_limit?: number;
          features?: Json;
          id?: string;
          is_active?: boolean;
          name: string;
          price_annual?: number;
          price_monthly?: number;
          sms_enabled?: boolean;
          sort_order?: number;
          stripe_price_id_annual?: string | null;
          stripe_price_id_monthly?: string | null;
          stripe_product_id?: string | null;
          team_size_limit?: number | null;
          updated_at?: string;
        };
        Update: {
          analytics_sections?: string[];
          announcement_features?: string[];
          created_at?: string;
          description?: string | null;
          display_name?: string;
          email_limit?: number;
          features?: Json;
          id?: string;
          is_active?: boolean;
          name?: string;
          price_annual?: number;
          price_monthly?: number;
          sms_enabled?: boolean;
          sort_order?: number;
          stripe_price_id_annual?: string | null;
          stripe_price_id_monthly?: string | null;
          stripe_product_id?: string | null;
          team_size_limit?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscription_settings: {
        Row: {
          created_at: string;
          id: string;
          temporary_access_enabled: boolean;
          temporary_access_end_date: string;
          temporary_access_excluded_features: string[];
          temporary_access_test_emails: string[];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          temporary_access_enabled?: boolean;
          temporary_access_end_date?: string;
          temporary_access_excluded_features?: string[];
          temporary_access_test_emails?: string[];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          temporary_access_enabled?: boolean;
          temporary_access_end_date?: string;
          temporary_access_excluded_features?: string[];
          temporary_access_test_emails?: string[];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_hierarchy_root: {
        Row: {
          description: string | null;
          email: string;
          id: string;
        };
        Insert: {
          description?: string | null;
          email: string;
          id: string;
        };
        Update: {
          description?: string | null;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
      system_audit_log: {
        Row: {
          action: string;
          data: Json | null;
          id: string;
          performed_at: string | null;
          performed_by: string | null;
          record_id: string | null;
          table_name: string;
        };
        Insert: {
          action: string;
          data?: Json | null;
          id?: string;
          performed_at?: string | null;
          performed_by?: string | null;
          record_id?: string | null;
          table_name: string;
        };
        Update: {
          action?: string;
          data?: Json | null;
          id?: string;
          performed_at?: string | null;
          performed_by?: string | null;
          record_id?: string | null;
          table_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "system_audit_log_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_audit_log_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_audit_log_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      system_settings: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          key: string;
          updated_at: string | null;
          value: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          key: string;
          updated_at?: string | null;
          value: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          key?: string;
          updated_at?: string | null;
          value?: string;
        };
        Relationships: [];
      };
      team_seat_packs: {
        Row: {
          created_at: string | null;
          id: string;
          owner_id: string;
          quantity: number;
          status: string;
          stripe_subscription_id: string | null;
          stripe_subscription_item_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          owner_id: string;
          quantity?: number;
          status?: string;
          stripe_subscription_id?: string | null;
          stripe_subscription_item_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          owner_id?: string;
          quantity?: number;
          status?: string;
          stripe_subscription_id?: string | null;
          stripe_subscription_item_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_seat_packs_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_seat_packs_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_seat_packs_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      team_uw_wizard_seats: {
        Row: {
          agent_id: string;
          created_at: string | null;
          id: string;
          runs_limit: number;
          team_owner_id: string;
          updated_at: string | null;
        };
        Insert: {
          agent_id: string;
          created_at?: string | null;
          id?: string;
          runs_limit?: number;
          team_owner_id: string;
          updated_at?: string | null;
        };
        Update: {
          agent_id?: string;
          created_at?: string | null;
          id?: string;
          runs_limit?: number;
          team_owner_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_uw_wizard_seats_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: true;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_uw_wizard_seats_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: true;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_uw_wizard_seats_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_uw_wizard_seats_team_owner_id_fkey";
            columns: ["team_owner_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_uw_wizard_seats_team_owner_id_fkey";
            columns: ["team_owner_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_uw_wizard_seats_team_owner_id_fkey";
            columns: ["team_owner_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_assignments: {
        Row: {
          agency_id: string;
          assigned_by: string;
          assigned_to: string | null;
          assignment_type: string;
          completed_at: string | null;
          created_at: string | null;
          due_date: string | null;
          id: string;
          imo_id: string;
          is_mandatory: boolean;
          module_id: string;
          module_version: number;
          priority: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          agency_id: string;
          assigned_by: string;
          assigned_to?: string | null;
          assignment_type?: string;
          completed_at?: string | null;
          created_at?: string | null;
          due_date?: string | null;
          id?: string;
          imo_id: string;
          is_mandatory?: boolean;
          module_id: string;
          module_version?: number;
          priority?: string;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          agency_id?: string;
          assigned_by?: string;
          assigned_to?: string | null;
          assignment_type?: string;
          completed_at?: string | null;
          created_at?: string | null;
          due_date?: string | null;
          id?: string;
          imo_id?: string;
          is_mandatory?: boolean;
          module_id?: string;
          module_version?: number;
          priority?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_assignments_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_assignments_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_assignments_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_assignments_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_assignments_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_assignments_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "training_modules";
            referencedColumns: ["id"];
          },
        ];
      };
      training_badges: {
        Row: {
          badge_type: string;
          color: string;
          created_at: string | null;
          criteria: Json;
          description: string | null;
          icon: string;
          id: string;
          imo_id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string | null;
          xp_reward: number;
        };
        Insert: {
          badge_type: string;
          color?: string;
          created_at?: string | null;
          criteria: Json;
          description?: string | null;
          icon?: string;
          id?: string;
          imo_id: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string | null;
          xp_reward?: number;
        };
        Update: {
          badge_type?: string;
          color?: string;
          created_at?: string | null;
          criteria?: Json;
          description?: string | null;
          icon?: string;
          id?: string;
          imo_id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string | null;
          xp_reward?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_badges_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      training_certifications: {
        Row: {
          badge_id: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          imo_id: string;
          is_active: boolean;
          name: string;
          required_module_ids: string[] | null;
          updated_at: string | null;
          validity_months: number | null;
          xp_reward: number;
        };
        Insert: {
          badge_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          imo_id: string;
          is_active?: boolean;
          name: string;
          required_module_ids?: string[] | null;
          updated_at?: string | null;
          validity_months?: number | null;
          xp_reward?: number;
        };
        Update: {
          badge_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          imo_id?: string;
          is_active?: boolean;
          name?: string;
          required_module_ids?: string[] | null;
          updated_at?: string | null;
          validity_months?: number | null;
          xp_reward?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_certifications_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "training_badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_certifications_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      training_challenge_participants: {
        Row: {
          agency_id: string;
          challenge_id: string;
          completed: boolean;
          completed_at: string | null;
          created_at: string | null;
          current_value: number;
          id: string;
          imo_id: string;
          user_id: string;
        };
        Insert: {
          agency_id: string;
          challenge_id: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string | null;
          current_value?: number;
          id?: string;
          imo_id: string;
          user_id: string;
        };
        Update: {
          agency_id?: string;
          challenge_id?: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string | null;
          current_value?: number;
          id?: string;
          imo_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_challenge_participants_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_challenge_participants_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "training_challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_challenge_participants_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_challenge_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_challenge_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_challenge_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_challenges: {
        Row: {
          agency_id: string | null;
          badge_id: string | null;
          challenge_type: string;
          created_at: string | null;
          created_by: string;
          description: string | null;
          end_date: string;
          id: string;
          imo_id: string;
          is_active: boolean;
          start_date: string;
          target_value: number;
          title: string;
          updated_at: string | null;
          xp_reward: number;
        };
        Insert: {
          agency_id?: string | null;
          badge_id?: string | null;
          challenge_type: string;
          created_at?: string | null;
          created_by: string;
          description?: string | null;
          end_date: string;
          id?: string;
          imo_id: string;
          is_active?: boolean;
          start_date: string;
          target_value: number;
          title: string;
          updated_at?: string | null;
          xp_reward?: number;
        };
        Update: {
          agency_id?: string | null;
          badge_id?: string | null;
          challenge_type?: string;
          created_at?: string | null;
          created_by?: string;
          description?: string | null;
          end_date?: string;
          id?: string;
          imo_id?: string;
          is_active?: boolean;
          start_date?: string;
          target_value?: number;
          title?: string;
          updated_at?: string | null;
          xp_reward?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_challenges_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_challenges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "training_badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_challenges_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_challenges_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_challenges_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_challenges_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      training_documents: {
        Row: {
          category: string;
          created_at: string | null;
          description: string | null;
          file_name: string;
          file_size: number | null;
          file_type: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          storage_path: string;
          tags: string[] | null;
          updated_at: string | null;
          uploaded_by: string;
        };
        Insert: {
          category: string;
          created_at?: string | null;
          description?: string | null;
          file_name: string;
          file_size?: number | null;
          file_type?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          storage_path: string;
          tags?: string[] | null;
          updated_at?: string | null;
          uploaded_by: string;
        };
        Update: {
          category?: string;
          created_at?: string | null;
          description?: string | null;
          file_name?: string;
          file_size?: number | null;
          file_type?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          storage_path?: string;
          tags?: string[] | null;
          updated_at?: string | null;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_lesson_content: {
        Row: {
          content_type: string;
          created_at: string | null;
          document_id: string | null;
          external_url: string | null;
          external_url_label: string | null;
          id: string;
          imo_id: string;
          lesson_id: string;
          metadata: Json | null;
          rich_text_content: string | null;
          script_prompt_instructions: string | null;
          script_prompt_text: string | null;
          sort_order: number;
          title: string | null;
          updated_at: string | null;
          video_platform: string | null;
          video_url: string | null;
        };
        Insert: {
          content_type: string;
          created_at?: string | null;
          document_id?: string | null;
          external_url?: string | null;
          external_url_label?: string | null;
          id?: string;
          imo_id: string;
          lesson_id: string;
          metadata?: Json | null;
          rich_text_content?: string | null;
          script_prompt_instructions?: string | null;
          script_prompt_text?: string | null;
          sort_order?: number;
          title?: string | null;
          updated_at?: string | null;
          video_platform?: string | null;
          video_url?: string | null;
        };
        Update: {
          content_type?: string;
          created_at?: string | null;
          document_id?: string | null;
          external_url?: string | null;
          external_url_label?: string | null;
          id?: string;
          imo_id?: string;
          lesson_id?: string;
          metadata?: Json | null;
          rich_text_content?: string | null;
          script_prompt_instructions?: string | null;
          script_prompt_text?: string | null;
          sort_order?: number;
          title?: string | null;
          updated_at?: string | null;
          video_platform?: string | null;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_lesson_content_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_lesson_content_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "training_lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      training_lessons: {
        Row: {
          created_at: string | null;
          description: string | null;
          estimated_duration_minutes: number | null;
          id: string;
          imo_id: string;
          is_required: boolean;
          lesson_type: string;
          module_id: string;
          sort_order: number;
          title: string;
          updated_at: string | null;
          xp_reward: number;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          estimated_duration_minutes?: number | null;
          id?: string;
          imo_id: string;
          is_required?: boolean;
          lesson_type?: string;
          module_id: string;
          sort_order?: number;
          title: string;
          updated_at?: string | null;
          xp_reward?: number;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          estimated_duration_minutes?: number | null;
          id?: string;
          imo_id?: string;
          is_required?: boolean;
          lesson_type?: string;
          module_id?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string | null;
          xp_reward?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_lessons_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_lessons_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "training_modules";
            referencedColumns: ["id"];
          },
        ];
      };
      training_modules: {
        Row: {
          agency_id: string | null;
          category: string;
          created_at: string | null;
          created_by: string;
          description: string | null;
          difficulty_level: string;
          estimated_duration_minutes: number | null;
          id: string;
          imo_id: string;
          is_active: boolean;
          is_published: boolean;
          metadata: Json | null;
          published_at: string | null;
          tags: string[] | null;
          thumbnail_url: string | null;
          title: string;
          updated_at: string | null;
          updated_by: string | null;
          version: number;
          xp_reward: number;
        };
        Insert: {
          agency_id?: string | null;
          category: string;
          created_at?: string | null;
          created_by: string;
          description?: string | null;
          difficulty_level?: string;
          estimated_duration_minutes?: number | null;
          id?: string;
          imo_id: string;
          is_active?: boolean;
          is_published?: boolean;
          metadata?: Json | null;
          published_at?: string | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string | null;
          updated_by?: string | null;
          version?: number;
          xp_reward?: number;
        };
        Update: {
          agency_id?: string | null;
          category?: string;
          created_at?: string | null;
          created_by?: string;
          description?: string | null;
          difficulty_level?: string;
          estimated_duration_minutes?: number | null;
          id?: string;
          imo_id?: string;
          is_active?: boolean;
          is_published?: boolean;
          metadata?: Json | null;
          published_at?: string | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string | null;
          updated_by?: string | null;
          version?: number;
          xp_reward?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_modules_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_modules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_modules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_modules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_modules_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_modules_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_modules_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_modules_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_progress: {
        Row: {
          agency_id: string;
          completed_at: string | null;
          created_at: string | null;
          id: string;
          imo_id: string;
          last_accessed_at: string | null;
          lesson_id: string;
          module_id: string;
          started_at: string | null;
          status: string;
          time_spent_seconds: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          agency_id: string;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          imo_id: string;
          last_accessed_at?: string | null;
          lesson_id: string;
          module_id: string;
          started_at?: string | null;
          status?: string;
          time_spent_seconds?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          agency_id?: string;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          imo_id?: string;
          last_accessed_at?: string | null;
          lesson_id?: string;
          module_id?: string;
          started_at?: string | null;
          status?: string;
          time_spent_seconds?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_progress_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_progress_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "training_lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_progress_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "training_modules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_quiz_attempts: {
        Row: {
          agency_id: string;
          answers: Json;
          attempt_number: number;
          completed_at: string | null;
          created_at: string | null;
          id: string;
          imo_id: string;
          lesson_id: string;
          max_points: number;
          module_id: string;
          passed: boolean;
          quiz_id: string;
          score_percentage: number;
          score_points: number;
          time_taken_seconds: number | null;
          user_id: string;
        };
        Insert: {
          agency_id: string;
          answers?: Json;
          attempt_number?: number;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          imo_id: string;
          lesson_id: string;
          max_points?: number;
          module_id: string;
          passed?: boolean;
          quiz_id: string;
          score_percentage?: number;
          score_points?: number;
          time_taken_seconds?: number | null;
          user_id: string;
        };
        Update: {
          agency_id?: string;
          answers?: Json;
          attempt_number?: number;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          imo_id?: string;
          lesson_id?: string;
          max_points?: number;
          module_id?: string;
          passed?: boolean;
          quiz_id?: string;
          score_percentage?: number;
          score_points?: number;
          time_taken_seconds?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_quiz_attempts_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_quiz_attempts_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_quiz_attempts_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "training_lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_quiz_attempts_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "training_modules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_quiz_attempts_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "training_quizzes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_quiz_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_quiz_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_quiz_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_quiz_options: {
        Row: {
          created_at: string | null;
          id: string;
          is_correct: boolean;
          option_text: string;
          question_id: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_correct?: boolean;
          option_text: string;
          question_id: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_correct?: boolean;
          option_text?: string;
          question_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_quiz_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "training_quiz_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      training_quiz_questions: {
        Row: {
          created_at: string | null;
          explanation: string | null;
          id: string;
          imo_id: string;
          points: number;
          question_text: string;
          question_type: string;
          quiz_id: string;
          sort_order: number;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          explanation?: string | null;
          id?: string;
          imo_id: string;
          points?: number;
          question_text: string;
          question_type?: string;
          quiz_id: string;
          sort_order?: number;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          explanation?: string | null;
          id?: string;
          imo_id?: string;
          points?: number;
          question_text?: string;
          question_type?: string;
          quiz_id?: string;
          sort_order?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_quiz_questions_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_quiz_questions_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "training_quizzes";
            referencedColumns: ["id"];
          },
        ];
      };
      training_quizzes: {
        Row: {
          created_at: string | null;
          id: string;
          imo_id: string;
          lesson_id: string;
          max_attempts: number;
          pass_threshold: number;
          show_correct_answers: boolean;
          shuffle_options: boolean;
          shuffle_questions: boolean;
          time_limit_minutes: number | null;
          updated_at: string | null;
          xp_bonus_perfect: number;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          imo_id: string;
          lesson_id: string;
          max_attempts?: number;
          pass_threshold?: number;
          show_correct_answers?: boolean;
          shuffle_options?: boolean;
          shuffle_questions?: boolean;
          time_limit_minutes?: number | null;
          updated_at?: string | null;
          xp_bonus_perfect?: number;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          imo_id?: string;
          lesson_id?: string;
          max_attempts?: number;
          pass_threshold?: number;
          show_correct_answers?: boolean;
          shuffle_options?: boolean;
          shuffle_questions?: boolean;
          time_limit_minutes?: number | null;
          updated_at?: string | null;
          xp_bonus_perfect?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_quizzes_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_quizzes_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: true;
            referencedRelation: "training_lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      training_user_badges: {
        Row: {
          agency_id: string;
          badge_id: string;
          earned_at: string | null;
          id: string;
          imo_id: string;
          user_id: string;
        };
        Insert: {
          agency_id: string;
          badge_id: string;
          earned_at?: string | null;
          id?: string;
          imo_id: string;
          user_id: string;
        };
        Update: {
          agency_id?: string;
          badge_id?: string;
          earned_at?: string | null;
          id?: string;
          imo_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_user_badges_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "training_badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_badges_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_badges_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_badges_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_badges_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_user_certifications: {
        Row: {
          agency_id: string;
          certification_id: string;
          earned_at: string | null;
          expires_at: string | null;
          id: string;
          imo_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          agency_id: string;
          certification_id: string;
          earned_at?: string | null;
          expires_at?: string | null;
          id?: string;
          imo_id: string;
          status?: string;
          user_id: string;
        };
        Update: {
          agency_id?: string;
          certification_id?: string;
          earned_at?: string | null;
          expires_at?: string | null;
          id?: string;
          imo_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_user_certifications_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_certifications_certification_id_fkey";
            columns: ["certification_id"];
            isOneToOne: false;
            referencedRelation: "training_certifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_certifications_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_certifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_certifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_certifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_user_stats: {
        Row: {
          agency_id: string;
          avg_quiz_score: number;
          current_streak_days: number;
          imo_id: string;
          last_activity_date: string | null;
          lessons_completed: number;
          longest_streak_days: number;
          modules_completed: number;
          quizzes_passed: number;
          total_time_spent_seconds: number;
          total_xp: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          agency_id: string;
          avg_quiz_score?: number;
          current_streak_days?: number;
          imo_id: string;
          last_activity_date?: string | null;
          lessons_completed?: number;
          longest_streak_days?: number;
          modules_completed?: number;
          quizzes_passed?: number;
          total_time_spent_seconds?: number;
          total_xp?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          agency_id?: string;
          avg_quiz_score?: number;
          current_streak_days?: number;
          imo_id?: string;
          last_activity_date?: string | null;
          lessons_completed?: number;
          longest_streak_days?: number;
          modules_completed?: number;
          quizzes_passed?: number;
          total_time_spent_seconds?: number;
          total_xp?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_user_stats_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_stats_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_user_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_xp_entries: {
        Row: {
          agency_id: string;
          created_at: string | null;
          description: string | null;
          id: string;
          imo_id: string;
          source_id: string | null;
          source_type: string;
          user_id: string;
          xp_amount: number;
        };
        Insert: {
          agency_id: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          imo_id: string;
          source_id?: string | null;
          source_type: string;
          user_id: string;
          xp_amount: number;
        };
        Update: {
          agency_id?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          imo_id?: string;
          source_id?: string | null;
          source_type?: string;
          user_id?: string;
          xp_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_xp_entries_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_xp_entries_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_xp_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_xp_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_xp_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trigger_event_types: {
        Row: {
          available_variables: Json | null;
          category: string;
          created_at: string | null;
          description: string | null;
          event_name: string;
          id: string;
          is_active: boolean | null;
        };
        Insert: {
          available_variables?: Json | null;
          category: string;
          created_at?: string | null;
          description?: string | null;
          event_name: string;
          id?: string;
          is_active?: boolean | null;
        };
        Update: {
          available_variables?: Json | null;
          category?: string;
          created_at?: string | null;
          description?: string | null;
          event_name?: string;
          id?: string;
          is_active?: boolean | null;
        };
        Relationships: [];
      };
      underwriting_decision_trees: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          imo_id: string;
          is_active: boolean | null;
          is_default: boolean | null;
          name: string;
          rules: Json;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          imo_id: string;
          is_active?: boolean | null;
          is_default?: boolean | null;
          name: string;
          rules?: Json;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          imo_id?: string;
          is_active?: boolean | null;
          is_default?: boolean | null;
          name?: string;
          rules?: Json;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "underwriting_decision_trees_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_decision_trees_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_decision_trees_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_decision_trees_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      underwriting_guides: {
        Row: {
          carrier_id: string;
          content_hash: string | null;
          created_at: string | null;
          effective_date: string | null;
          expiration_date: string | null;
          file_name: string;
          file_size_bytes: number | null;
          id: string;
          imo_id: string;
          name: string;
          parsed_content: string | null;
          parsing_error: string | null;
          parsing_status: string | null;
          storage_path: string;
          updated_at: string | null;
          uploaded_by: string | null;
          version: string | null;
        };
        Insert: {
          carrier_id: string;
          content_hash?: string | null;
          created_at?: string | null;
          effective_date?: string | null;
          expiration_date?: string | null;
          file_name: string;
          file_size_bytes?: number | null;
          id?: string;
          imo_id: string;
          name: string;
          parsed_content?: string | null;
          parsing_error?: string | null;
          parsing_status?: string | null;
          storage_path: string;
          updated_at?: string | null;
          uploaded_by?: string | null;
          version?: string | null;
        };
        Update: {
          carrier_id?: string;
          content_hash?: string | null;
          created_at?: string | null;
          effective_date?: string | null;
          expiration_date?: string | null;
          file_name?: string;
          file_size_bytes?: number | null;
          id?: string;
          imo_id?: string;
          name?: string;
          parsed_content?: string | null;
          parsing_error?: string | null;
          parsing_status?: string | null;
          storage_path?: string;
          updated_at?: string | null;
          uploaded_by?: string | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "underwriting_guides_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_guides_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_guides_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_guides_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_guides_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      underwriting_health_conditions: {
        Row: {
          acceptance_key_fields: string[] | null;
          category: string;
          code: string;
          created_at: string | null;
          follow_up_schema: Json;
          follow_up_schema_version: number | null;
          id: string;
          is_active: boolean | null;
          knockout_category: string | null;
          name: string;
          risk_weight: number | null;
          sort_order: number | null;
          updated_at: string | null;
        };
        Insert: {
          acceptance_key_fields?: string[] | null;
          category: string;
          code: string;
          created_at?: string | null;
          follow_up_schema?: Json;
          follow_up_schema_version?: number | null;
          id?: string;
          is_active?: boolean | null;
          knockout_category?: string | null;
          name: string;
          risk_weight?: number | null;
          sort_order?: number | null;
          updated_at?: string | null;
        };
        Update: {
          acceptance_key_fields?: string[] | null;
          category?: string;
          code?: string;
          created_at?: string | null;
          follow_up_schema?: Json;
          follow_up_schema_version?: number | null;
          id?: string;
          is_active?: boolean | null;
          knockout_category?: string | null;
          name?: string;
          risk_weight?: number | null;
          sort_order?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      underwriting_rule_evaluation_log: {
        Row: {
          condition_code: string | null;
          evaluated_at: string | null;
          expires_at: string | null;
          failed_conditions: Json | null;
          id: string;
          imo_id: string;
          input_hash: string | null;
          matched_conditions: Json | null;
          missing_fields: Json | null;
          outcome_applied: Json | null;
          predicate_result: string | null;
          rule_id: string | null;
          rule_set_id: string | null;
          session_id: string | null;
        };
        Insert: {
          condition_code?: string | null;
          evaluated_at?: string | null;
          expires_at?: string | null;
          failed_conditions?: Json | null;
          id?: string;
          imo_id: string;
          input_hash?: string | null;
          matched_conditions?: Json | null;
          missing_fields?: Json | null;
          outcome_applied?: Json | null;
          predicate_result?: string | null;
          rule_id?: string | null;
          rule_set_id?: string | null;
          session_id?: string | null;
        };
        Update: {
          condition_code?: string | null;
          evaluated_at?: string | null;
          expires_at?: string | null;
          failed_conditions?: Json | null;
          id?: string;
          imo_id?: string;
          input_hash?: string | null;
          matched_conditions?: Json | null;
          missing_fields?: Json | null;
          outcome_applied?: Json | null;
          predicate_result?: string | null;
          rule_id?: string | null;
          rule_set_id?: string | null;
          session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "underwriting_rule_evaluation_log_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_evaluation_log_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "underwriting_rules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_evaluation_log_rule_set_id_fkey";
            columns: ["rule_set_id"];
            isOneToOne: false;
            referencedRelation: "underwriting_rule_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_evaluation_log_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "underwriting_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      underwriting_rule_sets: {
        Row: {
          carrier_id: string;
          condition_code: string | null;
          created_at: string | null;
          created_by: string | null;
          default_outcome: Json;
          description: string | null;
          id: string;
          imo_id: string;
          is_active: boolean | null;
          name: string;
          needs_review: boolean | null;
          product_id: string | null;
          product_type:
            | Database["public"]["Enums"]["insurance_product_type"]
            | null;
          review_notes: string | null;
          review_status:
            | Database["public"]["Enums"]["rule_review_status"]
            | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          scope: Database["public"]["Enums"]["rule_set_scope"];
          source: string | null;
          source_guide_id: string | null;
          source_type: Database["public"]["Enums"]["rule_source_type"] | null;
          template_version: number | null;
          updated_at: string | null;
          variant: string;
          version: number | null;
        };
        Insert: {
          carrier_id: string;
          condition_code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          default_outcome?: Json;
          description?: string | null;
          id?: string;
          imo_id: string;
          is_active?: boolean | null;
          name: string;
          needs_review?: boolean | null;
          product_id?: string | null;
          product_type?:
            | Database["public"]["Enums"]["insurance_product_type"]
            | null;
          review_notes?: string | null;
          review_status?:
            | Database["public"]["Enums"]["rule_review_status"]
            | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          scope?: Database["public"]["Enums"]["rule_set_scope"];
          source?: string | null;
          source_guide_id?: string | null;
          source_type?: Database["public"]["Enums"]["rule_source_type"] | null;
          template_version?: number | null;
          updated_at?: string | null;
          variant?: string;
          version?: number | null;
        };
        Update: {
          carrier_id?: string;
          condition_code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          default_outcome?: Json;
          description?: string | null;
          id?: string;
          imo_id?: string;
          is_active?: boolean | null;
          name?: string;
          needs_review?: boolean | null;
          product_id?: string | null;
          product_type?:
            | Database["public"]["Enums"]["insurance_product_type"]
            | null;
          review_notes?: string | null;
          review_status?:
            | Database["public"]["Enums"]["rule_review_status"]
            | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          scope?: Database["public"]["Enums"]["rule_set_scope"];
          source?: string | null;
          source_guide_id?: string | null;
          source_type?: Database["public"]["Enums"]["rule_source_type"] | null;
          template_version?: number | null;
          updated_at?: string | null;
          variant?: string;
          version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "underwriting_rule_sets_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_sets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_sets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_sets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_sets_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_sets_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_sets_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_sets_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_sets_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_rule_sets_source_guide_id_fkey";
            columns: ["source_guide_id"];
            isOneToOne: false;
            referencedRelation: "underwriting_guides";
            referencedColumns: ["id"];
          },
        ];
      };
      underwriting_rules: {
        Row: {
          age_band_max: number | null;
          age_band_min: number | null;
          created_at: string | null;
          description: string | null;
          extraction_confidence: number | null;
          gender: string | null;
          id: string;
          name: string;
          outcome_concerns: string[] | null;
          outcome_eligibility: string;
          outcome_flat_extra_per_thousand: number | null;
          outcome_flat_extra_years: number | null;
          outcome_health_class: Database["public"]["Enums"]["health_class"];
          outcome_reason: string;
          outcome_table_rating:
            | Database["public"]["Enums"]["table_rating"]
            | null;
          predicate: Json;
          predicate_version: number | null;
          priority: number;
          rule_set_id: string;
          source_pages: number[] | null;
          source_snippet: string | null;
          updated_at: string | null;
        };
        Insert: {
          age_band_max?: number | null;
          age_band_min?: number | null;
          created_at?: string | null;
          description?: string | null;
          extraction_confidence?: number | null;
          gender?: string | null;
          id?: string;
          name: string;
          outcome_concerns?: string[] | null;
          outcome_eligibility: string;
          outcome_flat_extra_per_thousand?: number | null;
          outcome_flat_extra_years?: number | null;
          outcome_health_class: Database["public"]["Enums"]["health_class"];
          outcome_reason: string;
          outcome_table_rating?:
            | Database["public"]["Enums"]["table_rating"]
            | null;
          predicate?: Json;
          predicate_version?: number | null;
          priority?: number;
          rule_set_id: string;
          source_pages?: number[] | null;
          source_snippet?: string | null;
          updated_at?: string | null;
        };
        Update: {
          age_band_max?: number | null;
          age_band_min?: number | null;
          created_at?: string | null;
          description?: string | null;
          extraction_confidence?: number | null;
          gender?: string | null;
          id?: string;
          name?: string;
          outcome_concerns?: string[] | null;
          outcome_eligibility?: string;
          outcome_flat_extra_per_thousand?: number | null;
          outcome_flat_extra_years?: number | null;
          outcome_health_class?: Database["public"]["Enums"]["health_class"];
          outcome_reason?: string;
          outcome_table_rating?:
            | Database["public"]["Enums"]["table_rating"]
            | null;
          predicate?: Json;
          predicate_version?: number | null;
          priority?: number;
          rule_set_id?: string;
          source_pages?: number[] | null;
          source_snippet?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "underwriting_rules_rule_set_id_fkey";
            columns: ["rule_set_id"];
            isOneToOne: false;
            referencedRelation: "underwriting_rule_sets";
            referencedColumns: ["id"];
          },
        ];
      };
      underwriting_session_recommendations: {
        Row: {
          annual_premium: number | null;
          approval_likelihood: number | null;
          carrier_id: string;
          condition_decisions: Json | null;
          confidence: number | null;
          cost_per_thousand: number | null;
          created_at: string | null;
          draft_rules_fyi: Json | null;
          eligibility_reasons: string[] | null;
          eligibility_status: string;
          health_class_result: string | null;
          id: string;
          imo_id: string;
          missing_fields: Json | null;
          monthly_premium: number | null;
          product_id: string;
          recommendation_rank: number | null;
          recommendation_reason: string | null;
          score: number | null;
          score_components: Json | null;
          session_id: string;
        };
        Insert: {
          annual_premium?: number | null;
          approval_likelihood?: number | null;
          carrier_id: string;
          condition_decisions?: Json | null;
          confidence?: number | null;
          cost_per_thousand?: number | null;
          created_at?: string | null;
          draft_rules_fyi?: Json | null;
          eligibility_reasons?: string[] | null;
          eligibility_status: string;
          health_class_result?: string | null;
          id?: string;
          imo_id: string;
          missing_fields?: Json | null;
          monthly_premium?: number | null;
          product_id: string;
          recommendation_rank?: number | null;
          recommendation_reason?: string | null;
          score?: number | null;
          score_components?: Json | null;
          session_id: string;
        };
        Update: {
          annual_premium?: number | null;
          approval_likelihood?: number | null;
          carrier_id?: string;
          condition_decisions?: Json | null;
          confidence?: number | null;
          cost_per_thousand?: number | null;
          created_at?: string | null;
          draft_rules_fyi?: Json | null;
          eligibility_reasons?: string[] | null;
          eligibility_status?: string;
          health_class_result?: string | null;
          id?: string;
          imo_id?: string;
          missing_fields?: Json | null;
          monthly_premium?: number | null;
          product_id?: string;
          recommendation_rank?: number | null;
          recommendation_reason?: string | null;
          score?: number | null;
          score_components?: Json | null;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "underwriting_session_recommendations_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_session_recommendations_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_session_recommendations_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_session_recommendations_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "underwriting_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      underwriting_sessions: {
        Row: {
          agency_id: string | null;
          ai_analysis: Json | null;
          client_age: number;
          client_bmi: number | null;
          client_dob: string | null;
          client_gender: string | null;
          client_height_inches: number | null;
          client_name: string | null;
          client_state: string | null;
          client_weight_lbs: number | null;
          conditions_reported: string[] | null;
          created_at: string | null;
          created_by: string;
          decision_tree_id: string | null;
          eligibility_summary: Json | null;
          evaluation_metadata: Json;
          health_responses: Json;
          health_tier: string | null;
          id: string;
          imo_id: string;
          notes: string | null;
          recommendations: Json;
          requested_face_amount: number | null;
          requested_face_amounts: Json;
          requested_product_types: string[] | null;
          result_source: string;
          risk_factors: string[] | null;
          run_key: string | null;
          selected_term_years: number | null;
          session_duration_seconds: number | null;
          status: string | null;
          tobacco_details: Json | null;
          tobacco_use: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          agency_id?: string | null;
          ai_analysis?: Json | null;
          client_age: number;
          client_bmi?: number | null;
          client_dob?: string | null;
          client_gender?: string | null;
          client_height_inches?: number | null;
          client_name?: string | null;
          client_state?: string | null;
          client_weight_lbs?: number | null;
          conditions_reported?: string[] | null;
          created_at?: string | null;
          created_by: string;
          decision_tree_id?: string | null;
          eligibility_summary?: Json | null;
          evaluation_metadata?: Json;
          health_responses?: Json;
          health_tier?: string | null;
          id?: string;
          imo_id: string;
          notes?: string | null;
          recommendations?: Json;
          requested_face_amount?: number | null;
          requested_face_amounts?: Json;
          requested_product_types?: string[] | null;
          result_source?: string;
          risk_factors?: string[] | null;
          run_key?: string | null;
          selected_term_years?: number | null;
          session_duration_seconds?: number | null;
          status?: string | null;
          tobacco_details?: Json | null;
          tobacco_use?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          agency_id?: string | null;
          ai_analysis?: Json | null;
          client_age?: number;
          client_bmi?: number | null;
          client_dob?: string | null;
          client_gender?: string | null;
          client_height_inches?: number | null;
          client_name?: string | null;
          client_state?: string | null;
          client_weight_lbs?: number | null;
          conditions_reported?: string[] | null;
          created_at?: string | null;
          created_by?: string;
          decision_tree_id?: string | null;
          eligibility_summary?: Json | null;
          evaluation_metadata?: Json;
          health_responses?: Json;
          health_tier?: string | null;
          id?: string;
          imo_id?: string;
          notes?: string | null;
          recommendations?: Json;
          requested_face_amount?: number | null;
          requested_face_amounts?: Json;
          requested_product_types?: string[] | null;
          result_source?: string;
          risk_factors?: string[] | null;
          run_key?: string | null;
          selected_term_years?: number | null;
          session_duration_seconds?: number | null;
          status?: string | null;
          tobacco_details?: Json | null;
          tobacco_use?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "underwriting_sessions_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_sessions_decision_tree_id_fkey";
            columns: ["decision_tree_id"];
            isOneToOne: false;
            referencedRelation: "underwriting_decision_trees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "underwriting_sessions_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_tracking: {
        Row: {
          count: number;
          created_at: string;
          id: string;
          metric: string;
          overage_amount: number;
          overage_charged: boolean;
          period_end: string;
          period_start: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          count?: number;
          created_at?: string;
          id?: string;
          metric: string;
          overage_amount?: number;
          overage_charged?: boolean;
          period_end: string;
          period_start: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          id?: string;
          metric?: string;
          overage_amount?: number;
          overage_charged?: boolean;
          period_end?: string;
          period_start?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_activity_log: {
        Row: {
          action_type: string;
          created_at: string | null;
          details: Json | null;
          id: string;
          performed_by: string | null;
          user_id: string;
        };
        Insert: {
          action_type: string;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          performed_by?: string | null;
          user_id: string;
        };
        Update: {
          action_type?: string;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          performed_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_activity_log_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_activity_log_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_activity_log_performed_by_fkey";
            columns: ["performed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_activity_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_activity_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_activity_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_documents: {
        Row: {
          created_at: string | null;
          document_name: string;
          document_type: string;
          expires_at: string | null;
          file_name: string;
          file_size: number | null;
          file_type: string | null;
          id: string;
          notes: string | null;
          required: boolean | null;
          status: string;
          storage_path: string;
          updated_at: string | null;
          uploaded_at: string | null;
          uploaded_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          document_name: string;
          document_type: string;
          expires_at?: string | null;
          file_name: string;
          file_size?: number | null;
          file_type?: string | null;
          id?: string;
          notes?: string | null;
          required?: boolean | null;
          status?: string;
          storage_path: string;
          updated_at?: string | null;
          uploaded_at?: string | null;
          uploaded_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          document_name?: string;
          document_type?: string;
          expires_at?: string | null;
          file_name?: string;
          file_size?: number | null;
          file_type?: string | null;
          id?: string;
          notes?: string | null;
          required?: boolean | null;
          status?: string;
          storage_path?: string;
          updated_at?: string | null;
          uploaded_at?: string | null;
          uploaded_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_documents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_documents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_documents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_email_attachments: {
        Row: {
          created_at: string | null;
          email_id: string;
          file_name: string;
          file_size: number | null;
          file_type: string | null;
          id: string;
          storage_path: string;
        };
        Insert: {
          created_at?: string | null;
          email_id: string;
          file_name: string;
          file_size?: number | null;
          file_type?: string | null;
          id?: string;
          storage_path: string;
        };
        Update: {
          created_at?: string | null;
          email_id?: string;
          file_name?: string;
          file_size?: number | null;
          file_type?: string | null;
          id?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_email_attachments_email_id_fkey";
            columns: ["email_id"];
            isOneToOne: false;
            referencedRelation: "user_emails";
            referencedColumns: ["id"];
          },
        ];
      };
      user_email_oauth_tokens: {
        Row: {
          access_token_encrypted: string;
          created_at: string | null;
          email_address: string;
          id: string;
          is_active: boolean | null;
          last_used_at: string | null;
          provider: string;
          refresh_token_encrypted: string | null;
          scopes: string[] | null;
          token_expiry: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          access_token_encrypted: string;
          created_at?: string | null;
          email_address: string;
          id?: string;
          is_active?: boolean | null;
          last_used_at?: string | null;
          provider: string;
          refresh_token_encrypted?: string | null;
          scopes?: string[] | null;
          token_expiry?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          access_token_encrypted?: string;
          created_at?: string | null;
          email_address?: string;
          id?: string;
          is_active?: boolean | null;
          last_used_at?: string | null;
          provider?: string;
          refresh_token_encrypted?: string | null;
          scopes?: string[] | null;
          token_expiry?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_email_oauth_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_email_oauth_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_email_oauth_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_emails: {
        Row: {
          attachment_count: number | null;
          body_html: string | null;
          body_text: string | null;
          campaign_id: string | null;
          cc_addresses: string[] | null;
          click_count: number | null;
          created_at: string | null;
          delivered_at: string | null;
          email_provider: string | null;
          failed_reason: string | null;
          first_clicked_at: string | null;
          first_opened_at: string | null;
          from_address: string | null;
          gmail_history_id: string | null;
          gmail_label_ids: string[] | null;
          gmail_message_id: string | null;
          gmail_thread_id: string | null;
          has_attachments: boolean | null;
          id: string;
          in_reply_to_header: string | null;
          is_incoming: boolean | null;
          is_read: boolean | null;
          labels: string[] | null;
          message_id_header: string | null;
          metadata: Json | null;
          open_count: number | null;
          opened_at: string | null;
          provider: string | null;
          provider_message_id: string | null;
          references_header: string[] | null;
          reply_to_id: string | null;
          scheduled_for: string | null;
          sender_id: string | null;
          sent_at: string | null;
          signature_id: string | null;
          source: string | null;
          status: string;
          subject: string;
          thread_id: string | null;
          to_addresses: string[] | null;
          tracking_id: string | null;
          updated_at: string | null;
          user_id: string;
          workflow_id: string | null;
        };
        Insert: {
          attachment_count?: number | null;
          body_html?: string | null;
          body_text?: string | null;
          campaign_id?: string | null;
          cc_addresses?: string[] | null;
          click_count?: number | null;
          created_at?: string | null;
          delivered_at?: string | null;
          email_provider?: string | null;
          failed_reason?: string | null;
          first_clicked_at?: string | null;
          first_opened_at?: string | null;
          from_address?: string | null;
          gmail_history_id?: string | null;
          gmail_label_ids?: string[] | null;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          has_attachments?: boolean | null;
          id?: string;
          in_reply_to_header?: string | null;
          is_incoming?: boolean | null;
          is_read?: boolean | null;
          labels?: string[] | null;
          message_id_header?: string | null;
          metadata?: Json | null;
          open_count?: number | null;
          opened_at?: string | null;
          provider?: string | null;
          provider_message_id?: string | null;
          references_header?: string[] | null;
          reply_to_id?: string | null;
          scheduled_for?: string | null;
          sender_id?: string | null;
          sent_at?: string | null;
          signature_id?: string | null;
          source?: string | null;
          status?: string;
          subject: string;
          thread_id?: string | null;
          to_addresses?: string[] | null;
          tracking_id?: string | null;
          updated_at?: string | null;
          user_id: string;
          workflow_id?: string | null;
        };
        Update: {
          attachment_count?: number | null;
          body_html?: string | null;
          body_text?: string | null;
          campaign_id?: string | null;
          cc_addresses?: string[] | null;
          click_count?: number | null;
          created_at?: string | null;
          delivered_at?: string | null;
          email_provider?: string | null;
          failed_reason?: string | null;
          first_clicked_at?: string | null;
          first_opened_at?: string | null;
          from_address?: string | null;
          gmail_history_id?: string | null;
          gmail_label_ids?: string[] | null;
          gmail_message_id?: string | null;
          gmail_thread_id?: string | null;
          has_attachments?: boolean | null;
          id?: string;
          in_reply_to_header?: string | null;
          is_incoming?: boolean | null;
          is_read?: boolean | null;
          labels?: string[] | null;
          message_id_header?: string | null;
          metadata?: Json | null;
          open_count?: number | null;
          opened_at?: string | null;
          provider?: string | null;
          provider_message_id?: string | null;
          references_header?: string[] | null;
          reply_to_id?: string | null;
          scheduled_for?: string | null;
          sender_id?: string | null;
          sent_at?: string | null;
          signature_id?: string | null;
          source?: string | null;
          status?: string;
          subject?: string;
          thread_id?: string | null;
          to_addresses?: string[] | null;
          tracking_id?: string | null;
          updated_at?: string | null;
          user_id?: string;
          workflow_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_emails_reply_to_id_fkey";
            columns: ["reply_to_id"];
            isOneToOne: false;
            referencedRelation: "user_emails";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_emails_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_emails_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_emails_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_emails_signature_id_fkey";
            columns: ["signature_id"];
            isOneToOne: false;
            referencedRelation: "email_signatures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_emails_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_emails_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_emails_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_expense_categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_mailbox_settings: {
        Row: {
          auto_reply_enabled: boolean | null;
          auto_reply_message: string | null;
          auto_reply_subject: string | null;
          created_at: string | null;
          display_name: string | null;
          id: string;
          notification_email_enabled: boolean | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          auto_reply_enabled?: boolean | null;
          auto_reply_message?: string | null;
          auto_reply_subject?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          id?: string;
          notification_email_enabled?: boolean | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          auto_reply_enabled?: boolean | null;
          auto_reply_message?: string | null;
          auto_reply_subject?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          id?: string;
          notification_email_enabled?: boolean | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_mailbox_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_mailbox_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_mailbox_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_profiles: {
        Row: {
          agency_id: string | null;
          agent_status: Database["public"]["Enums"]["agent_status"] | null;
          approval_status: string;
          approved_at: string | null;
          approved_by: string | null;
          archive_reason: string | null;
          archived_at: string | null;
          archived_by: string | null;
          city: string | null;
          contract_level: number | null;
          created_at: string | null;
          current_onboarding_phase: string | null;
          custom_permissions: Json | null;
          custom_recruiting_url: string | null;
          date_of_birth: string | null;
          denial_reason: string | null;
          denied_at: string | null;
          email: string;
          facebook_handle: string | null;
          first_name: string | null;
          hierarchy_depth: number | null;
          hierarchy_path: string | null;
          id: string;
          imo_id: string | null;
          instagram_url: string | null;
          instagram_username: string | null;
          is_admin: boolean;
          is_super_admin: boolean | null;
          last_name: string | null;
          license_expiration: string | null;
          license_number: string | null;
          licensing_info: Json | null;
          npn: string | null;
          onboarding_completed_at: string | null;
          onboarding_started_at: string | null;
          onboarding_status: string | null;
          password_set_at: string | null;
          personal_website: string | null;
          phone: string | null;
          pipeline_template_id: string | null;
          profile_photo_url: string | null;
          recruiter_id: string | null;
          recruiter_slug: string | null;
          referral_source: string | null;
          resident_state: string | null;
          roles: string[] | null;
          slack_member_overrides: Json | null;
          state: string | null;
          street_address: string | null;
          subscription_tier: string;
          updated_at: string | null;
          upline_id: string | null;
          uw_wizard_enabled: boolean;
          zip: string | null;
        };
        Insert: {
          agency_id?: string | null;
          agent_status?: Database["public"]["Enums"]["agent_status"] | null;
          approval_status?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          archive_reason?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          city?: string | null;
          contract_level?: number | null;
          created_at?: string | null;
          current_onboarding_phase?: string | null;
          custom_permissions?: Json | null;
          custom_recruiting_url?: string | null;
          date_of_birth?: string | null;
          denial_reason?: string | null;
          denied_at?: string | null;
          email: string;
          facebook_handle?: string | null;
          first_name?: string | null;
          hierarchy_depth?: number | null;
          hierarchy_path?: string | null;
          id?: string;
          imo_id?: string | null;
          instagram_url?: string | null;
          instagram_username?: string | null;
          is_admin?: boolean;
          is_super_admin?: boolean | null;
          last_name?: string | null;
          license_expiration?: string | null;
          license_number?: string | null;
          licensing_info?: Json | null;
          npn?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_started_at?: string | null;
          onboarding_status?: string | null;
          password_set_at?: string | null;
          personal_website?: string | null;
          phone?: string | null;
          pipeline_template_id?: string | null;
          profile_photo_url?: string | null;
          recruiter_id?: string | null;
          recruiter_slug?: string | null;
          referral_source?: string | null;
          resident_state?: string | null;
          roles?: string[] | null;
          slack_member_overrides?: Json | null;
          state?: string | null;
          street_address?: string | null;
          subscription_tier?: string;
          updated_at?: string | null;
          upline_id?: string | null;
          uw_wizard_enabled?: boolean;
          zip?: string | null;
        };
        Update: {
          agency_id?: string | null;
          agent_status?: Database["public"]["Enums"]["agent_status"] | null;
          approval_status?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          archive_reason?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          city?: string | null;
          contract_level?: number | null;
          created_at?: string | null;
          current_onboarding_phase?: string | null;
          custom_permissions?: Json | null;
          custom_recruiting_url?: string | null;
          date_of_birth?: string | null;
          denial_reason?: string | null;
          denied_at?: string | null;
          email?: string;
          facebook_handle?: string | null;
          first_name?: string | null;
          hierarchy_depth?: number | null;
          hierarchy_path?: string | null;
          id?: string;
          imo_id?: string | null;
          instagram_url?: string | null;
          instagram_username?: string | null;
          is_admin?: boolean;
          is_super_admin?: boolean | null;
          last_name?: string | null;
          license_expiration?: string | null;
          license_number?: string | null;
          licensing_info?: Json | null;
          npn?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_started_at?: string | null;
          onboarding_status?: string | null;
          password_set_at?: string | null;
          personal_website?: string | null;
          phone?: string | null;
          pipeline_template_id?: string | null;
          profile_photo_url?: string | null;
          recruiter_id?: string | null;
          recruiter_slug?: string | null;
          referral_source?: string | null;
          resident_state?: string | null;
          roles?: string[] | null;
          slack_member_overrides?: Json | null;
          state?: string | null;
          street_address?: string | null;
          subscription_tier?: string;
          updated_at?: string | null;
          upline_id?: string | null;
          uw_wizard_enabled?: boolean;
          zip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_pipeline_template_id_fkey";
            columns: ["pipeline_template_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_quick_quote_presets: {
        Row: {
          budget_presets: Json;
          coverage_presets: Json;
          created_at: string;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          budget_presets?: Json;
          coverage_presets?: Json;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          budget_presets?: Json;
          coverage_presets?: Json;
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_slack_preferences: {
        Row: {
          auto_post_enabled: boolean | null;
          created_at: string | null;
          default_view_channel_id: string | null;
          default_view_channel_name: string | null;
          default_view_integration_id: string | null;
          id: string;
          imo_id: string;
          policy_post_channels: Json | null;
          slack_member_id: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          auto_post_enabled?: boolean | null;
          created_at?: string | null;
          default_view_channel_id?: string | null;
          default_view_channel_name?: string | null;
          default_view_integration_id?: string | null;
          id?: string;
          imo_id: string;
          policy_post_channels?: Json | null;
          slack_member_id?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          auto_post_enabled?: boolean | null;
          created_at?: string | null;
          default_view_channel_id?: string | null;
          default_view_channel_name?: string | null;
          default_view_integration_id?: string | null;
          id?: string;
          imo_id?: string;
          policy_post_channels?: Json | null;
          slack_member_id?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_slack_preferences_default_view_integration_id_fkey";
            columns: ["default_view_integration_id"];
            isOneToOne: false;
            referencedRelation: "slack_integrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_slack_preferences_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      user_subscription_addons: {
        Row: {
          addon_id: string;
          billing_interval: string | null;
          cancelled_at: string | null;
          created_at: string | null;
          current_period_end: string | null;
          current_period_start: string | null;
          granted_by: string | null;
          id: string;
          status: string;
          stripe_checkout_session_id: string | null;
          stripe_subscription_id: string | null;
          stripe_subscription_item_id: string | null;
          tier_id: string | null;
          updated_at: string | null;
          user_id: string;
          voice_entitlement_snapshot: Json | null;
          voice_last_sync_attempt_at: string | null;
          voice_last_sync_error: string | null;
          voice_last_sync_event_id: string | null;
          voice_last_sync_http_status: number | null;
          voice_last_synced_at: string | null;
          voice_sync_status: string;
        };
        Insert: {
          addon_id: string;
          billing_interval?: string | null;
          cancelled_at?: string | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          granted_by?: string | null;
          id?: string;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_subscription_item_id?: string | null;
          tier_id?: string | null;
          updated_at?: string | null;
          user_id: string;
          voice_entitlement_snapshot?: Json | null;
          voice_last_sync_attempt_at?: string | null;
          voice_last_sync_error?: string | null;
          voice_last_sync_event_id?: string | null;
          voice_last_sync_http_status?: number | null;
          voice_last_synced_at?: string | null;
          voice_sync_status?: string;
        };
        Update: {
          addon_id?: string;
          billing_interval?: string | null;
          cancelled_at?: string | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          granted_by?: string | null;
          id?: string;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_subscription_item_id?: string | null;
          tier_id?: string | null;
          updated_at?: string | null;
          user_id?: string;
          voice_entitlement_snapshot?: Json | null;
          voice_last_sync_attempt_at?: string | null;
          voice_last_sync_error?: string | null;
          voice_last_sync_event_id?: string | null;
          voice_last_sync_http_status?: number | null;
          voice_last_synced_at?: string | null;
          voice_sync_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_subscription_addons_addon_id_fkey";
            columns: ["addon_id"];
            isOneToOne: false;
            referencedRelation: "subscription_addons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_subscription_addons_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_subscription_addons_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_subscription_addons_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_subscription_addons_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_subscription_addons_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_subscription_addons_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_subscriptions: {
        Row: {
          billing_interval: string;
          cancel_at_period_end: boolean;
          cancelled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          grandfathered_until: string | null;
          id: string;
          plan_id: string;
          status: string;
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          trial_ends_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          billing_interval?: string;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          grandfathered_until?: string | null;
          id?: string;
          plan_id: string;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          billing_interval?: string;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          grandfathered_until?: string | null;
          id?: string;
          plan_id?: string;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_targets: {
        Row: {
          achievements: Json | null;
          annual_income_target: number | null;
          annual_policies_target: number | null;
          avg_premium_target: number | null;
          created_at: string | null;
          expense_ratio_target: number | null;
          id: string;
          last_milestone_date: string | null;
          monthly_expense_target: number | null;
          monthly_income_target: number | null;
          monthly_policies_target: number | null;
          persistency_13_month_target: number | null;
          persistency_25_month_target: number | null;
          quarterly_income_target: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          achievements?: Json | null;
          annual_income_target?: number | null;
          annual_policies_target?: number | null;
          avg_premium_target?: number | null;
          created_at?: string | null;
          expense_ratio_target?: number | null;
          id?: string;
          last_milestone_date?: string | null;
          monthly_expense_target?: number | null;
          monthly_income_target?: number | null;
          monthly_policies_target?: number | null;
          persistency_13_month_target?: number | null;
          persistency_25_month_target?: number | null;
          quarterly_income_target?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          achievements?: Json | null;
          annual_income_target?: number | null;
          annual_policies_target?: number | null;
          avg_premium_target?: number | null;
          created_at?: string | null;
          expense_ratio_target?: number | null;
          id?: string;
          last_milestone_date?: string | null;
          monthly_expense_target?: number | null;
          monthly_income_target?: number | null;
          monthly_policies_target?: number | null;
          persistency_13_month_target?: number | null;
          persistency_25_month_target?: number | null;
          quarterly_income_target?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      uw_wizard_usage: {
        Row: {
          billing_period_end: string;
          billing_period_start: string;
          created_at: string | null;
          id: string;
          imo_id: string;
          last_run_at: string | null;
          runs_limit: number;
          runs_used: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          billing_period_end: string;
          billing_period_start: string;
          created_at?: string | null;
          id?: string;
          imo_id: string;
          last_run_at?: string | null;
          runs_limit: number;
          runs_used?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          billing_period_end?: string;
          billing_period_start?: string;
          created_at?: string | null;
          id?: string;
          imo_id?: string;
          last_run_at?: string | null;
          runs_limit?: number;
          runs_used?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "uw_wizard_usage_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "uw_wizard_usage_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "uw_wizard_usage_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "uw_wizard_usage_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      uw_wizard_usage_log: {
        Row: {
          created_at: string | null;
          estimated_cost_cents: number | null;
          id: string;
          imo_id: string;
          input_tokens: number | null;
          output_tokens: number | null;
          run_key: string | null;
          session_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          estimated_cost_cents?: number | null;
          id?: string;
          imo_id: string;
          input_tokens?: number | null;
          output_tokens?: number | null;
          run_key?: string | null;
          session_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          estimated_cost_cents?: number | null;
          id?: string;
          imo_id?: string;
          input_tokens?: number | null;
          output_tokens?: number | null;
          run_key?: string | null;
          session_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "uw_wizard_usage_log_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "uw_wizard_usage_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "uw_wizard_usage_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "uw_wizard_usage_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_actions: {
        Row: {
          action_order: number;
          action_type: string;
          conditions: Json | null;
          config: Json;
          created_at: string | null;
          delay_minutes: number | null;
          id: string;
          max_retries: number | null;
          retry_on_failure: boolean | null;
          updated_at: string | null;
          workflow_id: string;
        };
        Insert: {
          action_order: number;
          action_type: string;
          conditions?: Json | null;
          config?: Json;
          created_at?: string | null;
          delay_minutes?: number | null;
          id?: string;
          max_retries?: number | null;
          retry_on_failure?: boolean | null;
          updated_at?: string | null;
          workflow_id: string;
        };
        Update: {
          action_order?: number;
          action_type?: string;
          conditions?: Json | null;
          config?: Json;
          created_at?: string | null;
          delay_minutes?: number | null;
          id?: string;
          max_retries?: number | null;
          retry_on_failure?: boolean | null;
          updated_at?: string | null;
          workflow_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_actions_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_email_tracking: {
        Row: {
          date: string | null;
          error_message: string | null;
          id: string;
          recipient_email: string;
          recipient_type: string;
          sent_at: string | null;
          success: boolean | null;
          user_id: string | null;
          workflow_id: string | null;
        };
        Insert: {
          date?: string | null;
          error_message?: string | null;
          id?: string;
          recipient_email: string;
          recipient_type: string;
          sent_at?: string | null;
          success?: boolean | null;
          user_id?: string | null;
          workflow_id?: string | null;
        };
        Update: {
          date?: string | null;
          error_message?: string | null;
          id?: string;
          recipient_email?: string;
          recipient_type?: string;
          sent_at?: string | null;
          success?: boolean | null;
          user_id?: string | null;
          workflow_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_email_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_email_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_email_tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_email_tracking_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_events: {
        Row: {
          context: Json | null;
          created_at: string | null;
          event_name: string;
          fired_at: string | null;
          id: string;
          workflows_triggered: number | null;
        };
        Insert: {
          context?: Json | null;
          created_at?: string | null;
          event_name: string;
          fired_at?: string | null;
          id?: string;
          workflows_triggered?: number | null;
        };
        Update: {
          context?: Json | null;
          created_at?: string | null;
          event_name?: string;
          fired_at?: string | null;
          id?: string;
          workflows_triggered?: number | null;
        };
        Relationships: [];
      };
      workflow_rate_limits: {
        Row: {
          created_at: string | null;
          daily_email_limit: number | null;
          daily_workflow_runs_limit: number | null;
          id: string;
          is_unlimited: boolean | null;
          max_recipients_per_action: number | null;
          per_recipient_daily_limit: number | null;
          per_workflow_hourly_limit: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          daily_email_limit?: number | null;
          daily_workflow_runs_limit?: number | null;
          id?: string;
          is_unlimited?: boolean | null;
          max_recipients_per_action?: number | null;
          per_recipient_daily_limit?: number | null;
          per_workflow_hourly_limit?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          daily_email_limit?: number | null;
          daily_workflow_runs_limit?: number | null;
          id?: string;
          is_unlimited?: boolean | null;
          max_recipients_per_action?: number | null;
          per_recipient_daily_limit?: number | null;
          per_workflow_hourly_limit?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_rate_limits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_rate_limits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_rate_limits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_runs: {
        Row: {
          actions_completed: number | null;
          actions_executed: Json | null;
          actions_failed: number | null;
          completed_at: string | null;
          context: Json | null;
          created_at: string | null;
          duration_ms: number | null;
          emails_sent: number | null;
          error: string | null;
          error_details: Json | null;
          error_message: string | null;
          id: string;
          started_at: string | null;
          status: string;
          trigger_source: string | null;
          workflow_id: string;
        };
        Insert: {
          actions_completed?: number | null;
          actions_executed?: Json | null;
          actions_failed?: number | null;
          completed_at?: string | null;
          context?: Json | null;
          created_at?: string | null;
          duration_ms?: number | null;
          emails_sent?: number | null;
          error?: string | null;
          error_details?: Json | null;
          error_message?: string | null;
          id?: string;
          started_at?: string | null;
          status?: string;
          trigger_source?: string | null;
          workflow_id: string;
        };
        Update: {
          actions_completed?: number | null;
          actions_executed?: Json | null;
          actions_failed?: number | null;
          completed_at?: string | null;
          context?: Json | null;
          created_at?: string | null;
          duration_ms?: number | null;
          emails_sent?: number | null;
          error?: string | null;
          error_details?: Json | null;
          error_message?: string | null;
          id?: string;
          started_at?: string | null;
          status?: string;
          trigger_source?: string | null;
          workflow_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_templates: {
        Row: {
          category: string;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          icon: string | null;
          id: string;
          is_featured: boolean | null;
          is_public: boolean | null;
          name: string;
          rating: number | null;
          updated_at: string | null;
          usage_count: number | null;
          workflow_config: Json;
        };
        Insert: {
          category: string;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_featured?: boolean | null;
          is_public?: boolean | null;
          name: string;
          rating?: number | null;
          updated_at?: string | null;
          usage_count?: number | null;
          workflow_config: Json;
        };
        Update: {
          category?: string;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_featured?: boolean | null;
          is_public?: boolean | null;
          name?: string;
          rating?: number | null;
          updated_at?: string | null;
          usage_count?: number | null;
          workflow_config?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_triggers: {
        Row: {
          created_at: string | null;
          event_config: Json | null;
          id: string;
          is_active: boolean | null;
          last_triggered_at: string | null;
          next_trigger_at: string | null;
          schedule_config: Json | null;
          trigger_type: string;
          updated_at: string | null;
          webhook_config: Json | null;
          workflow_id: string;
        };
        Insert: {
          created_at?: string | null;
          event_config?: Json | null;
          id?: string;
          is_active?: boolean | null;
          last_triggered_at?: string | null;
          next_trigger_at?: string | null;
          schedule_config?: Json | null;
          trigger_type: string;
          updated_at?: string | null;
          webhook_config?: Json | null;
          workflow_id: string;
        };
        Update: {
          created_at?: string | null;
          event_config?: Json | null;
          id?: string;
          is_active?: boolean | null;
          last_triggered_at?: string | null;
          next_trigger_at?: string | null;
          schedule_config?: Json | null;
          trigger_type?: string;
          updated_at?: string | null;
          webhook_config?: Json | null;
          workflow_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_triggers_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };
      workflows: {
        Row: {
          actions: Json;
          category: string | null;
          conditions: Json | null;
          config: Json;
          cooldown_minutes: number | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          imo_id: string | null;
          is_org_template: boolean;
          last_modified_by: string | null;
          max_runs_per_day: number | null;
          max_runs_per_recipient: number | null;
          name: string;
          priority: number | null;
          status: string | null;
          trigger_type: string;
          updated_at: string | null;
        };
        Insert: {
          actions?: Json;
          category?: string | null;
          conditions?: Json | null;
          config?: Json;
          cooldown_minutes?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          imo_id?: string | null;
          is_org_template?: boolean;
          last_modified_by?: string | null;
          max_runs_per_day?: number | null;
          max_runs_per_recipient?: number | null;
          name: string;
          priority?: number | null;
          status?: string | null;
          trigger_type: string;
          updated_at?: string | null;
        };
        Update: {
          actions?: Json;
          category?: string | null;
          conditions?: Json | null;
          config?: Json;
          cooldown_minutes?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          imo_id?: string | null;
          is_org_template?: boolean;
          last_modified_by?: string | null;
          max_runs_per_day?: number | null;
          max_runs_per_recipient?: number | null;
          name?: string;
          priority?: number | null;
          status?: string | null;
          trigger_type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workflows_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflows_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflows_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflows_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflows_last_modified_by_fkey";
            columns: ["last_modified_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflows_last_modified_by_fkey";
            columns: ["last_modified_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflows_last_modified_by_fkey";
            columns: ["last_modified_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      writing_number_history: {
        Row: {
          agent_id: string;
          carrier_id: string;
          change_notes: string | null;
          change_type: string;
          changed_by: string | null;
          created_at: string | null;
          effective_date: string | null;
          id: string;
          status: string;
          termination_date: string | null;
          writing_number: string;
          writing_number_id: string;
        };
        Insert: {
          agent_id: string;
          carrier_id: string;
          change_notes?: string | null;
          change_type: string;
          changed_by?: string | null;
          created_at?: string | null;
          effective_date?: string | null;
          id?: string;
          status: string;
          termination_date?: string | null;
          writing_number: string;
          writing_number_id: string;
        };
        Update: {
          agent_id?: string;
          carrier_id?: string;
          change_notes?: string | null;
          change_type?: string;
          changed_by?: string | null;
          created_at?: string | null;
          effective_date?: string | null;
          id?: string;
          status?: string;
          termination_date?: string | null;
          writing_number?: string;
          writing_number_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "writing_number_history_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "writing_number_history_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "writing_number_history_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "writing_number_history_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "writing_number_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "writing_number_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "writing_number_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "writing_number_history_writing_number_id_fkey";
            columns: ["writing_number_id"];
            isOneToOne: false;
            referencedRelation: "agent_writing_numbers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      active_user_profiles: {
        Row: {
          agent_status: Database["public"]["Enums"]["agent_status"] | null;
          approval_status: string | null;
          approved_at: string | null;
          approved_by: string | null;
          archive_reason: string | null;
          archived_at: string | null;
          archived_by: string | null;
          city: string | null;
          contract_level: number | null;
          created_at: string | null;
          current_onboarding_phase: string | null;
          custom_permissions: Json | null;
          date_of_birth: string | null;
          denial_reason: string | null;
          denied_at: string | null;
          email: string | null;
          facebook_handle: string | null;
          first_name: string | null;
          hierarchy_depth: number | null;
          hierarchy_path: string | null;
          id: string | null;
          instagram_url: string | null;
          instagram_username: string | null;
          is_admin: boolean | null;
          last_name: string | null;
          license_expiration: string | null;
          license_number: string | null;
          licensing_info: Json | null;
          npn: string | null;
          onboarding_completed_at: string | null;
          onboarding_started_at: string | null;
          onboarding_status: string | null;
          personal_website: string | null;
          phone: string | null;
          pipeline_template_id: string | null;
          profile_photo_url: string | null;
          recruiter_id: string | null;
          referral_source: string | null;
          resident_state: string | null;
          roles: string[] | null;
          state: string | null;
          street_address: string | null;
          updated_at: string | null;
          upline_id: string | null;
          zip: string | null;
        };
        Insert: {
          agent_status?: Database["public"]["Enums"]["agent_status"] | null;
          approval_status?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          archive_reason?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          city?: string | null;
          contract_level?: number | null;
          created_at?: string | null;
          current_onboarding_phase?: string | null;
          custom_permissions?: Json | null;
          date_of_birth?: string | null;
          denial_reason?: string | null;
          denied_at?: string | null;
          email?: string | null;
          facebook_handle?: string | null;
          first_name?: string | null;
          hierarchy_depth?: number | null;
          hierarchy_path?: string | null;
          id?: string | null;
          instagram_url?: string | null;
          instagram_username?: string | null;
          is_admin?: boolean | null;
          last_name?: string | null;
          license_expiration?: string | null;
          license_number?: string | null;
          licensing_info?: Json | null;
          npn?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_started_at?: string | null;
          onboarding_status?: string | null;
          personal_website?: string | null;
          phone?: string | null;
          pipeline_template_id?: string | null;
          profile_photo_url?: string | null;
          recruiter_id?: string | null;
          referral_source?: string | null;
          resident_state?: string | null;
          roles?: string[] | null;
          state?: string | null;
          street_address?: string | null;
          updated_at?: string | null;
          upline_id?: string | null;
          zip?: string | null;
        };
        Update: {
          agent_status?: Database["public"]["Enums"]["agent_status"] | null;
          approval_status?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          archive_reason?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          city?: string | null;
          contract_level?: number | null;
          created_at?: string | null;
          current_onboarding_phase?: string | null;
          custom_permissions?: Json | null;
          date_of_birth?: string | null;
          denial_reason?: string | null;
          denied_at?: string | null;
          email?: string | null;
          facebook_handle?: string | null;
          first_name?: string | null;
          hierarchy_depth?: number | null;
          hierarchy_path?: string | null;
          id?: string | null;
          instagram_url?: string | null;
          instagram_username?: string | null;
          is_admin?: boolean | null;
          last_name?: string | null;
          license_expiration?: string | null;
          license_number?: string | null;
          licensing_info?: Json | null;
          npn?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_started_at?: string | null;
          onboarding_status?: string | null;
          personal_website?: string | null;
          phone?: string | null;
          pipeline_template_id?: string | null;
          profile_photo_url?: string | null;
          recruiter_id?: string | null;
          referral_source?: string | null;
          resident_state?: string | null;
          roles?: string[] | null;
          state?: string | null;
          street_address?: string | null;
          updated_at?: string | null;
          upline_id?: string | null;
          zip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_pipeline_template_id_fkey";
            columns: ["pipeline_template_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_chargeback_summary: {
        Row: {
          at_risk_amount: number | null;
          chargeback_rate_percentage: number | null;
          charged_back_count: number | null;
          high_risk_count: number | null;
          total_advances: number | null;
          total_chargeback_amount: number | null;
          total_chargebacks: number | null;
          total_earned: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      commission_earning_detail: {
        Row: {
          advance_amount: number | null;
          advance_months: number | null;
          annual_premium: number | null;
          chargeback_amount: number | null;
          chargeback_risk_level: string | null;
          commission_id: string | null;
          earned_amount: number | null;
          effective_date: string | null;
          is_fully_earned: boolean | null;
          monthly_earning_rate: number | null;
          months_paid: number | null;
          months_remaining: number | null;
          policy_id: string | null;
          policy_status: string | null;
          status: string | null;
          unearned_amount: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commissions_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: false;
            referencedRelation: "policies";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_earning_status: {
        Row: {
          advance_amount: number | null;
          advance_months: number | null;
          chargeback_amount: number | null;
          chargeback_date: string | null;
          chargeback_reason: string | null;
          chargeback_risk: string | null;
          created_at: string | null;
          earned_amount: number | null;
          id: string | null;
          is_fully_earned: boolean | null;
          last_payment_date: string | null;
          monthly_earning_rate: number | null;
          months_paid: number | null;
          months_remaining: number | null;
          percentage_earned: number | null;
          policy_id: string | null;
          status: string | null;
          type: string | null;
          unearned_amount: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          advance_amount?: number | null;
          advance_months?: number | null;
          chargeback_amount?: number | null;
          chargeback_date?: string | null;
          chargeback_reason?: string | null;
          chargeback_risk?: never;
          created_at?: string | null;
          earned_amount?: number | null;
          id?: string | null;
          is_fully_earned?: never;
          last_payment_date?: string | null;
          monthly_earning_rate?: never;
          months_paid?: number | null;
          months_remaining?: never;
          percentage_earned?: never;
          policy_id?: string | null;
          status?: string | null;
          type?: string | null;
          unearned_amount?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          advance_amount?: number | null;
          advance_months?: number | null;
          chargeback_amount?: number | null;
          chargeback_date?: string | null;
          chargeback_reason?: string | null;
          chargeback_risk?: never;
          created_at?: string | null;
          earned_amount?: number | null;
          id?: string | null;
          is_fully_earned?: never;
          last_payment_date?: string | null;
          monthly_earning_rate?: never;
          months_paid?: number | null;
          months_remaining?: never;
          percentage_earned?: never;
          policy_id?: string | null;
          status?: string | null;
          type?: string | null;
          unearned_amount?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commissions_policy_id_fkey";
            columns: ["policy_id"];
            isOneToOne: false;
            referencedRelation: "policies";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_earning_summary: {
        Row: {
          at_risk_count: number | null;
          avg_months_paid: number | null;
          fully_earned_count: number | null;
          portfolio_earned_percentage: number | null;
          total_advances: number | null;
          total_chargebacks: number | null;
          total_commissions: number | null;
          total_earned: number | null;
          total_unearned: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      message_templates: {
        Row: {
          category: string | null;
          content: string | null;
          created_at: string | null;
          created_by: string | null;
          id: string | null;
          imo_id: string | null;
          is_active: boolean | null;
          last_used_at: string | null;
          message_stage: string | null;
          name: string | null;
          platform: string | null;
          updated_at: string | null;
          use_count: number | null;
          user_id: string | null;
        };
        Insert: {
          category?: string | null;
          content?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string | null;
          imo_id?: string | null;
          is_active?: boolean | null;
          last_used_at?: string | null;
          message_stage?: string | null;
          name?: string | null;
          platform?: string | null;
          updated_at?: string | null;
          use_count?: number | null;
          user_id?: string | null;
        };
        Update: {
          category?: string | null;
          content?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string | null;
          imo_id?: string | null;
          is_active?: boolean | null;
          last_used_at?: string | null;
          message_stage?: string | null;
          name?: string | null;
          platform?: string | null;
          updated_at?: string | null;
          use_count?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "instagram_message_templates_imo_id_fkey";
            columns: ["imo_id"];
            isOneToOne: false;
            referencedRelation: "imos";
            referencedColumns: ["id"];
          },
        ];
      };
      mv_carrier_performance: {
        Row: {
          active_policies: number | null;
          avg_commission_amount: number | null;
          avg_commission_rate_pct: number | null;
          avg_premium: number | null;
          cancelled_policies: number | null;
          carrier_id: string | null;
          carrier_name: string | null;
          commission_count: number | null;
          lapsed_policies: number | null;
          persistency_rate: number | null;
          total_commission_amount: number | null;
          total_policies: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "policies_carrier_id_fkey";
            columns: ["carrier_id"];
            isOneToOne: false;
            referencedRelation: "carriers";
            referencedColumns: ["id"];
          },
        ];
      };
      mv_client_ltv: {
        Row: {
          active_policies: number | null;
          active_premium: number | null;
          avg_commission_per_policy: number | null;
          avg_policy_age_months: number | null;
          avg_premium_per_policy: number | null;
          cancelled_policies: number | null;
          client_id: string | null;
          client_name: string | null;
          client_tier: string | null;
          cross_sell_opportunity: boolean | null;
          email: string | null;
          first_policy_date: string | null;
          lapsed_policies: number | null;
          latest_policy_date: string | null;
          paid_commission: number | null;
          total_commission: number | null;
          total_policies: number | null;
          total_premium: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "policies_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      mv_cohort_retention: {
        Row: {
          active_premium: number | null;
          cancelled_count: number | null;
          cohort_month: string | null;
          cohort_size: number | null;
          lapsed_count: number | null;
          months_since_issue: number | null;
          retention_rate: number | null;
          still_active: number | null;
          total_premium: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      mv_commission_aging: {
        Row: {
          aging_bucket: string | null;
          avg_at_risk: number | null;
          bucket_order: number | null;
          commission_count: number | null;
          policy_count: number | null;
          risk_level: string | null;
          total_at_risk: number | null;
          total_commission: number | null;
          total_earned: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      mv_daily_production: {
        Row: {
          active_policies: number | null;
          avg_premium: number | null;
          cancelled_policies: number | null;
          lapsed_policies: number | null;
          max_premium: number | null;
          min_premium: number | null;
          production_date: string | null;
          total_policies: number | null;
          total_premium: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      mv_expense_summary: {
        Row: {
          avg_amount: number | null;
          category: string | null;
          expense_month: string | null;
          expense_type: Database["public"]["Enums"]["expense_type"] | null;
          max_amount: number | null;
          min_amount: number | null;
          recurring_amount: number | null;
          recurring_count: number | null;
          total_amount: number | null;
          transaction_count: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      mv_product_performance: {
        Row: {
          active_policies: number | null;
          avg_commission: number | null;
          avg_commission_rate_pct: number | null;
          avg_premium: number | null;
          lapsed_policies: number | null;
          persistency_rate: number | null;
          product_id: string | null;
          product_name: string | null;
          product_type: Database["public"]["Enums"]["product_type"] | null;
          total_commission: number | null;
          total_policies: number | null;
          total_premium: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "policies_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      mv_production_velocity: {
        Row: {
          month_start: string | null;
          monthly_avg_premium: number | null;
          monthly_policies: number | null;
          monthly_premium: number | null;
          user_id: string | null;
          week_start: string | null;
          weekly_avg_premium: number | null;
          weekly_policies: number | null;
          weekly_premium: number | null;
        };
        Relationships: [];
      };
      override_commission_summary: {
        Row: {
          charged_back_amount: number | null;
          earned_amount: number | null;
          override_agent_id: string | null;
          paid_amount: number | null;
          pending_amount: number | null;
          total_earned: number | null;
          total_override_amount: number | null;
          total_overrides: number | null;
          total_unearned: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "override_commissions_override_agent_id_fkey";
            columns: ["override_agent_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_override_agent_id_fkey";
            columns: ["override_agent_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_commissions_override_agent_id_fkey";
            columns: ["override_agent_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      unearned_commission_summary: {
        Row: {
          at_risk_count: number | null;
          avg_months_paid: number | null;
          fully_earned_count: number | null;
          portfolio_earned_percentage: number | null;
          total_advances: number | null;
          total_chargebacks: number | null;
          total_commissions: number | null;
          total_earned: number | null;
          total_unearned: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      user_management_view: {
        Row: {
          agent_status: Database["public"]["Enums"]["agent_status"] | null;
          approval_status: string | null;
          approved_at: string | null;
          approved_by: string | null;
          archive_reason: string | null;
          archived_at: string | null;
          archived_by: string | null;
          city: string | null;
          contract_level: number | null;
          created_at: string | null;
          current_onboarding_phase: string | null;
          custom_permissions: Json | null;
          date_of_birth: string | null;
          denial_reason: string | null;
          denied_at: string | null;
          email: string | null;
          facebook_handle: string | null;
          first_name: string | null;
          hierarchy_depth: number | null;
          hierarchy_path: string | null;
          id: string | null;
          in_recruiting_pipeline: boolean | null;
          in_users_list: boolean | null;
          instagram_url: string | null;
          instagram_username: string | null;
          is_admin: boolean | null;
          is_super_admin: boolean | null;
          last_name: string | null;
          license_expiration: string | null;
          license_number: string | null;
          licensing_info: Json | null;
          npn: string | null;
          onboarding_completed_at: string | null;
          onboarding_started_at: string | null;
          onboarding_status: string | null;
          personal_website: string | null;
          phone: string | null;
          pipeline_template_id: string | null;
          primary_role: string | null;
          profile_photo_url: string | null;
          recruiter_id: string | null;
          referral_source: string | null;
          resident_state: string | null;
          roles: string[] | null;
          state: string | null;
          street_address: string | null;
          updated_at: string | null;
          upline_id: string | null;
          zip: string | null;
        };
        Insert: {
          agent_status?: Database["public"]["Enums"]["agent_status"] | null;
          approval_status?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          archive_reason?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          city?: string | null;
          contract_level?: number | null;
          created_at?: string | null;
          current_onboarding_phase?: string | null;
          custom_permissions?: Json | null;
          date_of_birth?: string | null;
          denial_reason?: string | null;
          denied_at?: string | null;
          email?: string | null;
          facebook_handle?: string | null;
          first_name?: string | null;
          hierarchy_depth?: number | null;
          hierarchy_path?: string | null;
          id?: string | null;
          in_recruiting_pipeline?: never;
          in_users_list?: never;
          instagram_url?: string | null;
          instagram_username?: string | null;
          is_admin?: boolean | null;
          is_super_admin?: boolean | null;
          last_name?: string | null;
          license_expiration?: string | null;
          license_number?: string | null;
          licensing_info?: Json | null;
          npn?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_started_at?: string | null;
          onboarding_status?: string | null;
          personal_website?: string | null;
          phone?: string | null;
          pipeline_template_id?: string | null;
          primary_role?: never;
          profile_photo_url?: string | null;
          recruiter_id?: string | null;
          referral_source?: string | null;
          resident_state?: string | null;
          roles?: string[] | null;
          state?: string | null;
          street_address?: string | null;
          updated_at?: string | null;
          upline_id?: string | null;
          zip?: string | null;
        };
        Update: {
          agent_status?: Database["public"]["Enums"]["agent_status"] | null;
          approval_status?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          archive_reason?: string | null;
          archived_at?: string | null;
          archived_by?: string | null;
          city?: string | null;
          contract_level?: number | null;
          created_at?: string | null;
          current_onboarding_phase?: string | null;
          custom_permissions?: Json | null;
          date_of_birth?: string | null;
          denial_reason?: string | null;
          denied_at?: string | null;
          email?: string | null;
          facebook_handle?: string | null;
          first_name?: string | null;
          hierarchy_depth?: number | null;
          hierarchy_path?: string | null;
          id?: string | null;
          in_recruiting_pipeline?: never;
          in_users_list?: never;
          instagram_url?: string | null;
          instagram_username?: string | null;
          is_admin?: boolean | null;
          is_super_admin?: boolean | null;
          last_name?: string | null;
          license_expiration?: string | null;
          license_number?: string | null;
          licensing_info?: Json | null;
          npn?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_started_at?: string | null;
          onboarding_status?: string | null;
          personal_website?: string | null;
          phone?: string | null;
          pipeline_template_id?: string | null;
          primary_role?: never;
          profile_photo_url?: string | null;
          recruiter_id?: string | null;
          referral_source?: string | null;
          resident_state?: string | null;
          roles?: string[] | null;
          state?: string | null;
          street_address?: string | null;
          updated_at?: string | null;
          upline_id?: string | null;
          zip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_pipeline_template_id_fkey";
            columns: ["pipeline_template_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_recruiter_id_fkey";
            columns: ["recruiter_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "active_user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "user_management_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_upline_id_fkey";
            columns: ["upline_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      accept_recruiting_lead: {
        Args: { p_lead_id: string; p_pipeline_template_id?: string };
        Returns: Json;
      };
      add_to_read_by: {
        Args: { message_id: string; user_id: string };
        Returns: undefined;
      };
      admin_approve_user: {
        Args: { approver_id: string; target_user_id: string };
        Returns: boolean;
      };
      admin_delete_domain: {
        Args: { p_domain_id: string; p_user_id: string };
        Returns: boolean;
      };
      admin_deleteuser: { Args: { target_user_id: string }; Returns: Json };
      admin_deny_user: {
        Args: { approver_id: string; reason: string; target_user_id: string };
        Returns: boolean;
      };
      admin_get_allusers: {
        Args: never;
        Returns: {
          approval_status: string;
          approved_at: string;
          approved_by: string;
          city: string;
          contract_level: number;
          created_at: string;
          current_onboarding_phase: string;
          denial_reason: string;
          denied_at: string;
          email: string;
          first_name: string;
          full_name: string;
          hierarchy_depth: number;
          hierarchy_path: string;
          id: string;
          instagram_url: string;
          is_admin: boolean;
          last_name: string;
          license_expiration: string;
          license_number: string;
          npn: string;
          onboarding_status: string;
          phone: string;
          resident_state: string;
          roles: string[];
          state: string;
          street_address: string;
          updated_at: string;
          upline_id: string;
          zip: string;
        }[];
      };
      admin_get_pending_users: {
        Args: never;
        Returns: {
          approval_status: string;
          approved_at: string;
          approved_by: string;
          contract_level: number;
          created_at: string;
          denial_reason: string;
          denied_at: string;
          email: string;
          full_name: string;
          hierarchy_depth: number;
          hierarchy_path: string;
          id: string;
          is_admin: boolean;
          roles: string[];
          updated_at: string;
          upline_id: string;
        }[];
      };
      admin_get_user_profile: {
        Args: { target_user_id: string };
        Returns: {
          approval_status: string;
          approved_at: string;
          approved_by: string;
          contract_level: number;
          created_at: string;
          denial_reason: string;
          denied_at: string;
          email: string;
          full_name: string;
          hierarchy_depth: number;
          hierarchy_path: string;
          id: string;
          is_admin: boolean;
          roles: string[];
          updated_at: string;
          upline_id: string;
        }[];
      };
      admin_set_admin_role: {
        Args: { new_is_admin: boolean; target_user_id: string };
        Returns: boolean;
      };
      admin_set_pending_user: {
        Args: { target_user_id: string };
        Returns: boolean;
      };
      admin_update_domain_status: {
        Args: {
          p_domain_id: string;
          p_last_error?: string;
          p_new_status: Database["public"]["Enums"]["custom_domain_status"];
          p_provider_domain_id?: string;
          p_provider_metadata?: Json;
          p_user_id: string;
          p_verified_at?: string;
        };
        Returns: {
          created_at: string;
          hostname: string;
          id: string;
          imo_id: string;
          last_error: string | null;
          provider: string;
          provider_domain_id: string | null;
          provider_metadata: Json | null;
          status: Database["public"]["Enums"]["custom_domain_status"];
          updated_at: string;
          user_id: string;
          verification_token: string;
          verified_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "custom_domains";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      advance_recruit_phase: {
        Args: { p_current_phase_id: string; p_user_id: string };
        Returns: Json;
      };
      approve_acceptance_rule: {
        Args: { p_notes?: string; p_rule_id: string };
        Returns: undefined;
      };
      approve_agency_request: {
        Args: { p_request_id: string };
        Returns: string;
      };
      approve_join_request: {
        Args: {
          p_agency_id?: string;
          p_request_id: string;
          p_upline_id?: string;
        };
        Returns: undefined;
      };
      approve_underwriting_rule_set: {
        Args: { p_notes?: string; p_rule_set_id: string };
        Returns: Json;
      };
      assert_uw_wizard_usage_access: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      avg_lead_heat_score: {
        Args: { p_user_id: string };
        Returns: {
          avg_score: number;
        }[];
      };
      build_agency_org_chart: {
        Args: {
          p_agency_id: string;
          p_include_metrics: boolean;
          p_max_depth: number;
        };
        Returns: Json;
      };
      build_agent_downline_tree: {
        Args: {
          p_agent_id: string;
          p_include_metrics: boolean;
          p_max_depth: number;
        };
        Returns: Json;
      };
      build_agent_org_chart: {
        Args: {
          p_agent_id: string;
          p_include_metrics: boolean;
          p_max_depth: number;
        };
        Returns: Json;
      };
      build_imo_org_chart: {
        Args: {
          p_imo_id: string;
          p_include_metrics: boolean;
          p_max_depth: number;
        };
        Returns: Json;
      };
      calculate_chargeback_on_policy_lapse: {
        Args: { p_lapse_date?: string; p_policy_id: string };
        Returns: Json;
      };
      calculate_commission_advance: {
        Args: {
          p_advance_months: number;
          p_annual_premium: number;
          p_commission_percentage: number;
          p_contract_level?: number;
        };
        Returns: number;
      };
      calculate_earned_amount: {
        Args: {
          p_advance_months: number;
          p_amount: number;
          p_months_paid: number;
        };
        Returns: number;
      };
      calculate_months_paid: {
        Args: { p_effective_date: string; p_end_date?: string };
        Returns: number;
      };
      calculate_next_delivery: {
        Args: {
          p_day_of_month: number;
          p_day_of_week: number;
          p_frequency: Database["public"]["Enums"]["report_frequency"];
          p_from_date?: string;
          p_preferred_time: string;
        };
        Returns: string;
      };
      can_clone_close_item_to: {
        Args: { p_target_user_id: string };
        Returns: boolean;
      };
      can_manage_workflows: {
        Args: { user_id_param: string };
        Returns: boolean;
      };
      can_request_agency: { Args: never; Returns: boolean };
      can_run_uw_wizard: {
        Args: { p_user_id: string };
        Returns: {
          allowed: boolean;
          reason: string;
          runs_remaining: number;
          source: string;
          tier_id: string;
        }[];
      };
      can_submit_join_request: { Args: never; Returns: boolean };
      can_view_agent_details: {
        Args: { p_agent_id: string };
        Returns: boolean;
      };
      can_workflow_run: {
        Args: { p_recipient_id?: string; p_workflow_id: string };
        Returns: boolean;
      };
      cancel_recruit_invitation: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      cascade_agency_assignment: {
        Args: { p_agency_id: string; p_imo_id: string; p_owner_id: string };
        Returns: Json;
      };
      check_and_auto_advance_phase: {
        Args: { p_checklist_item_id: string; p_user_id: string };
        Returns: Json;
      };
      check_and_update_milestones: {
        Args: { p_log_id: string; p_policy_count: number; p_total_ap: number };
        Returns: {
          new_ap_milestone: number;
          new_policy_milestone: number;
          should_send_sms: boolean;
        }[];
      };
      check_auth_identity: {
        Args: { check_email: string };
        Returns: {
          created_at: string;
          email: string;
          id: string;
          provider: string;
          user_id: string;
        }[];
      };
      check_email_exists: {
        Args: { target_email: string };
        Returns: {
          email_exists: boolean;
          error_message: string;
          user_id: string;
        }[];
      };
      check_email_quota: {
        Args: { p_limit?: number; p_provider: string; p_user_id: string };
        Returns: boolean;
      };
      check_first_seller_naming_unified: {
        Args: { p_user_id: string };
        Returns: {
          agency_name: string;
          channel_names: string[];
          first_sale_group_id: string;
          has_pending_notification: boolean;
          log_date: string;
          needs_naming: boolean;
          representative_log_id: string;
          total_channels: number;
        }[];
      };
      check_is_imo_admin: { Args: never; Returns: boolean };
      check_pending_invitation_exists: {
        Args: { p_email: string; p_inviter_id: string };
        Returns: boolean;
      };
      check_team_size_limit: { Args: { p_user_id: string }; Returns: Json };
      check_user_template_limit: {
        Args: { user_uuid: string };
        Returns: boolean;
      };
      check_workflow_email_rate_limit: {
        Args: {
          p_recipient_count?: number;
          p_recipient_email: string;
          p_user_id: string;
          p_workflow_id: string;
        };
        Returns: Json;
      };
      claim_instagram_jobs: {
        Args: {
          p_job_types: Database["public"]["Enums"]["instagram_job_type"][];
          p_limit?: number;
        };
        Returns: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          id: string;
          integration_id: string | null;
          job_type: Database["public"]["Enums"]["instagram_job_type"];
          last_error: string | null;
          max_attempts: number;
          payload: Json;
          priority: number;
          scheduled_for: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["instagram_job_status"];
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "instagram_job_queue";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      cleanup_expired_evaluation_logs: { Args: never; Returns: number };
      cleanup_expired_invitations: { Args: never; Returns: number };
      cleanup_instagram_jobs: {
        Args: { p_older_than?: string };
        Returns: number;
      };
      cleanup_old_audit_logs: {
        Args: never;
        Returns: {
          deleted_financial: number;
          deleted_non_financial: number;
          total_deleted: number;
        }[];
      };
      cleanup_old_reports: {
        Args: { max_reports_per_user?: number };
        Returns: number;
      };
      clone_org_template: {
        Args: { p_new_name: string; p_template_id: string };
        Returns: string;
      };
      clone_pipeline_template: {
        Args: { p_new_name: string; p_template_id: string };
        Returns: string;
      };
      complete_instagram_job: {
        Args: { p_job_id: string; p_result?: Json };
        Returns: undefined;
      };
      complete_scheduled_delivery: {
        Args: {
          p_delivery_id: string;
          p_error_message?: string;
          p_mailgun_message_id?: string;
          p_schedule_id: string;
          p_success: boolean;
        };
        Returns: boolean;
      };
      complete_training_lesson: {
        Args: { p_lesson_id: string; p_time_spent_seconds: number };
        Returns: Json;
      };
      create_alert_notification_safe: {
        Args: {
          p_comparison: string;
          p_current_value: number;
          p_entity_id?: string;
          p_entity_type?: string;
          p_message: string;
          p_metric: string;
          p_rule_id: string;
          p_threshold_value: number;
          p_title: string;
          p_type: string;
          p_user_id: string;
        };
        Returns: string;
      };
      create_alert_rule: {
        Args: {
          p_applies_to_downlines?: boolean;
          p_applies_to_self?: boolean;
          p_applies_to_team?: boolean;
          p_comparison?: Database["public"]["Enums"]["alert_comparison"];
          p_cooldown_hours?: number;
          p_description?: string;
          p_metric?: Database["public"]["Enums"]["alert_metric"];
          p_name: string;
          p_notify_email?: boolean;
          p_notify_in_app?: boolean;
          p_threshold_unit?: string;
          p_threshold_value?: number;
        };
        Returns: {
          agency_id: string | null;
          applies_to_downlines: boolean;
          applies_to_self: boolean;
          applies_to_team: boolean;
          comparison: Database["public"]["Enums"]["alert_comparison"];
          consecutive_triggers: number;
          cooldown_hours: number;
          created_at: string;
          description: string | null;
          id: string;
          imo_id: string | null;
          is_active: boolean;
          last_triggered_at: string | null;
          metric: Database["public"]["Enums"]["alert_metric"];
          name: string;
          notify_email: boolean;
          notify_in_app: boolean;
          owner_id: string;
          threshold_unit: string | null;
          threshold_value: number;
          trigger_count: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "alert_rules";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_default_decision_tree_for_imo: {
        Args: { p_imo_id: string };
        Returns: string;
      };
      create_lead_from_instagram: {
        Args: {
          p_availability?: string;
          p_city?: string;
          p_conversation_id: string;
          p_email: string;
          p_first_name: string;
          p_insurance_experience?: string;
          p_last_name: string;
          p_phone: string;
          p_state?: string;
          p_why_interested?: string;
        };
        Returns: string;
      };
      create_lead_purchase_with_expense: {
        Args: {
          p_commission_earned?: number;
          p_lead_count: number;
          p_lead_freshness?: Database["public"]["Enums"]["lead_freshness"];
          p_notes?: string;
          p_policies_sold?: number;
          p_purchase_date: string;
          p_purchase_name?: string;
          p_total_cost: number;
          p_vendor_id: string;
        };
        Returns: string;
      };
      create_notification: {
        Args: {
          p_expires_at?: string;
          p_message?: string;
          p_metadata?: Json;
          p_title: string;
          p_type: string;
          p_user_id: string;
        };
        Returns: {
          created_at: string;
          expires_at: string | null;
          id: string;
          message: string | null;
          metadata: Json | null;
          read: boolean;
          title: string;
          type: string;
          updated_at: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "notifications";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_org_workflow_template: {
        Args: {
          p_actions: Json;
          p_category: string;
          p_conditions: Json;
          p_config: Json;
          p_cooldown_minutes?: number;
          p_description: string;
          p_max_runs_per_day?: number;
          p_max_runs_per_recipient?: number;
          p_name: string;
          p_priority?: number;
          p_trigger_type: string;
        };
        Returns: string;
      };
      create_recruit_invitation:
        | {
            Args: {
              p_city?: string;
              p_email: string;
              p_first_name?: string;
              p_last_name?: string;
              p_message?: string;
              p_phone?: string;
              p_state?: string;
              p_upline_id?: string;
            };
            Returns: Json;
          }
        | {
            Args: { p_email: string; p_message?: string; p_recruit_id: string };
            Returns: Json;
          };
      create_scheduled_report: {
        Args: {
          p_day_of_month?: number;
          p_day_of_week?: number;
          p_export_format?: string;
          p_frequency: Database["public"]["Enums"]["report_frequency"];
          p_include_charts?: boolean;
          p_include_insights?: boolean;
          p_include_summary?: boolean;
          p_preferred_time?: string;
          p_recipients?: Json;
          p_report_config?: Json;
          p_report_type: string;
          p_schedule_name: string;
        };
        Returns: string;
      };
      create_workflow_run: {
        Args: { context_param?: Json; workflow_id_param: string };
        Returns: string;
      };
      delete_alert_rule: { Args: { p_rule_id: string }; Returns: boolean };
      delete_lead_purchase_with_expense: {
        Args: { p_purchase_id: string };
        Returns: Json;
      };
      delete_orphan_identity: { Args: { del_email: string }; Returns: Json };
      delete_recruit: { Args: { target_recruit_id: string }; Returns: Json };
      duplicate_training_lesson: {
        Args: { p_lesson_id: string };
        Returns: Json;
      };
      email_subject_hash: { Args: { subject: string }; Returns: string };
      enqueue_instagram_job: {
        Args: {
          p_integration_id?: string;
          p_job_type: Database["public"]["Enums"]["instagram_job_type"];
          p_payload: Json;
          p_priority?: number;
          p_scheduled_for?: string;
        };
        Returns: string;
      };
      ensure_system_labels: { Args: { p_user_id: string }; Returns: undefined };
      expire_instagram_scheduled_messages: { Args: never; Returns: number };
      expire_old_invitations: {
        Args: never;
        Returns: {
          expired_count: number;
        }[];
      };
      fail_instagram_job: {
        Args: { p_error: string; p_job_id: string };
        Returns: undefined;
      };
      generate_age_rules_from_products: {
        Args: {
          p_carrier_id: string;
          p_imo_id: string;
          p_product_ids?: string[];
          p_strategy?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      generate_global_knockout_rules: {
        Args: {
          p_carrier_id: string;
          p_imo_id: string;
          p_knockout_codes?: string[];
          p_strategy?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      get_active_decision_tree: { Args: { p_imo_id: string }; Returns: Json };
      get_active_system_automations: {
        Args: { p_imo_id: string; p_trigger_type: string };
        Returns: {
          communication_type: string;
          email_body_html: string;
          email_subject: string;
          id: string;
          imo_id: string;
          notification_message: string;
          notification_title: string;
          recipients: Json;
          sms_message: string;
          trigger_type: string;
        }[];
      };
      get_agencies_for_join: {
        Args: { p_imo_id: string };
        Returns: {
          code: string;
          description: string;
          id: string;
          name: string;
        }[];
      };
      get_agencies_ip_totals: {
        Args: { p_imo_id: string };
        Returns: {
          agency_id: string;
          agency_name: string;
          mtd_ip: number;
          mtd_policies: number;
          wtd_ip: number;
          wtd_policies: number;
        }[];
      };
      get_agency_dashboard_metrics: {
        Args: { p_agency_id?: string };
        Returns: {
          active_policies: number;
          agency_id: string;
          agency_name: string;
          agent_count: number;
          avg_production_per_agent: number;
          imo_id: string;
          top_producer_id: string;
          top_producer_name: string;
          top_producer_premium: number;
          total_annual_premium: number;
          total_commissions_ytd: number;
          total_earned_ytd: number;
          total_unearned: number;
        }[];
      };
      get_agency_descendants: {
        Args: { p_agency_id: string };
        Returns: {
          agency_id: string;
          agency_name: string;
          depth: number;
          parent_agency_id: string;
        }[];
      };
      get_agency_hierarchy: {
        Args: { p_agency_id: string };
        Returns: {
          agency_id: string;
          agency_name: string;
          depth: number;
          parent_agency_id: string;
        }[];
      };
      get_agency_leaderboard_data: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          agency_id: string;
          agency_name: string;
          agent_count: number;
          ap_total: number;
          ip_total: number;
          owner_id: string;
          owner_name: string;
          pending_policy_count: number;
          pipeline_count: number;
          policy_count: number;
          prospect_count: number;
          rank_overall: number;
        }[];
      };
      get_agency_metrics: { Args: { p_agency_id: string }; Returns: Json };
      get_agency_override_summary: {
        Args: {
          p_agency_id?: string;
          p_end_date?: string;
          p_start_date?: string;
        };
        Returns: {
          agency_id: string;
          agency_name: string;
          avg_override_per_policy: number;
          chargeback_amount: number;
          earned_amount: number;
          paid_amount: number;
          pending_amount: number;
          top_earner_amount: number;
          top_earner_id: string;
          top_earner_name: string;
          total_override_amount: number;
          total_override_count: number;
          unique_downlines: number;
          unique_uplines: number;
        }[];
      };
      get_agency_performance_report: {
        Args: {
          p_agency_id?: string;
          p_end_date?: string;
          p_start_date?: string;
        };
        Returns: {
          commissions_earned: number;
          lapsed_premium: number;
          month_label: string;
          month_start: string;
          net_premium_change: number;
          new_agents: number;
          new_policies: number;
          new_premium: number;
          policies_lapsed: number;
          running_total_policies: number;
          running_total_premium: number;
        }[];
      };
      get_agency_production_by_agent: {
        Args: { p_agency_id?: string };
        Returns: {
          active_policies: number;
          agent_email: string;
          agent_id: string;
          agent_name: string;
          commissions_ytd: number;
          contract_level: number;
          earned_ytd: number;
          joined_date: string;
          pct_of_agency_production: number;
          total_annual_premium: number;
          unearned_amount: number;
        }[];
      };
      get_agency_recruiting_summary: {
        Args: { p_agency_id: string };
        Returns: Json;
      };
      get_agency_slack_credentials: {
        Args: { p_agency_id?: string; p_imo_id: string };
        Returns: {
          app_name: string;
          client_id: string;
          client_secret_encrypted: string;
          credential_id: string;
          is_fallback: boolean;
          signing_secret_encrypted: string;
          source_agency_id: string;
        }[];
      };
      get_agency_users_for_sms: {
        Args: {
          p_agency_id: string;
          p_exclude_user_id: string;
          p_imo_id: string;
        };
        Returns: {
          first_name: string;
          phone: string;
          user_id: string;
        }[];
      };
      get_agency_weekly_production: {
        Args: {
          p_agency_id?: string;
          p_end_date?: string;
          p_start_date?: string;
        };
        Returns: {
          commissions_earned: number;
          lapsed_premium: number;
          net_premium_change: number;
          new_policies: number;
          new_premium: number;
          policies_lapsed: number;
          running_total_policies: number;
          running_total_premium: number;
          week_end: string;
          week_label: string;
          week_start: string;
        }[];
      };
      get_agent_carrier_contracts: {
        Args: { p_agent_id: string };
        Returns: {
          approved_date: string;
          carrier_id: string;
          carrier_name: string;
          status: string;
          writing_number: string;
        }[];
      };
      get_agent_contract_summary: {
        Args: { p_agent_id: string };
        Returns: {
          current_contract_id: string;
          current_contract_level: number;
          current_contract_status: string;
          documents_count: number;
          pending_documents: number;
          writing_numbers_count: number;
        }[];
      };
      get_agent_daily_stats: {
        Args: { p_imo_id: string; p_target_date?: string; p_user_id: string };
        Returns: {
          policy_count: number;
          total_ap: number;
        }[];
      };
      get_alert_rule_history: {
        Args: { p_limit?: number; p_rule_id: string };
        Returns: {
          affected_entity_id: string;
          affected_entity_type: string;
          affected_user_id: string;
          affected_user_name: string;
          comparison: Database["public"]["Enums"]["alert_comparison"];
          current_value: number;
          evaluated_at: string;
          id: string;
          notification_id: string;
          threshold_value: number;
          triggered: boolean;
        }[];
      };
      get_alertable_metrics: {
        Args: never;
        Returns: {
          available_for_downlines: boolean;
          available_for_self: boolean;
          available_for_team: boolean;
          default_comparison: string;
          default_threshold: number;
          default_unit: string;
          description: string;
          label: string;
          metric: string;
        }[];
      };
      get_all_agencies_submit_totals: {
        Args: { p_imo_id: string };
        Returns: {
          agency_id: string;
          agency_name: string;
          mtd_ap: number;
          mtd_policies: number;
          wtd_ap: number;
          wtd_policies: number;
        }[];
      };
      get_all_expense_categories: {
        Args: never;
        Returns: {
          category_type: string;
          description: string;
          id: string;
          is_active: boolean;
          is_global: boolean;
          name: string;
          sort_order: number;
        }[];
      };
      get_approaching_deadline_items: {
        Args: never;
        Returns: {
          automation_delay_days: number;
          checklist_item_id: string;
          days_until_deadline: number;
          recruit_id: string;
        }[];
      };
      get_at_risk_commissions: {
        Args: { p_risk_threshold?: number; p_user_id: string };
        Returns: {
          advance_amount: number;
          commission_id: string;
          earned_amount: number;
          effective_date: string;
          months_paid: number;
          policy_id: string;
          policy_status: string;
          risk_level: string;
          unearned_amount: number;
        }[];
      };
      get_audit_action_types: {
        Args: never;
        Returns: {
          action_type: string;
          count: number;
        }[];
      };
      get_audit_log_detail: {
        Args: { p_audit_id: string };
        Returns: {
          action: Database["public"]["Enums"]["audit_action"];
          action_type: string;
          agency_id: string;
          changed_fields: string[];
          created_at: string;
          description: string;
          id: string;
          imo_id: string;
          metadata: Json;
          new_data: Json;
          old_data: Json;
          performed_by: string;
          performed_by_email: string;
          performed_by_name: string;
          record_id: string;
          source: Database["public"]["Enums"]["audit_source"];
          table_name: string;
        }[];
      };
      get_audit_logs: {
        Args: {
          p_action?: string;
          p_action_type?: string;
          p_end_date?: string;
          p_page?: number;
          p_page_size?: number;
          p_performed_by?: string;
          p_record_id?: string;
          p_search?: string;
          p_start_date?: string;
          p_table_name?: string;
        };
        Returns: {
          action: Database["public"]["Enums"]["audit_action"];
          action_type: string;
          agency_id: string;
          changed_fields: string[];
          created_at: string;
          description: string;
          id: string;
          imo_id: string;
          performed_by: string;
          performed_by_email: string;
          performed_by_name: string;
          record_id: string;
          source: Database["public"]["Enums"]["audit_source"];
          table_name: string;
          total_count: number;
        }[];
      };
      get_audit_performers: {
        Args: never;
        Returns: {
          action_count: number;
          user_email: string;
          user_id: string;
          user_name: string;
        }[];
      };
      get_audit_tables: {
        Args: never;
        Returns: {
          count: number;
          table_name: string;
        }[];
      };
      get_available_carriers_for_recruit: {
        Args: { p_recruit_id: string };
        Returns: {
          contracting_metadata: Json;
          id: string;
          name: string;
          priority: number;
          upline_has_contract: boolean;
        }[];
      };
      get_available_imos_for_join: {
        Args: never;
        Returns: {
          code: string;
          description: string;
          id: string;
          name: string;
        }[];
      };
      get_available_knockout_codes: {
        Args: never;
        Returns: {
          code: string;
          name: string;
          severity: string;
        }[];
      };
      get_carrier_acceptance: {
        Args: {
          p_carrier_id: string;
          p_condition_code: string;
          p_imo_id: string;
          p_product_type: string;
        };
        Returns: {
          acceptance: string;
          approval_likelihood: number;
          health_class_result: string;
          notes: string;
          requires_conditions: Json;
        }[];
      };
      get_clients_with_stats: {
        Args: { p_user_id?: string };
        Returns: {
          active_policy_count: number;
          address: string;
          avg_premium: number;
          created_at: string;
          date_of_birth: string;
          email: string;
          id: string;
          last_policy_date: string;
          name: string;
          notes: string;
          phone: string;
          policy_count: number;
          status: string;
          total_premium: number;
          updated_at: string;
          user_id: string;
        }[];
      };
      get_close_api_key: { Args: { p_user_id: string }; Returns: string };
      get_close_connection_status: {
        Args: { p_user_id: string };
        Returns: {
          id: string;
          is_active: boolean;
          organization_name: string;
        }[];
      };
      get_commissions_for_threshold_check: {
        Args: {
          p_end_date: string;
          p_rule_id: string;
          p_start_date: string;
          p_user_ids: string[];
        };
        Returns: {
          agent_id: string;
          total_commission: number;
        }[];
      };
      get_current_user_hierarchy_path: { Args: never; Returns: string };
      get_current_user_profile_id: { Args: never; Returns: string };
      get_daily_production_by_agent: {
        Args: { p_agency_id?: string; p_imo_id: string };
        Returns: {
          agent_email: string;
          agent_id: string;
          agent_name: string;
          policy_count: number;
          slack_member_id: string;
          total_annual_premium: number;
        }[];
      };
      get_downline_clients_with_stats: {
        Args: { p_user_id?: string };
        Returns: {
          active_policy_count: number;
          address: string;
          avg_premium: number;
          created_at: string;
          date_of_birth: string;
          email: string;
          id: string;
          last_policy_date: string;
          name: string;
          notes: string;
          phone: string;
          policy_count: number;
          status: string;
          total_premium: number;
          updated_at: string;
          user_id: string;
        }[];
      };
      get_downline_expense_summary: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          business_amount: number;
          expense_count: number;
          owner_name: string;
          personal_amount: number;
          tax_deductible_amount: number;
          total_amount: number;
          user_id: string;
        }[];
      };
      get_downline_expenses: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          amount: number;
          category: string;
          created_at: string;
          date: string;
          description: string;
          expense_type: Database["public"]["Enums"]["expense_type"];
          id: string;
          is_recurring: boolean;
          is_tax_deductible: boolean;
          name: string;
          owner_name: string;
          user_id: string;
        }[];
      };
      get_downline_ids: {
        Args: { target_user_id: string };
        Returns: {
          downline_id: string;
        }[];
      };
      get_downline_targets: {
        Args: never;
        Returns: {
          annual_income_target: number;
          annual_policies_target: number;
          avg_premium_target: number;
          created_at: string;
          expense_ratio_target: number;
          id: string;
          monthly_expense_target: number;
          monthly_income_target: number;
          monthly_policies_target: number;
          owner_name: string;
          persistency_13_month_target: number;
          persistency_25_month_target: number;
          quarterly_income_target: number;
          updated_at: string;
          user_id: string;
        }[];
      };
      get_downline_with_emails: {
        Args: { p_max_count?: number; p_user_id: string };
        Returns: {
          email: string;
          id: string;
        }[];
      };
      get_due_alert_rules: {
        Args: { p_batch_size?: number; p_worker_id?: string };
        Returns: {
          agency_id: string;
          applies_to_downlines: boolean;
          applies_to_self: boolean;
          applies_to_team: boolean;
          comparison: Database["public"]["Enums"]["alert_comparison"];
          cooldown_hours: number;
          id: string;
          imo_id: string;
          last_triggered_at: string;
          metric: Database["public"]["Enums"]["alert_metric"];
          notify_email: boolean;
          notify_in_app: boolean;
          owner_id: string;
          threshold_unit: string;
          threshold_value: number;
        }[];
      };
      get_due_scheduled_reports: {
        Args: never;
        Returns: {
          agency_id: string;
          day_of_month: number;
          day_of_week: number;
          export_format: string;
          frequency: Database["public"]["Enums"]["report_frequency"];
          id: string;
          imo_id: string;
          include_charts: boolean;
          include_insights: boolean;
          include_summary: boolean;
          owner_id: string;
          preferred_time: string;
          recipients: Json;
          report_config: Json;
          report_type: string;
          schedule_name: string;
        }[];
      };
      get_eligible_recipients: {
        Args: { p_agency_id?: string; p_imo_id?: string };
        Returns: {
          agency_name: string;
          email: string;
          full_name: string;
          role: string;
          user_id: string;
        }[];
      };
      get_imo_admin: { Args: { p_imo_id: string }; Returns: string };
      get_imo_contract_stats: {
        Args: { p_imo_id: string };
        Returns: {
          active_contracts: number;
          expiring_soon: number;
          pending_contracts: number;
          pending_documents: number;
          total_contracts: number;
        }[];
      };
      get_imo_dashboard_metrics: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          agency_count: number;
          agent_count: number;
          avg_production_per_agent: number;
          imo_id: string;
          imo_name: string;
          total_active_policies: number;
          total_annual_premium: number;
          total_commissions_ytd: number;
          total_earned_ytd: number;
          total_unearned: number;
        }[];
      };
      get_imo_expense_by_category: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          avg_amount: number;
          category: string;
          expense_count: number;
          total_amount: number;
        }[];
      };
      get_imo_expense_summary: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          agency_name: string;
          business_amount: number;
          expense_count: number;
          owner_name: string;
          personal_amount: number;
          tax_deductible_amount: number;
          total_amount: number;
          user_id: string;
        }[];
      };
      get_imo_metrics: { Args: { p_imo_id: string }; Returns: Json };
      get_imo_override_summary: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          avg_override_per_policy: number;
          chargeback_amount: number;
          earned_amount: number;
          imo_id: string;
          imo_name: string;
          paid_amount: number;
          pending_amount: number;
          total_override_amount: number;
          total_override_count: number;
          unique_downlines: number;
          unique_uplines: number;
        }[];
      };
      get_imo_performance_report: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          commissions_earned: number;
          lapsed_premium: number;
          month_label: string;
          month_start: string;
          net_premium_change: number;
          new_agents: number;
          new_policies: number;
          new_premium: number;
          policies_lapsed: number;
          running_total_policies: number;
          running_total_premium: number;
        }[];
      };
      get_imo_production_by_agency: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          agency_code: string;
          agency_id: string;
          agency_name: string;
          agent_count: number;
          avg_premium_per_agent: number;
          commissions_earned: number;
          new_policies: number;
          new_premium: number;
          owner_name: string;
          pct_of_imo_premium: number;
          policies_lapsed: number;
          rank_by_policies: number;
          rank_by_premium: number;
          retention_rate: number;
        }[];
      };
      get_imo_recruiting_summary: { Args: { p_imo_id: string }; Returns: Json };
      get_imo_submit_totals: {
        Args: { p_imo_id: string };
        Returns: {
          mtd_ap: number;
          mtd_policies: number;
          wtd_ap: number;
          wtd_policies: number;
        }[];
      };
      get_imo_targets: {
        Args: never;
        Returns: {
          agency_name: string;
          annual_income_target: number;
          annual_policies_target: number;
          avg_premium_target: number;
          created_at: string;
          expense_ratio_target: number;
          id: string;
          monthly_expense_target: number;
          monthly_income_target: number;
          monthly_policies_target: number;
          owner_name: string;
          persistency_13_month_target: number;
          persistency_25_month_target: number;
          quarterly_income_target: number;
          updated_at: string;
          user_id: string;
        }[];
      };
      get_imo_workflow_templates: {
        Args: never;
        Returns: {
          actions: Json;
          category: string;
          conditions: Json;
          config: Json;
          cooldown_minutes: number;
          created_at: string;
          created_by: string;
          created_by_name: string;
          description: string;
          id: string;
          max_runs_per_day: number;
          max_runs_per_recipient: number;
          name: string;
          priority: number;
          status: string;
          trigger_type: string;
          updated_at: string;
        }[];
      };
      get_imos_with_system_automations: {
        Args: { p_trigger_type: string };
        Returns: {
          imo_id: string;
          imo_name: string;
        }[];
      };
      get_ip_leaderboard_with_periods: {
        Args: { p_agency_id?: string; p_imo_id: string };
        Returns: {
          agent_email: string;
          agent_id: string;
          agent_name: string;
          mtd_ip: number;
          mtd_policies: number;
          slack_member_id: string;
          wtd_ip: number;
          wtd_policies: number;
        }[];
      };
      get_knockout_conditions: {
        Args: never;
        Returns: Database["public"]["CompositeTypes"]["knockout_condition_def"][];
      };
      get_lead_pack_heat_metrics: {
        Args: { p_imo_id?: string };
        Returns: {
          commission_earned: number;
          days_since_last_sale: number;
          days_since_purchase: number;
          days_to_first_sale: number;
          lead_count: number;
          pack_id: string;
          policies_sold: number;
          sales_last_30d: number;
          total_cost: number;
          total_premium: number;
          vendor_id: string;
        }[];
      };
      get_lead_pack_list: {
        Args: {
          p_end_date?: string;
          p_freshness?: string;
          p_imo_id?: string;
          p_start_date?: string;
        };
        Returns: {
          agent_id: string;
          agent_name: string;
          commission_earned: number;
          cost_per_lead: number;
          lead_count: number;
          lead_freshness: string;
          pack_id: string;
          policies_sold: number;
          purchase_date: string;
          purchase_name: string;
          roi_percentage: number;
          total_cost: number;
          total_premium: number;
          vendor_id: string;
          vendor_name: string;
        }[];
      };
      get_lead_purchase_stats: {
        Args: {
          p_end_date?: string;
          p_start_date?: string;
          p_user_id?: string;
        };
        Returns: {
          avg_cost_per_lead: number;
          avg_roi: number;
          conversion_rate: number;
          total_commission: number;
          total_leads: number;
          total_policies: number;
          total_purchases: number;
          total_spent: number;
        }[];
      };
      get_lead_recent_policies: {
        Args: { p_imo_id?: string; p_limit?: number };
        Returns: {
          agent_id: string;
          agent_name: string;
          annual_premium: number;
          client_name: string;
          client_state: string;
          effective_date: string;
          lead_freshness: string;
          pack_id: string;
          pack_name: string;
          policy_id: string;
          policy_number: string;
          product: string;
          status: string;
          submit_date: string;
          vendor_id: string;
          vendor_name: string;
        }[];
      };
      get_lead_stats_by_vendor: {
        Args: {
          p_end_date?: string;
          p_start_date?: string;
          p_user_id?: string;
        };
        Returns: {
          avg_cost_per_lead: number;
          avg_roi: number;
          conversion_rate: number;
          total_commission: number;
          total_leads: number;
          total_policies: number;
          total_purchases: number;
          total_spent: number;
          vendor_id: string;
          vendor_name: string;
        }[];
      };
      get_lead_stats_by_vendor_imo_aggregate: {
        Args: { p_end_date?: string; p_imo_id?: string; p_start_date?: string };
        Returns: {
          avg_cost_per_lead: number;
          avg_roi: number;
          conversion_rate: number;
          total_commission: number;
          total_leads: number;
          total_policies: number;
          total_purchases: number;
          total_spent: number;
          unique_users: number;
          vendor_id: string;
          vendor_name: string;
        }[];
      };
      get_lead_vendor_admin_overview: {
        Args: { p_end_date?: string; p_imo_id?: string; p_start_date?: string };
        Returns: {
          aged_leads: number;
          aged_spent: number;
          avg_cost_per_lead: number;
          avg_roi: number;
          contact_email: string;
          contact_name: string;
          contact_phone: string;
          conversion_rate: number;
          created_at: string;
          fresh_leads: number;
          fresh_spent: number;
          last_purchase_date: string;
          notes: string;
          total_commission: number;
          total_leads: number;
          total_policies: number;
          total_premium: number;
          total_purchases: number;
          total_spent: number;
          unique_users: number;
          vendor_id: string;
          vendor_name: string;
          website: string;
        }[];
      };
      get_lead_vendor_heat_metrics: {
        Args: never;
        Returns: {
          agents_purchased_30d: number;
          agents_with_sales_30d: number;
          avg_days_between_sales: number;
          avg_days_to_first_sale: number;
          avg_policies_per_pack: number;
          days_since_last_sale: number;
          median_days_to_first_sale: number;
          packs_with_sales: number;
          sales_last_30d: number;
          sales_last_90d: number;
          total_leads_90d: number;
          total_packs_90d: number;
          total_policies_all_time: number;
          vendor_id: string;
        }[];
      };
      get_lead_vendor_policy_timeline: {
        Args: {
          p_end_date?: string;
          p_start_date?: string;
          p_user_id?: string;
          p_vendor_id: string;
        };
        Returns: {
          agent_id: string;
          agent_name: string;
          annual_premium: number;
          client_name: string;
          effective_date: string;
          policy_id: string;
          policy_number: string;
          product: string;
          status: string;
          submit_date: string;
        }[];
      };
      get_lead_vendor_user_breakdown: {
        Args: {
          p_end_date?: string;
          p_start_date?: string;
          p_vendor_id: string;
        };
        Returns: {
          aged_leads: number;
          avg_cost_per_lead: number;
          avg_roi: number;
          conversion_rate: number;
          fresh_leads: number;
          last_purchase_date: string;
          total_commission: number;
          total_leads: number;
          total_policies: number;
          total_purchases: number;
          total_spent: number;
          user_id: string;
          user_name: string;
        }[];
      };
      get_leaderboard_data: {
        Args: {
          p_end_date?: string;
          p_scope?: string;
          p_scope_id?: string;
          p_start_date?: string;
          p_team_threshold?: number;
        };
        Returns: {
          agency_id: string;
          agency_name: string;
          agent_email: string;
          agent_id: string;
          agent_name: string;
          ap_total: number;
          direct_downline_count: number;
          ip_total: number;
          pending_policy_count: number;
          pipeline_count: number;
          policy_count: number;
          profile_photo_url: string;
          prospect_count: number;
          rank_overall: number;
        }[];
      };
      get_license_expirations_for_check: {
        Args: {
          p_rule_id: string;
          p_user_ids: string[];
          p_warning_days: number;
        };
        Returns: {
          days_until_expiration: number;
          license_expiration: string;
          user_id: string;
          user_name: string;
        }[];
      };
      get_message_stats: { Args: { p_user_id: string }; Returns: Json };
      get_module_progress_summary: {
        Args: { p_module_id: string; p_user_id?: string };
        Returns: Json[];
      };
      get_my_agency_id: { Args: never; Returns: string };
      get_my_alert_rules: {
        Args: never;
        Returns: {
          agency_id: string;
          applies_to_downlines: boolean;
          applies_to_self: boolean;
          applies_to_team: boolean;
          comparison: Database["public"]["Enums"]["alert_comparison"];
          cooldown_hours: number;
          created_at: string;
          description: string;
          id: string;
          imo_id: string;
          is_active: boolean;
          last_triggered_at: string;
          metric: Database["public"]["Enums"]["alert_metric"];
          name: string;
          notify_email: boolean;
          notify_in_app: boolean;
          owner_id: string;
          owner_name: string;
          threshold_unit: string;
          threshold_value: number;
          trigger_count: number;
          updated_at: string;
        }[];
      };
      get_my_daily_sales_logs: {
        Args: never;
        Returns: {
          can_rename: boolean;
          channel_id: string;
          created_at: string;
          first_seller_id: string;
          id: string;
          imo_id: string;
          is_first_seller: boolean;
          leaderboard_message_ts: string;
          log_date: string;
          slack_integration_id: string;
          title: string;
          title_set_at: string;
          updated_at: string;
        }[];
      };
      get_my_imo_id: { Args: never; Returns: string };
      get_my_notification_preferences: {
        Args: never;
        Returns: {
          browser_push_enabled: boolean | null;
          browser_push_subscription: Json | null;
          created_at: string | null;
          email_digest_enabled: boolean | null;
          email_digest_frequency: string | null;
          email_digest_time: string | null;
          email_digest_timezone: string | null;
          id: string;
          in_app_enabled: boolean | null;
          last_digest_sent_at: string | null;
          notify_on_click: boolean | null;
          notify_on_open: boolean | null;
          notify_on_reply: boolean | null;
          quiet_hours_enabled: boolean | null;
          quiet_hours_end: string | null;
          quiet_hours_start: string | null;
          updated_at: string | null;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "notification_preferences";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_my_scheduled_reports: {
        Args: never;
        Returns: {
          consecutive_failures: number;
          created_at: string;
          day_of_month: number;
          day_of_week: number;
          export_format: string;
          failed_deliveries: number;
          frequency: Database["public"]["Enums"]["report_frequency"];
          id: string;
          include_charts: boolean;
          include_insights: boolean;
          include_summary: boolean;
          is_active: boolean;
          last_delivery: string;
          next_delivery: string;
          preferred_time: string;
          recipients: Json;
          report_config: Json;
          report_type: string;
          schedule_name: string;
          successful_deliveries: number;
          total_deliveries: number;
        }[];
      };
      get_or_create_usage_tracking: {
        Args: { p_metric: string; p_user_id: string };
        Returns: {
          count: number;
          created_at: string;
          id: string;
          metric: string;
          overage_amount: number;
          overage_charged: boolean;
          period_end: string;
          period_start: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "usage_tracking";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_org_chart_data: {
        Args: {
          p_include_metrics?: boolean;
          p_max_depth?: number;
          p_scope?: string;
          p_scope_id?: string;
        };
        Returns: Json;
      };
      get_overrides_by_agency: {
        Args: never;
        Returns: {
          agency_code: string;
          agency_id: string;
          agency_name: string;
          earned_amount: number;
          override_count: number;
          paid_amount: number;
          pct_of_imo_overrides: number;
          pending_amount: number;
          total_amount: number;
        }[];
      };
      get_overrides_by_agent: {
        Args: { p_agency_id?: string };
        Returns: {
          agent_email: string;
          agent_id: string;
          agent_name: string;
          avg_per_override: number;
          earned_amount: number;
          override_count: number;
          paid_amount: number;
          pct_of_agency_overrides: number;
          pending_amount: number;
          total_amount: number;
        }[];
      };
      get_password_reminder_users: {
        Args: { filter_imo_id: string; hours_since_creation: number };
        Returns: {
          created_at: string;
          email: string;
          first_name: string;
          imo_id: string;
          last_name: string;
          phone: string;
          user_id: string;
        }[];
      };
      get_pending_agency_request_count: { Args: never; Returns: number };
      get_pending_first_sale_logs: {
        Args: { p_first_sale_group_id: string };
        Returns: {
          channel_id: string;
          first_seller_id: string;
          hierarchy_depth: number;
          imo_id: string;
          leaderboard_message_ts: string;
          log_date: string;
          log_id: string;
          pending_policy_data: Json;
          slack_integration_id: string;
          title: string;
        }[];
      };
      get_pending_invitations_count: { Args: never; Returns: number };
      get_pending_join_request_count: { Args: never; Returns: number };
      get_pipeline_template_for_user: {
        Args: {
          p_agent_status: Database["public"]["Enums"]["agent_status"];
          p_roles: string[];
        };
        Returns: string;
      };
      get_plan_by_stripe_price: {
        Args: { p_price_id: string };
        Returns: {
          analytics_sections: string[];
          announcement_features: string[];
          created_at: string;
          description: string | null;
          display_name: string;
          email_limit: number;
          features: Json;
          id: string;
          is_active: boolean;
          name: string;
          price_annual: number;
          price_monthly: number;
          sms_enabled: boolean;
          sort_order: number;
          stripe_price_id_annual: string | null;
          stripe_price_id_monthly: string | null;
          stripe_product_id: string | null;
          team_size_limit: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "subscription_plans";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_policies_for_lapse_check: {
        Args: {
          p_rule_id: string;
          p_user_ids: string[];
          p_warning_days: number;
        };
        Returns: {
          annual_premium: number;
          carrier_name: string;
          days_until_due: number;
          effective_date: string;
          last_payment_date: string;
          policy_id: string;
          policy_number: string;
          product_type: string;
          user_email: string;
          user_id: string;
          user_name: string;
        }[];
      };
      get_policies_paginated: {
        Args: {
          p_carrier_id?: string;
          p_cursor?: string;
          p_limit?: number;
          p_product_id?: string;
          p_status?: string;
          p_user_id?: string;
        };
        Returns: {
          annual_premium: number;
          carrier_id: string;
          carrier_name: string;
          client: Json;
          commission_percentage: number;
          created_at: string;
          effective_date: string;
          id: string;
          payment_frequency: Database["public"]["Enums"]["payment_frequency"];
          policy_number: string;
          product: Database["public"]["Enums"]["product_type"];
          product_id: string;
          product_name: string;
          status: Database["public"]["Enums"]["policy_status"];
          user_id: string;
        }[];
      };
      get_policy_count: {
        Args: {
          p_carrier_id?: string;
          p_product_id?: string;
          p_status?: string;
          p_user_id?: string;
        };
        Returns: number;
      };
      get_policy_counts_for_check: {
        Args: {
          p_end_date: string;
          p_rule_id: string;
          p_start_date: string;
          p_user_ids: string[];
        };
        Returns: {
          agent_id: string;
          policy_count: number;
        }[];
      };
      get_premium_matrices_for_imo: {
        Args: { p_imo_id: string; p_limit?: number; p_offset?: number };
        Returns: {
          age: number;
          carrier_id: string;
          carrier_name: string;
          created_at: string;
          created_by: string;
          face_amount: number;
          gender: string;
          health_class: string;
          id: string;
          imo_id: string;
          is_active: boolean;
          max_age: number;
          max_face_amount: number;
          min_age: number;
          min_face_amount: number;
          monthly_premium: number;
          product_id: string;
          product_metadata: Json;
          product_name: string;
          product_type: string;
          term_years: number;
          tobacco_class: string;
          updated_at: string;
        }[];
      };
      get_product_commission_rate: {
        Args: {
          p_comp_level: Database["public"]["Enums"]["comp_level"];
          p_date?: string;
          p_product_id: string;
        };
        Returns: number;
      };
      get_product_rate: {
        Args: {
          p_age: number;
          p_gender: string;
          p_health_class: string;
          p_imo_id: string;
          p_product_id: string;
          p_tobacco_class: string;
        };
        Returns: number;
      };
      get_public_invitation_by_token: {
        Args: { p_token: string };
        Returns: Json;
      };
      get_public_landing_page_settings: {
        Args: { p_imo_id?: string };
        Returns: Json;
      };
      get_public_recruiter_info: {
        Args: { p_slug: string };
        Returns: {
          calendly_url: string;
          imo_description: string;
          imo_logo_url: string;
          imo_name: string;
          imo_primary_color: string;
          is_active: boolean;
          recruiter_first_name: string;
          recruiter_id: string;
          recruiter_last_name: string;
        }[];
      };
      get_public_recruiting_theme: { Args: { p_slug: string }; Returns: Json };
      get_recruiting_by_agency: { Args: { p_imo_id: string }; Returns: Json };
      get_recruiting_by_recruiter: {
        Args: { p_agency_id: string };
        Returns: Json;
      };
      get_recruiting_leads_stats: {
        Args: { p_recruiter_id?: string };
        Returns: Json;
      };
      get_recruits_checklist_summary: {
        Args: { recruit_ids: string[] };
        Returns: {
          completed_items: number;
          current_phase_id: string;
          is_last_item: boolean;
          total_items: number;
          user_id: string;
        }[];
      };
      get_role_permissions_with_inheritance: {
        Args: { p_role_id: string };
        Returns: {
          inherited_from_role_name: string;
          permission_action: string;
          permission_code: string;
          permission_description: string;
          permission_id: string;
          permission_resource: string;
          permission_scope: string;
          permission_type: string;
        }[];
      };
      get_schedule_delivery_history: {
        Args: { p_limit?: number; p_schedule_id: string };
        Returns: {
          created_at: string;
          delivered_at: string;
          error_message: string;
          id: string;
          recipients_sent: Json;
          report_period_end: string;
          report_period_start: string;
          status: string;
        }[];
      };
      get_skill_radar_data: { Args: { p_user_id?: string }; Returns: Json[] };
      get_slack_integrations_for_agency_hierarchy: {
        Args: { p_agency_id: string };
        Returns: {
          agency_id: string;
          agency_name: string;
          display_name: string;
          hierarchy_depth: number;
          include_client_info: boolean;
          include_leaderboard: boolean;
          integration_id: string;
          policy_channel_id: string;
          policy_channel_name: string;
          team_id: string;
          team_name: string;
        }[];
      };
      get_slack_leaderboard_with_periods: {
        Args: { p_agency_id?: string; p_imo_id: string };
        Returns: {
          agent_email: string;
          agent_id: string;
          agent_name: string;
          mtd_ap: number;
          mtd_policies: number;
          slack_member_id: string;
          today_ap: number;
          today_policies: number;
          wtd_ap: number;
          wtd_policies: number;
        }[];
      };
      get_stale_phase_recruits: {
        Args: never;
        Returns: {
          automation_delay_days: number;
          days_in_phase: number;
          phase_id: string;
          recruit_id: string;
        }[];
      };
      get_submit_leaderboard: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          agency_id: string;
          agency_name: string;
          agent_email: string;
          agent_id: string;
          agent_name: string;
          ap_total: number;
          policy_count: number;
          profile_photo_url: string;
          rank_overall: number;
        }[];
      };
      get_sync_webhook_secret: { Args: never; Returns: string };
      get_team_analytics_data: {
        Args: {
          p_end_date: string;
          p_start_date: string;
          p_team_user_ids: string[];
        };
        Returns: Json;
      };
      get_team_comparison_report: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          agency_code: string;
          agency_id: string;
          agency_name: string;
          agent_count: number;
          avg_premium_per_agent: number;
          avg_premium_per_policy: number;
          commissions_earned: number;
          new_policies: number;
          new_premium: number;
          owner_name: string;
          pct_of_imo_premium: number;
          policies_lapsed: number;
          rank_by_policies: number;
          rank_by_premium: number;
          retention_rate: number;
        }[];
      };
      get_team_leaderboard_data: {
        Args: {
          p_end_date?: string;
          p_min_downlines?: number;
          p_start_date?: string;
        };
        Returns: {
          agency_id: string;
          agency_name: string;
          ap_total: number;
          ip_total: number;
          leader_email: string;
          leader_id: string;
          leader_name: string;
          leader_profile_photo_url: string;
          pending_policy_count: number;
          pipeline_count: number;
          policy_count: number;
          prospect_count: number;
          rank_overall: number;
          team_size: number;
        }[];
      };
      get_team_leaders_for_leaderboard: {
        Args: { p_min_downlines?: number };
        Returns: {
          downline_count: number;
          id: string;
          name: string;
        }[];
      };
      get_team_member_ids: { Args: never; Returns: string[] };
      get_team_pipeline_snapshot: {
        Args: { p_target_user_ids?: string[] };
        Returns: {
          active_opps_count: number;
          avg_score: number;
          cold_count: number;
          connect_rate: number;
          cooling_count: number;
          email: string;
          first_name: string;
          has_close_config: boolean;
          hot_count: number;
          is_self: boolean;
          last_name: string;
          last_scored_at: string;
          neutral_count: number;
          no_answer_streak: number;
          open_opp_value_usd: number;
          profile_photo_url: string;
          stale_leads_count: number;
          straight_to_vm: number;
          total_connects: number;
          total_dials: number;
          total_leads: number;
          untouched_active: number;
          user_id: string;
          warming_count: number;
        }[];
      };
      get_team_seat_limit: { Args: { p_owner_id: string }; Returns: number };
      get_team_uw_wizard_seat_usage: {
        Args: { p_owner_id: string };
        Returns: {
          agent_email: string;
          agent_first_name: string;
          agent_id: string;
          agent_last_name: string;
          created_at: string;
          last_run_at: string;
          runs_limit: number;
          runs_remaining: number;
          runs_used: number;
          seat_id: string;
          team_owner_id: string;
        }[];
      };
      get_teammates_with_close_connected: {
        Args: never;
        Returns: {
          email: string;
          first_name: string;
          last_name: string;
          organization_name: string;
          user_id: string;
        }[];
      };
      get_templates_for_platform: {
        Args: { p_imo_id: string; p_platform: string; p_user_id: string };
        Returns: {
          category: string | null;
          content: string;
          created_at: string | null;
          created_by: string | null;
          id: string;
          imo_id: string;
          is_active: boolean | null;
          last_used_at: string | null;
          message_stage: string | null;
          name: string;
          platform: string;
          updated_at: string | null;
          use_count: number | null;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "instagram_message_templates";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_top_performers_report: {
        Args: { p_end_date?: string; p_limit?: number; p_start_date?: string };
        Returns: {
          agency_id: string;
          agency_name: string;
          agent_email: string;
          agent_id: string;
          agent_name: string;
          avg_premium_per_policy: number;
          commissions_earned: number;
          contract_level: number;
          new_policies: number;
          new_premium: number;
          rank_in_agency: number;
          rank_in_imo: number;
        }[];
      };
      get_training_leaderboard: {
        Args: { p_agency_id: string; p_period?: string };
        Returns: Json[];
      };
      get_upline_chain: {
        Args: { p_max_depth?: number; p_user_id: string };
        Returns: {
          depth: number;
          email: string;
          id: string;
        }[];
      };
      get_user_addons: {
        Args: { p_user_id: string };
        Returns: {
          addon_display_name: string;
          addon_id: string;
          addon_name: string;
          billing_interval: string;
          current_period_end: string;
          granted_by: string;
          status: string;
        }[];
      };
      get_user_carrier_performance: {
        Args: never;
        Returns: {
          active_policies: number | null;
          avg_commission_amount: number | null;
          avg_commission_rate_pct: number | null;
          avg_premium: number | null;
          cancelled_policies: number | null;
          carrier_id: string | null;
          carrier_name: string | null;
          commission_count: number | null;
          lapsed_policies: number | null;
          persistency_rate: number | null;
          total_commission_amount: number | null;
          total_policies: number | null;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "mv_carrier_performance";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_user_client_ltv: {
        Args: never;
        Returns: {
          active_policies: number | null;
          active_premium: number | null;
          avg_commission_per_policy: number | null;
          avg_policy_age_months: number | null;
          avg_premium_per_policy: number | null;
          cancelled_policies: number | null;
          client_id: string | null;
          client_name: string | null;
          client_tier: string | null;
          cross_sell_opportunity: boolean | null;
          email: string | null;
          first_policy_date: string | null;
          lapsed_policies: number | null;
          latest_policy_date: string | null;
          paid_commission: number | null;
          total_commission: number | null;
          total_policies: number | null;
          total_premium: number | null;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "mv_client_ltv";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_user_cohort_retention: {
        Args: never;
        Returns: {
          active_premium: number | null;
          cancelled_count: number | null;
          cohort_month: string | null;
          cohort_size: number | null;
          lapsed_count: number | null;
          months_since_issue: number | null;
          retention_rate: number | null;
          still_active: number | null;
          total_premium: number | null;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "mv_cohort_retention";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_user_commission_aging: {
        Args: never;
        Returns: {
          aging_bucket: string | null;
          avg_at_risk: number | null;
          bucket_order: number | null;
          commission_count: number | null;
          policy_count: number | null;
          risk_level: string | null;
          total_at_risk: number | null;
          total_commission: number | null;
          total_earned: number | null;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "mv_commission_aging";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_user_commission_chargeback_summary: {
        Args: never;
        Returns: {
          at_risk_amount: number | null;
          chargeback_rate_percentage: number | null;
          charged_back_count: number | null;
          high_risk_count: number | null;
          total_advances: number | null;
          total_chargeback_amount: number | null;
          total_chargebacks: number | null;
          total_earned: number | null;
          user_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "commission_chargeback_summary";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_user_commission_profile: {
        Args: { p_lookback_months?: number; p_user_id: string };
        Returns: {
          calculated_at: string;
          contract_level: number;
          data_quality: string;
          product_breakdown: Json;
          simple_avg_rate: number;
          weighted_avg_rate: number;
        }[];
      };
      get_user_daily_production: {
        Args: { p_end_date?: string; p_start_date?: string };
        Returns: {
          active_policies: number | null;
          avg_premium: number | null;
          cancelled_policies: number | null;
          lapsed_policies: number | null;
          max_premium: number | null;
          min_premium: number | null;
          production_date: string | null;
          total_policies: number | null;
          total_premium: number | null;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "mv_daily_production";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_user_expense_summary: {
        Args: never;
        Returns: {
          avg_amount: number | null;
          category: string | null;
          expense_month: string | null;
          expense_type: Database["public"]["Enums"]["expense_type"] | null;
          max_amount: number | null;
          min_amount: number | null;
          recurring_amount: number | null;
          recurring_count: number | null;
          total_amount: number | null;
          transaction_count: number | null;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "mv_expense_summary";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_user_permissions: {
        Args: { target_user_id: string };
        Returns: {
          code: string;
        }[];
      };
      get_user_product_performance: {
        Args: never;
        Returns: {
          active_policies: number | null;
          avg_commission: number | null;
          avg_commission_rate_pct: number | null;
          avg_premium: number | null;
          lapsed_policies: number | null;
          persistency_rate: number | null;
          product_id: string | null;
          product_name: string | null;
          product_type: Database["public"]["Enums"]["product_type"] | null;
          total_commission: number | null;
          total_policies: number | null;
          total_premium: number | null;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "mv_product_performance";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_user_production_velocity: {
        Args: { p_limit?: number };
        Returns: {
          month_start: string | null;
          monthly_avg_premium: number | null;
          monthly_policies: number | null;
          monthly_premium: number | null;
          user_id: string | null;
          week_start: string | null;
          weekly_avg_premium: number | null;
          weekly_policies: number | null;
          weekly_premium: number | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "mv_production_velocity";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_user_profile: {
        Args: { user_id: string };
        Returns: {
          agent_code: string;
          contract_comp_level: number;
          created_at: string;
          email: string;
          id: string;
          is_active: boolean;
          license_number: string;
          license_state: string;
          name: string;
          notes: string;
          phone: string;
          updated_at: string;
        }[];
      };
      get_user_subscription_tier: {
        Args: { p_user_id: string };
        Returns: string;
      };
      get_user_upline_and_recruiter_ids: {
        Args: { user_id: string };
        Returns: {
          recruiter_id: string;
          upline_id: string;
        }[];
      };
      get_uw_wizard_usage: {
        Args: { p_user_id: string };
        Returns: {
          billing_period_end: string;
          billing_period_start: string;
          runs_limit: number;
          runs_remaining: number;
          runs_used: number;
          source: string;
          tier_id: string;
          tier_name: string;
          usage_percent: number;
        }[];
      };
      get_valid_users_for_rule: {
        Args: { p_rule_id: string; p_user_ids: string[] };
        Returns: string[];
      };
      get_vendors_with_stats: {
        Args: { p_imo_id?: string; p_include_inactive?: boolean };
        Returns: {
          contact_email: string;
          contact_name: string;
          contact_phone: string;
          created_at: string;
          created_by: string;
          total_purchases: number;
          total_spent: number;
          unique_users: number;
          vendor_id: string;
          vendor_name: string;
          website: string;
        }[];
      };
      get_workflow_email_usage: { Args: { p_user_id: string }; Returns: Json };
      getuser_commission_profile:
        | {
            Args: { p_user_id?: string };
            Returns: {
              active_policies: number;
              agency_id: string;
              agency_name: string;
              avg_commission_per_policy: number;
              contract_level: number;
              recent_policies: Json;
              total_chargebacks: number;
              total_earned: number;
              total_policies: number;
              total_unearned: number;
              user_email: string;
              user_id: string;
              user_name: string;
              ytd_earned: number;
            }[];
          }
        | {
            Args: { p_lookback_months?: number; puser_id: string };
            Returns: {
              calculated_at: string;
              contract_level: number;
              data_quality: string;
              product_breakdown: Json;
              simple_avg_rate: number;
              weighted_avg_rate: number;
            }[];
          };
      graduate_recruit_to_agent: {
        Args: {
          p_contract_level: number;
          p_notes?: string;
          p_recruit_id: string;
        };
        Returns: Json;
      };
      hard_delete_user: {
        Args: {
          p_confirm_text: string;
          p_deleted_by: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      has_downlines: { Args: never; Returns: boolean };
      has_permission: {
        Args: { permission_code: string; target_user_id: string };
        Returns: boolean;
      };
      has_role:
        | { Args: { role_to_check: string }; Returns: boolean }
        | {
            Args: { role_name: string; target_user_id: string };
            Returns: boolean;
          };
      has_subscription_bypass: { Args: never; Returns: boolean };
      health_class_rank: {
        Args: { hc: Database["public"]["Enums"]["health_class"] };
        Returns: number;
      };
      hierarchy_path_array: { Args: { path: string }; Returns: string[] };
      increment_email_quota: {
        Args: { p_provider: string; p_user_id: string };
        Returns: number;
      };
      increment_template_usage: {
        Args: { p_template_id: string };
        Returns: undefined;
      };
      increment_template_use_count: {
        Args: { p_template_id: string };
        Returns: undefined;
      };
      increment_usage: {
        Args: { p_increment?: number; p_metric: string; p_user_id: string };
        Returns: number;
      };
      increment_uw_wizard_usage: {
        Args: {
          p_imo_id: string;
          p_input_tokens?: number;
          p_output_tokens?: number;
          p_session_id?: string;
          p_user_id: string;
        };
        Returns: {
          new_runs_used: number;
          runs_remaining: number;
          success: boolean;
        }[];
      };
      initialize_recruit_progress: {
        Args: { p_template_id: string; p_user_id: string };
        Returns: Json;
      };
      invoke_ai_smart_view_sync: { Args: never; Returns: undefined };
      invoke_slack_auto_complete_first_sale: {
        Args: never;
        Returns: undefined;
      };
      is_admin: { Args: never; Returns: boolean };
      is_admin_user:
        | { Args: never; Returns: boolean }
        | { Args: { target_user_id?: string }; Returns: boolean };
      is_agency_owner:
        | { Args: never; Returns: boolean }
        | { Args: { p_agency_id?: string }; Returns: boolean };
      is_agency_owner_of: {
        Args: { target_agency_id: string };
        Returns: boolean;
      };
      is_caller_admin: { Args: never; Returns: boolean };
      is_contact_favorited: {
        Args: {
          p_client_id?: string;
          p_contact_user_id?: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      is_direct_downline_of_owner: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      is_elevenlabs_available: { Args: { p_imo_id: string }; Returns: boolean };
      is_imo_admin: { Args: never; Returns: boolean };
      is_imo_admin_for: { Args: { p_imo_id: string }; Returns: boolean };
      is_imo_staff_role: { Args: never; Returns: boolean };
      is_same_agency: { Args: { target_user_id: string }; Returns: boolean };
      is_same_imo: { Args: { target_user_id: string }; Returns: boolean };
      is_staff_role: { Args: never; Returns: boolean };
      is_super_admin: { Args: never; Returns: boolean };
      is_training_hub_staff: { Args: { user_id: string }; Returns: boolean };
      is_training_module_manager: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      is_underwriting_wizard_enabled: {
        Args: { p_agency_id: string };
        Returns: boolean;
      };
      is_upline_of: { Args: { target_user_id: string }; Returns: boolean };
      is_user_approved: { Args: never; Returns: boolean };
      list_agency_underwriting_sessions_v1: {
        Args: { p_page?: number; p_page_size?: number; p_search?: string };
        Returns: {
          client_age: number;
          client_gender: string;
          client_name: string;
          client_state: string;
          created_at: string;
          eligibility_summary: Json;
          health_tier: string;
          requested_face_amount: number;
          requested_face_amounts: Json;
          requested_product_types: string[];
          result_source: string;
          selected_term_years: number;
          session_id: string;
          top_recommendation: Json;
          total_count: number;
        }[];
      };
      list_my_underwriting_sessions_v1: {
        Args: { p_page?: number; p_page_size?: number; p_search?: string };
        Returns: {
          client_age: number;
          client_gender: string;
          client_name: string;
          client_state: string;
          created_at: string;
          eligibility_summary: Json;
          health_tier: string;
          requested_face_amount: number;
          requested_face_amounts: Json;
          requested_product_types: string[];
          result_source: string;
          selected_term_years: number;
          session_id: string;
          top_recommendation: Json;
          total_count: number;
        }[];
      };
      log_audit_event: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"];
          p_action_type: string;
          p_changed_fields?: string[];
          p_description?: string;
          p_metadata?: Json;
          p_new_data?: Json;
          p_old_data?: Json;
          p_record_id: string;
          p_table_name: string;
        };
        Returns: string;
      };
      log_underwriting_rule_evaluation: {
        Args: {
          p_condition_code: string;
          p_failed_conditions?: Json;
          p_input_hash?: string;
          p_matched_conditions?: Json;
          p_missing_fields?: Json;
          p_outcome_applied?: Json;
          p_predicate_result: string;
          p_rule_id: string;
          p_rule_set_id: string;
          p_session_id: string;
        };
        Returns: Json;
      };
      lookup_user_by_email: {
        Args: { p_email: string };
        Returns: {
          email: string;
          id: string;
          is_approved: boolean;
          upline_id: string;
        }[];
      };
      manage_team_uw_seat: {
        Args: { p_action: string; p_agent_id: string; p_owner_id: string };
        Returns: Json;
      };
      mark_invitation_sent: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      mark_policy_cancelled: {
        Args: {
          p_cancellation_date?: string;
          p_cancellation_reason?: string;
          p_policy_id: string;
        };
        Returns: Json;
      };
      mark_policy_lapsed: {
        Args: {
          p_lapse_date?: string;
          p_lapse_reason?: string;
          p_policy_id: string;
        };
        Returns: Json;
      };
      mark_thread_read: { Args: { p_thread_id: string }; Returns: undefined };
      merge_vendors: {
        Args: { p_keep_vendor_id: string; p_merge_vendor_ids: string[] };
        Returns: Json;
      };
      nextval: { Args: { sequence_name: string }; Returns: number };
      normalize_email_subject: { Args: { subject: string }; Returns: string };
      notify_user: {
        Args: {
          p_message?: string;
          p_metadata?: Json;
          p_title: string;
          p_type: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      persist_underwriting_run_v1: {
        Args: {
          p_actor_id: string;
          p_audit_rows?: Json;
          p_input: Json;
          p_result: Json;
        };
        Returns: Json;
      };
      process_pending_workflow_runs: {
        Args: never;
        Returns: {
          message: string;
          run_id: string;
          status: string;
          workflow_id: string;
        }[];
      };
      process_stripe_subscription_event: {
        Args: {
          p_billing_interval: string;
          p_cancelled_at: string;
          p_current_period_end: string;
          p_current_period_start: string;
          p_event_data: Json;
          p_event_name: string;
          p_event_type: string;
          p_status: string;
          p_stripe_checkout_session_id: string;
          p_stripe_customer_id: string;
          p_stripe_event_id: string;
          p_stripe_price_id: string;
          p_stripe_subscription_id: string;
          p_trial_ends_at: string;
          p_user_id: string;
        };
        Returns: string;
      };
      process_workflow_trigger: {
        Args: { p_context: Json; p_event_name: string };
        Returns: undefined;
      };
      rank_to_health_class: {
        Args: { rank: number };
        Returns: Database["public"]["Enums"]["health_class"];
      };
      recalculate_lead_purchase_roi: {
        Args: { p_lead_purchase_id: string };
        Returns: undefined;
      };
      record_alert_evaluation: {
        Args: {
          p_affected_entity_id?: string;
          p_affected_entity_type?: string;
          p_affected_user_id?: string;
          p_current_value: number;
          p_evaluation_context?: Json;
          p_notification_id?: string;
          p_rule_id: string;
          p_triggered: boolean;
        };
        Returns: {
          affected_entity_id: string | null;
          affected_entity_type: string | null;
          affected_user_id: string | null;
          comparison: Database["public"]["Enums"]["alert_comparison"];
          current_value: number | null;
          evaluated_at: string;
          evaluation_context: Json | null;
          id: string;
          notification_id: string | null;
          rule_id: string;
          threshold_value: number;
          triggered: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "alert_rule_evaluations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_email_click: {
        Args: {
          p_city?: string;
          p_country?: string;
          p_device_type?: string;
          p_ip_address?: unknown;
          p_link_tracking_id: string;
          p_user_agent?: string;
        };
        Returns: string;
      };
      record_email_open: {
        Args: {
          p_city?: string;
          p_country?: string;
          p_device_type?: string;
          p_ip_address?: unknown;
          p_tracking_id: string;
          p_user_agent?: string;
        };
        Returns: boolean;
      };
      record_stripe_payment: {
        Args: {
          p_amount: number;
          p_billing_reason: string;
          p_card_brand: string;
          p_card_last_four: string;
          p_currency: string;
          p_discount_amount: number;
          p_invoice_url: string;
          p_paid_at: string;
          p_receipt_url: string;
          p_status: string;
          p_stripe_invoice_id: string;
          p_stripe_payment_intent_id: string;
          p_stripe_subscription_id: string;
          p_tax_amount: number;
          p_user_id: string;
        };
        Returns: string;
      };
      record_uw_wizard_run: {
        Args: {
          p_imo_id: string;
          p_input_tokens?: number;
          p_output_tokens?: number;
          p_run_key: string;
          p_session_id?: string;
          p_user_id?: string;
        };
        Returns: {
          already_recorded: boolean;
          new_runs_used: number;
          runs_remaining: number;
          success: boolean;
        }[];
      };
      record_workflow_email: {
        Args: {
          p_error_message?: string;
          p_recipient_email: string;
          p_recipient_type: string;
          p_success?: boolean;
          p_user_id: string;
          p_workflow_id: string;
        };
        Returns: string;
      };
      refresh_all_report_materialized_views: {
        Args: never;
        Returns: undefined;
      };
      regenerate_override_commissions: {
        Args: { p_policy_id: string };
        Returns: number;
      };
      reject_acceptance_rule: {
        Args: { p_notes: string; p_rule_id: string };
        Returns: undefined;
      };
      reject_agency_request: {
        Args: { p_reason?: string; p_request_id: string };
        Returns: undefined;
      };
      reject_join_request: {
        Args: { p_reason?: string; p_request_id: string };
        Returns: undefined;
      };
      reject_recruiting_lead: {
        Args: { p_lead_id: string; p_reason?: string };
        Returns: Json;
      };
      reject_underwriting_rule_set: {
        Args: { p_notes: string; p_rule_set_id: string };
        Returns: Json;
      };
      release_alert_rules: { Args: { p_rule_ids: string[] }; Returns: number };
      resend_recruit_invitation: {
        Args: { p_invitation_id: string };
        Returns: Json;
      };
      resolve_join_request_approver: {
        Args: { p_agency_id?: string; p_imo_id: string; p_upline_id?: string };
        Returns: string;
      };
      revert_recruit_phase: {
        Args: { p_phase_id: string; p_user_id: string };
        Returns: Json;
      };
      revert_rule_set_to_draft: {
        Args: { p_rule_set_id: string };
        Returns: Json;
      };
      roadmap_move_item: {
        Args: {
          p_item_id: string;
          p_new_index: number;
          p_target_section_id: string;
        };
        Returns: undefined;
      };
      roadmap_reorder_items: {
        Args: { p_ordered_ids: string[]; p_section_id: string };
        Returns: undefined;
      };
      roadmap_reorder_sections: {
        Args: { p_ordered_ids: string[]; p_roadmap_id: string };
        Returns: undefined;
      };
      roadmap_reorder_templates: {
        Args: { p_agency_id: string; p_ordered_ids: string[] };
        Returns: undefined;
      };
      roadmap_set_default: {
        Args: { p_roadmap_id: string };
        Returns: undefined;
      };
      roadmap_update_progress_notes: {
        Args: { p_item_id: string; p_notes: string };
        Returns: {
          agency_id: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          item_id: string;
          notes: string | null;
          roadmap_id: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["roadmap_progress_status"];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "roadmap_item_progress";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      roadmap_upsert_progress: {
        Args: {
          p_item_id: string;
          p_notes?: string;
          p_status: Database["public"]["Enums"]["roadmap_progress_status"];
        };
        Returns: {
          agency_id: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          item_id: string;
          notes: string | null;
          roadmap_id: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["roadmap_progress_status"];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "roadmap_item_progress";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      safe_uuid_from_text: { Args: { input: string }; Returns: string };
      save_underwriting_session_v2: {
        Args: { p_payload: Json };
        Returns: Json;
      };
      save_workflow_as_org_template: {
        Args: { p_workflow_id: string };
        Returns: string;
      };
      search_users_for_assignment: {
        Args: {
          p_approval_status?: string;
          p_exclude_ids?: string[];
          p_limit?: number;
          p_roles?: string[];
          p_search_term?: string;
        };
        Returns: {
          agent_status: string;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          roles: string[];
        }[];
      };
      set_default_decision_tree: {
        Args: { p_imo_id: string; p_tree_id: string };
        Returns: undefined;
      };
      set_leaderboard_title: {
        Args: { p_log_id: string; p_title: string };
        Returns: boolean;
      };
      set_leaderboard_title_batch: {
        Args: {
          p_first_sale_group_id: string;
          p_title: string;
          p_user_id?: string;
        };
        Returns: {
          log_ids: string[];
          updated_count: number;
        }[];
      };
      submit_recruit_registration: {
        Args: { p_auth_user_id?: string; p_data: Json; p_token: string };
        Returns: Json;
      };
      submit_recruiting_lead: {
        Args: {
          p_availability: string;
          p_city: string;
          p_current_imo_name?: string;
          p_email: string;
          p_first_name: string;
          p_income_goals?: string;
          p_insurance_experience?: string;
          p_ip_address?: unknown;
          p_is_licensed?: boolean;
          p_last_name: string;
          p_phone: string;
          p_recruiter_slug: string;
          p_referrer_url?: string;
          p_specialties?: string[];
          p_state: string;
          p_user_agent?: string;
          p_utm_campaign?: string;
          p_utm_medium?: string;
          p_utm_source?: string;
          p_why_interested?: string;
        };
        Returns: Json;
      };
      submit_rule_set_for_review: {
        Args: { p_rule_set_id: string };
        Returns: Json;
      };
      submit_training_quiz_attempt: {
        Args: {
          p_answers: Json;
          p_quiz_id: string;
          p_time_taken_seconds: number;
        };
        Returns: Json;
      };
      table_rating_units: {
        Args: { rating: Database["public"]["Enums"]["table_rating"] };
        Returns: number;
      };
      toggle_agent_carrier_contract: {
        Args: { p_active: boolean; p_carrier_id: string };
        Returns: {
          out_agent_id: string;
          out_approved_date: string;
          out_carrier_id: string;
          out_id: string;
          out_status: string;
          out_writing_number: string;
        }[];
      };
      toggle_alert_rule_active: {
        Args: { p_is_active: boolean; p_rule_id: string };
        Returns: {
          agency_id: string | null;
          applies_to_downlines: boolean;
          applies_to_self: boolean;
          applies_to_team: boolean;
          comparison: Database["public"]["Enums"]["alert_comparison"];
          consecutive_triggers: number;
          cooldown_hours: number;
          created_at: string;
          description: string | null;
          id: string;
          imo_id: string | null;
          is_active: boolean;
          last_triggered_at: string | null;
          metric: Database["public"]["Enums"]["alert_metric"];
          name: string;
          notify_email: boolean;
          notify_in_app: boolean;
          owner_id: string;
          threshold_unit: string | null;
          threshold_value: number;
          trigger_count: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "alert_rules";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      toggle_visible_agent_carrier_contract: {
        Args: {
          p_active: boolean;
          p_carrier_id: string;
          p_target_agent_id: string;
        };
        Returns: {
          out_agent_id: string;
          out_approved_date: string;
          out_carrier_id: string;
          out_id: string;
          out_status: string;
          out_writing_number: string;
        }[];
      };
      trigger_workflows_for_event: {
        Args: { context_data: Json; event_name_param: string };
        Returns: undefined;
      };
      unenroll_from_pipeline: {
        Args: { target_user_id: string };
        Returns: Json;
      };
      units_to_table_rating: {
        Args: { units: number };
        Returns: Database["public"]["Enums"]["table_rating"];
      };
      update_alert_rule: {
        Args: {
          p_applies_to_downlines?: boolean;
          p_applies_to_self?: boolean;
          p_applies_to_team?: boolean;
          p_cooldown_hours?: number;
          p_description?: string;
          p_is_active?: boolean;
          p_name?: string;
          p_notify_email?: boolean;
          p_notify_in_app?: boolean;
          p_rule_id: string;
          p_threshold_unit?: string;
          p_threshold_value?: number;
        };
        Returns: {
          agency_id: string | null;
          applies_to_downlines: boolean;
          applies_to_self: boolean;
          applies_to_team: boolean;
          comparison: Database["public"]["Enums"]["alert_comparison"];
          consecutive_triggers: number;
          cooldown_hours: number;
          created_at: string;
          description: string | null;
          id: string;
          imo_id: string | null;
          is_active: boolean;
          last_triggered_at: string | null;
          metric: Database["public"]["Enums"]["alert_metric"];
          name: string;
          notify_email: boolean;
          notify_in_app: boolean;
          owner_id: string;
          threshold_unit: string | null;
          threshold_value: number;
          trigger_count: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "alert_rules";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_daily_leaderboard_title: {
        Args: { p_log_id: string; p_title: string; p_user_id: string };
        Returns: boolean;
      };
      update_lead_discovery_call: {
        Args: {
          p_call_url?: string;
          p_lead_id: string;
          p_scheduled_at: string;
        };
        Returns: Json;
      };
      update_lead_purchase_with_expense: {
        Args: {
          p_commission_earned?: number;
          p_lead_count: number;
          p_lead_freshness?: Database["public"]["Enums"]["lead_freshness"];
          p_notes?: string;
          p_policies_sold?: number;
          p_purchase_date: string;
          p_purchase_id: string;
          p_purchase_name?: string;
          p_total_cost: number;
          p_vendor_id: string;
        };
        Returns: string;
      };
      update_my_notification_preferences: {
        Args: {
          p_browser_push_enabled?: boolean;
          p_email_digest_enabled?: boolean;
          p_email_digest_frequency?: string;
          p_email_digest_time?: string;
          p_email_digest_timezone?: string;
          p_in_app_enabled?: boolean;
          p_quiet_hours_enabled?: boolean;
          p_quiet_hours_end?: string;
          p_quiet_hours_start?: string;
        };
        Returns: {
          browser_push_enabled: boolean | null;
          browser_push_subscription: Json | null;
          created_at: string | null;
          email_digest_enabled: boolean | null;
          email_digest_frequency: string | null;
          email_digest_time: string | null;
          email_digest_timezone: string | null;
          id: string;
          in_app_enabled: boolean | null;
          last_digest_sent_at: string | null;
          notify_on_click: boolean | null;
          notify_on_open: boolean | null;
          notify_on_reply: boolean | null;
          quiet_hours_enabled: boolean | null;
          quiet_hours_end: string | null;
          quiet_hours_start: string | null;
          updated_at: string | null;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "notification_preferences";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_override_earned_amount: {
        Args: { p_months_paid: number; p_policy_id: string };
        Returns: undefined;
      };
      update_own_presentation: {
        Args: { p_description?: string; p_id: string; p_title?: string };
        Returns: undefined;
      };
      update_scheduled_report: {
        Args: {
          p_day_of_month?: number;
          p_day_of_week?: number;
          p_export_format?: string;
          p_frequency?: Database["public"]["Enums"]["report_frequency"];
          p_include_charts?: boolean;
          p_include_insights?: boolean;
          p_include_summary?: boolean;
          p_is_active?: boolean;
          p_preferred_time?: string;
          p_recipients?: Json;
          p_report_config?: Json;
          p_schedule_id: string;
          p_schedule_name?: string;
        };
        Returns: boolean;
      };
      update_training_streak: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      update_user_metadata: {
        Args: { metadata: Json; user_id: string };
        Returns: undefined;
      };
      user_can_view_team_tab: { Args: never; Returns: boolean };
      user_has_analytics_section: {
        Args: { p_section: string; p_user_id: string };
        Returns: boolean;
      };
      user_has_feature: {
        Args: { p_feature: string; p_user_id: string };
        Returns: boolean;
      };
      user_has_instagram_access: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      user_has_uw_wizard_access: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      validate_field_requirements: {
        Args: { p_requirements: Json };
        Returns: boolean;
      };
      validate_hierarchy_change: {
        Args: { p_agent_id: string; p_new_upline_id: string };
        Returns: Json;
      };
      validate_invitation_acceptance: {
        Args: { p_invitation_id: string; p_invitee_id: string };
        Returns: {
          error_message: string;
          valid: boolean;
        }[];
      };
      validate_invitation_eligibility: {
        Args: {
          p_exclude_invitation_id?: string;
          p_invitee_email: string;
          p_inviter_id: string;
        };
        Returns: Json;
      };
      validate_report_date_range: {
        Args: {
          p_end_date: string;
          p_max_months?: number;
          p_start_date: string;
        };
        Returns: undefined;
      };
      validate_schedule_recipients: {
        Args: { p_agency_id: string; p_imo_id: string; p_recipients: Json };
        Returns: boolean;
      };
      validate_social_links_urls: { Args: { links: Json }; Returns: boolean };
      validate_template_content_for_platform: {
        Args: { p_content: string; p_platform: string };
        Returns: boolean;
      };
    };
    Enums: {
      agent_status: "unlicensed" | "licensed" | "not_applicable";
      alert_comparison: "lt" | "lte" | "gt" | "gte" | "eq";
      alert_metric:
        | "policy_lapse_warning"
        | "target_miss_risk"
        | "commission_threshold"
        | "new_policy_count"
        | "recruit_stall"
        | "override_change"
        | "team_production_drop"
        | "persistency_warning"
        | "license_expiration";
      audit_action: "INSERT" | "UPDATE" | "DELETE";
      audit_source: "trigger" | "application";
      automation_communication_type:
        | "email"
        | "notification"
        | "both"
        | "sms"
        | "all";
      automation_recipient_type:
        | "recruit"
        | "upline"
        | "trainer"
        | "contracting_manager"
        | "custom_email";
      chargeback_status: "pending" | "resolved" | "disputed";
      commission_status:
        | "pending"
        | "unpaid"
        | "paid"
        | "reversed"
        | "disputed"
        | "clawback"
        | "charged_back";
      comp_level: "street" | "release" | "enhanced" | "premium";
      custom_domain_status:
        | "draft"
        | "pending_dns"
        | "verified"
        | "provisioning"
        | "active"
        | "error";
      expense_category:
        | "insurance_leads"
        | "software_tools"
        | "office_remote"
        | "professional_services"
        | "marketing"
        | "uncategorized";
      expense_type: "personal" | "business";
      file_type: "csv" | "pdf" | "xlsx";
      gmail_connection_status:
        | "connected"
        | "disconnected"
        | "expired"
        | "error";
      health_class:
        | "preferred_plus"
        | "preferred"
        | "standard_plus"
        | "standard"
        | "substandard"
        | "graded"
        | "modified"
        | "guaranteed_issue"
        | "refer"
        | "decline"
        | "unknown";
      instagram_connection_status:
        | "connected"
        | "disconnected"
        | "expired"
        | "error";
      instagram_job_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "expired";
      instagram_job_type:
        | "download_profile_picture"
        | "download_message_media"
        | "send_scheduled_message"
        | "refresh_participant_metadata";
      instagram_message_status:
        | "pending"
        | "sent"
        | "delivered"
        | "read"
        | "failed";
      instagram_message_type:
        | "text"
        | "media"
        | "story_reply"
        | "story_mention";
      insurance_product_type:
        | "term_life"
        | "whole_life"
        | "universal_life"
        | "final_expense"
        | "indexed_universal_life"
        | "variable_life";
      lead_freshness: "fresh" | "aged";
      lead_source_type: "lead_purchase" | "free_lead" | "other";
      message_direction: "inbound" | "outbound";
      payment_frequency: "monthly" | "quarterly" | "semi_annual" | "annual";
      pipeline_automation_trigger:
        | "phase_enter"
        | "phase_complete"
        | "phase_stall"
        | "item_complete"
        | "item_approval_needed"
        | "item_deadline_approaching"
        | "password_not_set_24h"
        | "password_not_set_12h";
      policy_status: "active" | "pending" | "lapsed" | "cancelled" | "expired";
      product_type:
        | "term_life"
        | "whole_life"
        | "universal_life"
        | "variable_life"
        | "health"
        | "disability"
        | "annuity"
        | "indexed_universal_life"
        | "participating_whole_life";
      report_frequency: "weekly" | "monthly" | "quarterly";
      roadmap_progress_status:
        | "not_started"
        | "in_progress"
        | "completed"
        | "skipped";
      rule_review_status: "draft" | "pending_review" | "approved" | "rejected";
      rule_set_scope: "condition" | "global";
      rule_source_type: "generic_template" | "carrier_document" | "manual";
      scheduled_message_status:
        | "pending"
        | "sent"
        | "cancelled"
        | "failed"
        | "expired";
      slack_connection_status:
        | "connected"
        | "disconnected"
        | "error"
        | "pending";
      slack_message_status:
        | "pending"
        | "sent"
        | "delivered"
        | "failed"
        | "retrying";
      slack_notification_type:
        | "policy_created"
        | "policy_cancelled"
        | "policy_renewed"
        | "daily_leaderboard"
        | "weekly_summary"
        | "commission_milestone"
        | "agent_achievement"
        | "new_recruit"
        | "npn_received";
      table_rating:
        | "none"
        | "A"
        | "B"
        | "C"
        | "D"
        | "E"
        | "F"
        | "G"
        | "H"
        | "I"
        | "J"
        | "K"
        | "L"
        | "M"
        | "N"
        | "O"
        | "P";
    };
    CompositeTypes: {
      knockout_condition_def: {
        code: string | null;
        name: string | null;
        severity: string | null;
        default_reason: string | null;
      };
      org_chart_node: {
        id: string | null;
        node_type: string | null;
        name: string | null;
        code: string | null;
        parent_id: string | null;
        depth: number | null;
        agent_count: number | null;
        active_policy_count: number | null;
        total_annual_premium: number | null;
        total_commissions_ytd: number | null;
        avg_contract_level: number | null;
        email: string | null;
        contract_level: number | null;
        agent_status: string | null;
        profile_photo_url: string | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      agent_status: ["unlicensed", "licensed", "not_applicable"],
      alert_comparison: ["lt", "lte", "gt", "gte", "eq"],
      alert_metric: [
        "policy_lapse_warning",
        "target_miss_risk",
        "commission_threshold",
        "new_policy_count",
        "recruit_stall",
        "override_change",
        "team_production_drop",
        "persistency_warning",
        "license_expiration",
      ],
      audit_action: ["INSERT", "UPDATE", "DELETE"],
      audit_source: ["trigger", "application"],
      automation_communication_type: [
        "email",
        "notification",
        "both",
        "sms",
        "all",
      ],
      automation_recipient_type: [
        "recruit",
        "upline",
        "trainer",
        "contracting_manager",
        "custom_email",
      ],
      chargeback_status: ["pending", "resolved", "disputed"],
      commission_status: [
        "pending",
        "unpaid",
        "paid",
        "reversed",
        "disputed",
        "clawback",
        "charged_back",
      ],
      comp_level: ["street", "release", "enhanced", "premium"],
      custom_domain_status: [
        "draft",
        "pending_dns",
        "verified",
        "provisioning",
        "active",
        "error",
      ],
      expense_category: [
        "insurance_leads",
        "software_tools",
        "office_remote",
        "professional_services",
        "marketing",
        "uncategorized",
      ],
      expense_type: ["personal", "business"],
      file_type: ["csv", "pdf", "xlsx"],
      gmail_connection_status: [
        "connected",
        "disconnected",
        "expired",
        "error",
      ],
      health_class: [
        "preferred_plus",
        "preferred",
        "standard_plus",
        "standard",
        "substandard",
        "graded",
        "modified",
        "guaranteed_issue",
        "refer",
        "decline",
        "unknown",
      ],
      instagram_connection_status: [
        "connected",
        "disconnected",
        "expired",
        "error",
      ],
      instagram_job_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "expired",
      ],
      instagram_job_type: [
        "download_profile_picture",
        "download_message_media",
        "send_scheduled_message",
        "refresh_participant_metadata",
      ],
      instagram_message_status: [
        "pending",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
      instagram_message_type: ["text", "media", "story_reply", "story_mention"],
      insurance_product_type: [
        "term_life",
        "whole_life",
        "universal_life",
        "final_expense",
        "indexed_universal_life",
        "variable_life",
      ],
      lead_freshness: ["fresh", "aged"],
      lead_source_type: ["lead_purchase", "free_lead", "other"],
      message_direction: ["inbound", "outbound"],
      payment_frequency: ["monthly", "quarterly", "semi_annual", "annual"],
      pipeline_automation_trigger: [
        "phase_enter",
        "phase_complete",
        "phase_stall",
        "item_complete",
        "item_approval_needed",
        "item_deadline_approaching",
        "password_not_set_24h",
        "password_not_set_12h",
      ],
      policy_status: ["active", "pending", "lapsed", "cancelled", "expired"],
      product_type: [
        "term_life",
        "whole_life",
        "universal_life",
        "variable_life",
        "health",
        "disability",
        "annuity",
        "indexed_universal_life",
        "participating_whole_life",
      ],
      report_frequency: ["weekly", "monthly", "quarterly"],
      roadmap_progress_status: [
        "not_started",
        "in_progress",
        "completed",
        "skipped",
      ],
      rule_review_status: ["draft", "pending_review", "approved", "rejected"],
      rule_set_scope: ["condition", "global"],
      rule_source_type: ["generic_template", "carrier_document", "manual"],
      scheduled_message_status: [
        "pending",
        "sent",
        "cancelled",
        "failed",
        "expired",
      ],
      slack_connection_status: [
        "connected",
        "disconnected",
        "error",
        "pending",
      ],
      slack_message_status: [
        "pending",
        "sent",
        "delivered",
        "failed",
        "retrying",
      ],
      slack_notification_type: [
        "policy_created",
        "policy_cancelled",
        "policy_renewed",
        "daily_leaderboard",
        "weekly_summary",
        "commission_milestone",
        "agent_achievement",
        "new_recruit",
        "npn_received",
      ],
      table_rating: [
        "none",
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
      ],
    },
  },
} as const;
