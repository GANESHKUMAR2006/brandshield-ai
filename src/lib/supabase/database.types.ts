export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VerificationStatus =
  | "supported"
  | "contradicted"
  | "outdated"
  | "unverified"
  | "needs_review";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ReviewDecisionType = "approved" | "rejected" | "escalated" | "modified";

export type ReviewStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "modified"
  | "escalated";

export type ReviewerRole = "admin" | "compliance_reviewer" | "legal_reviewer" | "viewer";

export type EscalationCategory =
  | "legal"
  | "regulatory"
  | "clinical"
  | "brand_compliance"
  | "evidence_conflict"
  | "other";

export type PublicationStatus = "ineligible" | "eligible" | "published";

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          sku: string;
          description: string | null;
          category: string;
          reference_price: number;
          currency: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          sku: string;
          description?: string | null;
          category?: string;
          reference_price: number;
          currency?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          sku?: string;
          description?: string | null;
          category?: string;
          reference_price?: number;
          currency?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      approved_facts: {
        Row: {
          id: string;
          product_id: string;
          fact_key: string;
          fact_value: Json;
          fact_type: string;
          approval_status: string;
          source_document_id: string | null;
          valid_from: string;
          valid_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          fact_key: string;
          fact_value: Json;
          fact_type: string;
          approval_status?: string;
          source_document_id?: string | null;
          valid_from?: string;
          valid_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          fact_key?: string;
          fact_value?: Json;
          fact_type?: string;
          approval_status?: string;
          source_document_id?: string | null;
          valid_from?: string;
          valid_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      promotions: {
        Row: {
          id: string;
          product_id: string;
          promotion_name: string;
          discount_type: string;
          discount_value: number;
          resulting_price: number;
          currency: string;
          start_date: string;
          end_date: string;
          applicable_channels: Json;
          terms: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          promotion_name: string;
          discount_type: string;
          discount_value: number;
          resulting_price: number;
          currency?: string;
          start_date: string;
          end_date: string;
          applicable_channels?: Json;
          terms?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          promotion_name?: string;
          discount_type?: string;
          discount_value?: number;
          resulting_price?: number;
          currency?: string;
          start_date?: string;
          end_date?: string;
          applicable_channels?: Json;
          terms?: string | null;
          status?: string;
          created_at?: string;
        };
      };
      source_documents: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          document_type: string;
          description: string | null;
          current_version_id: string | null;
          approval_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title: string;
          document_type: string;
          description?: string | null;
          current_version_id?: string | null;
          approval_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          title?: string;
          document_type?: string;
          description?: string | null;
          current_version_id?: string | null;
          approval_status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      document_versions: {
        Row: {
          id: string;
          source_document_id: string;
          version_number: number;
          storage_path: string;
          content_hash: string;
          approval_date: string | null;
          valid_from: string;
          valid_until: string | null;
          superseded_at: string | null;
          approval_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_document_id: string;
          version_number?: number;
          storage_path: string;
          content_hash: string;
          approval_date?: string | null;
          valid_from?: string;
          valid_until?: string | null;
          superseded_at?: string | null;
          approval_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_document_id?: string;
          version_number?: number;
          storage_path?: string;
          content_hash?: string;
          approval_date?: string | null;
          valid_from?: string;
          valid_until?: string | null;
          superseded_at?: string | null;
          approval_status?: string;
          created_at?: string;
        };
      };
      document_chunks: {
        Row: {
          id: string;
          document_version_id: string;
          chunk_index: number;
          content: string;
          embedding: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_version_id: string;
          chunk_index: number;
          content: string;
          embedding?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_version_id?: string;
          chunk_index?: number;
          content?: string;
          embedding?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      submissions: {
        Row: {
          id: string;
          workspace_id: string;
          product_id: string | null;
          title: string;
          content: string;
          channel: string;
          status: string;
          submitted_by: string;
          submission_date: string;
          publication_status: PublicationStatus;
          publication_eligibility_details: Json;
          last_reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          product_id?: string | null;
          title: string;
          content: string;
          channel: string;
          status?: string;
          submitted_by: string;
          submission_date?: string;
          publication_status?: PublicationStatus;
          publication_eligibility_details?: Json;
          last_reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          product_id?: string | null;
          title?: string;
          content?: string;
          channel?: string;
          status?: string;
          submitted_by?: string;
          submission_date?: string;
          publication_status?: PublicationStatus;
          publication_eligibility_details?: Json;
          last_reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      submission_versions: {
        Row: {
          id: string;
          submission_id: string;
          version_number: number;
          content: string;
          created_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          version_number?: number;
          content: string;
          created_at?: string;
          created_by: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          version_number?: number;
          content?: string;
          created_at?: string;
          created_by?: string;
        };
      };
      claims: {
        Row: {
          id: string;
          submission_id: string;
          submission_version_id: string;
          extraction_run_id: string | null;
          claim_text: string;
          claim_type: string;
          text_start: number | null;
          text_end: number | null;
          product_id: string | null;
          extracted_entities: Json;
          extraction_confidence: number;
          verification_status: VerificationStatus;
          risk_level: RiskLevel | null;
          verified_at: string | null;
          evidence_sufficiency: string | null;
          explanation: string | null;
          suggested_correction: string | null;
          review_status: ReviewStatus;
          assigned_reviewer: string | null;
          last_reviewed_at: string | null;
          review_notes: string | null;
          original_claim_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          submission_version_id: string;
          extraction_run_id?: string | null;
          claim_text: string;
          claim_type?: string;
          text_start?: number | null;
          text_end?: number | null;
          product_id?: string | null;
          extracted_entities?: Json;
          extraction_confidence?: number;
          verification_status?: VerificationStatus;
          risk_level?: RiskLevel | null;
          verified_at?: string | null;
          evidence_sufficiency?: string | null;
          explanation?: string | null;
          suggested_correction?: string | null;
          review_status?: ReviewStatus;
          assigned_reviewer?: string | null;
          last_reviewed_at?: string | null;
          review_notes?: string | null;
          original_claim_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          submission_version_id?: string;
          extraction_run_id?: string | null;
          claim_text?: string;
          claim_type?: string;
          text_start?: number | null;
          text_end?: number | null;
          product_id?: string | null;
          extracted_entities?: Json;
          extraction_confidence?: number;
          verification_status?: VerificationStatus;
          risk_level?: RiskLevel | null;
          verified_at?: string | null;
          evidence_sufficiency?: string | null;
          explanation?: string | null;
          suggested_correction?: string | null;
          review_status?: ReviewStatus;
          assigned_reviewer?: string | null;
          last_reviewed_at?: string | null;
          review_notes?: string | null;
          original_claim_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      claim_evidence: {
        Row: {
          id: string;
          claim_id: string;
          document_version_id: string | null;
          approved_fact_id: string | null;
          evidence_excerpt: string;
          relevance_score: number;
          evidence_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          document_version_id?: string | null;
          approved_fact_id?: string | null;
          evidence_excerpt: string;
          relevance_score?: number;
          evidence_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string;
          document_version_id?: string | null;
          approved_fact_id?: string | null;
          evidence_excerpt?: string;
          relevance_score?: number;
          evidence_type?: string;
          created_at?: string;
        };
      };
      verification_runs: {
        Row: {
          id: string;
          claim_id: string;
          engine_version: string;
          verification_status: VerificationStatus;
          risk_level: RiskLevel;
          explanation: string;
          evidence_snapshot: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          engine_version?: string;
          verification_status: VerificationStatus;
          risk_level: RiskLevel;
          explanation: string;
          evidence_snapshot: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string;
          engine_version?: string;
          verification_status?: VerificationStatus;
          risk_level?: RiskLevel;
          explanation?: string;
          evidence_snapshot?: Json;
          created_at?: string;
        };
      };
      review_decisions: {
        Row: {
          id: string;
          claim_id: string;
          reviewer_id: string;
          decision: ReviewDecisionType;
          comments: string | null;
          workspace_id: string;
          submission_id: string;
          reviewer_role: ReviewerRole;
          verification_run_id: string | null;
          original_claim_text: string | null;
          modified_claim_text: string | null;
          escalation_category: EscalationCategory | null;
          override_reason: string | null;
          previous_workflow_state: string | null;
          new_workflow_state: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          reviewer_id: string;
          decision: ReviewDecisionType;
          comments?: string | null;
          workspace_id: string;
          submission_id: string;
          reviewer_role?: ReviewerRole;
          verification_run_id?: string | null;
          original_claim_text?: string | null;
          modified_claim_text?: string | null;
          escalation_category?: EscalationCategory | null;
          override_reason?: string | null;
          previous_workflow_state?: string | null;
          new_workflow_state?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string;
          reviewer_id?: string;
          decision?: ReviewDecisionType;
          comments?: string | null;
          workspace_id?: string;
          submission_id?: string;
          reviewer_role?: ReviewerRole;
          verification_run_id?: string | null;
          original_claim_text?: string | null;
          modified_claim_text?: string | null;
          escalation_category?: EscalationCategory | null;
          override_reason?: string | null;
          previous_workflow_state?: string | null;
          new_workflow_state?: string;
          created_at?: string;
        };
      };
      extraction_runs: {
        Row: {
          id: string;
          workspace_id: string;
          submission_id: string;
          submission_version_id: string;
          provider: string;
          model_identifier: string;
          prompt_version: string;
          status: "running" | "completed" | "failed";
          claims_count: number;
          error_message: string | null;
          raw_output: Json | null;
          metadata: Json;
          started_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          submission_id: string;
          submission_version_id: string;
          provider: string;
          model_identifier: string;
          prompt_version?: string;
          status?: "running" | "completed" | "failed";
          claims_count?: number;
          error_message?: string | null;
          raw_output?: Json | null;
          metadata?: Json;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          submission_id?: string;
          submission_version_id?: string;
          provider?: string;
          model_identifier?: string;
          prompt_version?: string;
          status?: "running" | "completed" | "failed";
          claims_count?: number;
          error_message?: string | null;
          raw_output?: Json | null;
          metadata?: Json;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
      };
      audit_events: {
        Row: {
          id: string;
          workspace_id: string;
          actor_id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          before_state: Json | null;
          after_state: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          actor_id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          before_state?: Json | null;
          after_state?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          actor_id?: string;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          before_state?: Json | null;
          after_state?: Json | null;
          created_at?: string;
        };
      };
    };
  };
}
