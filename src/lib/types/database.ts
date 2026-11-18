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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          action: string
          actioned_at: string
          actioned_by: string
          comments: string | null
          id: string
          org_id: string
          ref_id: string
          ref_type: string
        }
        Insert: {
          action: string
          actioned_at?: string
          actioned_by: string
          comments?: string | null
          id?: string
          org_id: string
          ref_id: string
          ref_type: string
        }
        Update: {
          action?: string
          actioned_at?: string
          actioned_by?: string
          comments?: string | null
          id?: string
          org_id?: string
          ref_id?: string
          ref_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_actioned_by_fkey"
            columns: ["actioned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          org_id: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      bank_clearings: {
        Row: {
          bank_date: string
          doc_id: string
          doc_type: string
          id: string
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bank_date: string
          doc_id: string
          doc_type: string
          id?: string
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bank_date?: string
          doc_id?: string
          doc_type?: string
          id?: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_clearings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_clearings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "bank_clearings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bom: {
        Row: {
          component_id: string
          created_at: string
          created_by: string | null
          finished_item_id: string
          id: string
          is_active: boolean
          notes: string | null
          org_id: string
          qty_per_unit: number
          unit_id: string | null
        }
        Insert: {
          component_id: string
          created_at?: string
          created_by?: string | null
          finished_item_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          org_id: string
          qty_per_unit: number
          unit_id?: string | null
        }
        Update: {
          component_id?: string
          created_at?: string
          created_by?: string | null
          finished_item_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          org_id?: string
          qty_per_unit?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_org_component_fk"
            columns: ["org_id", "component_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "bom_org_component_fk"
            columns: ["org_id", "component_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_component_fk"
            columns: ["org_id", "component_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_component_fk"
            columns: ["org_id", "component_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_component_fk"
            columns: ["org_id", "component_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_finished_item_fk"
            columns: ["org_id", "finished_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "bom_org_finished_item_fk"
            columns: ["org_id", "finished_item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_finished_item_fk"
            columns: ["org_id", "finished_item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_finished_item_fk"
            columns: ["org_id", "finished_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_finished_item_fk"
            columns: ["org_id", "finished_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "bom_org_unit_fk"
            columns: ["org_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          credit_days: number | null
          credit_limit: number | null
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          pincode: string | null
          state: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          credit_days?: number | null
          credit_limit?: number | null
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          credit_days?: number | null
          credit_limit?: number | null
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "clients_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "gst_states"
            referencedColumns: ["code"]
          },
        ]
      }
      credit_note_lines: {
        Row: {
          cgst_amount: number
          credit_note_id: string
          description: string
          gst_rate: number
          hsn_code: string | null
          id: string
          igst_amount: number
          invoice_line_id: string
          item_id: string
          line_total: number
          org_id: string
          qty: number | null
          rate: number | null
          sgst_amount: number
          sort_order: number
          taxable_value: number
          unit_name: string | null
        }
        Insert: {
          cgst_amount?: number
          credit_note_id: string
          description: string
          gst_rate: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          invoice_line_id: string
          item_id: string
          line_total: number
          org_id: string
          qty?: number | null
          rate?: number | null
          sgst_amount?: number
          sort_order: number
          taxable_value: number
          unit_name?: string | null
        }
        Update: {
          cgst_amount?: number
          credit_note_id?: string
          description?: string
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          invoice_line_id?: string
          item_id?: string
          line_total?: number
          org_id?: string
          qty?: number | null
          rate?: number | null
          sgst_amount?: number
          sort_order?: number
          taxable_value?: number
          unit_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_lines_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_invoice_line_id_fkey"
            columns: ["invoice_line_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "credit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "credit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "credit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "credit_note_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          buyer_gstin: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cgst_amount: number
          client_id: string
          created_at: string
          created_by: string | null
          credit_note_no: string
          financial_year: string
          id: string
          igst_amount: number
          invoice_id: string
          is_interstate: boolean
          note_date: string
          notes: string | null
          org_id: string
          place_of_supply: string
          reason: string
          restocked: boolean
          round_off: number
          sgst_amount: number
          status: string
          taxable_value: number
          total_amount: number
        }
        Insert: {
          buyer_gstin?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          credit_note_no: string
          financial_year: string
          id?: string
          igst_amount?: number
          invoice_id: string
          is_interstate: boolean
          note_date: string
          notes?: string | null
          org_id: string
          place_of_supply: string
          reason: string
          restocked?: boolean
          round_off?: number
          sgst_amount?: number
          status?: string
          taxable_value: number
          total_amount: number
        }
        Update: {
          buyer_gstin?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          credit_note_no?: string
          financial_year?: string
          id?: string
          igst_amount?: number
          invoice_id?: string
          is_interstate?: boolean
          note_date?: string
          notes?: string | null
          org_id?: string
          place_of_supply?: string
          reason?: string
          restocked?: boolean
          round_off?: number
          sgst_amount?: number
          status?: string
          taxable_value?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_receivables"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "credit_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_ageing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "credit_notes_place_of_supply_fkey"
            columns: ["place_of_supply"]
            isOneToOne: false
            referencedRelation: "gst_states"
            referencedColumns: ["code"]
          },
        ]
      }
      customer_receipts: {
        Row: {
          amount: number
          amount_allocated: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string
          created_at: string
          created_by: string | null
          financial_year: string
          id: string
          mode: string
          notes: string | null
          org_id: string
          receipt_date: string
          receipt_no: string
          reference: string | null
          so_id: string | null
          status: string
        }
        Insert: {
          amount: number
          amount_allocated?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          financial_year: string
          id?: string
          mode: string
          notes?: string | null
          org_id: string
          receipt_date: string
          receipt_no: string
          reference?: string | null
          so_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          amount_allocated?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          financial_year?: string
          id?: string
          mode?: string
          notes?: string | null
          org_id?: string
          receipt_date?: string
          receipt_no?: string
          reference?: string | null
          so_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_receipts_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_receivables"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "customer_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "customer_receipts_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "v_so_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      debit_note_lines: {
        Row: {
          bill_line_id: string
          debit_note_id: string
          gst_amount: number
          gst_percent: Database["public"]["Enums"]["gst_rate"]
          id: string
          item_id: string
          line_total: number
          org_id: string
          qty: number | null
          rate: number
          sort_order: number
          taxable_value: number
          unit_id: string
        }
        Insert: {
          bill_line_id: string
          debit_note_id: string
          gst_amount: number
          gst_percent: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id: string
          line_total: number
          org_id: string
          qty?: number | null
          rate: number
          sort_order: number
          taxable_value: number
          unit_id: string
        }
        Update: {
          bill_line_id?: string
          debit_note_id?: string
          gst_amount?: number
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id?: string
          line_total?: number
          org_id?: string
          qty?: number | null
          rate?: number
          sort_order?: number
          taxable_value?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debit_note_lines_bill_line_id_fkey"
            columns: ["bill_line_id"]
            isOneToOne: false
            referencedRelation: "supplier_bill_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_note_lines_debit_note_id_fkey"
            columns: ["debit_note_id"]
            isOneToOne: false
            referencedRelation: "debit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "debit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "debit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "debit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "debit_note_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_note_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "debit_note_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      debit_notes: {
        Row: {
          bill_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cgst_amount: number
          created_at: string
          created_by: string | null
          debit_note_no: string
          financial_year: string
          id: string
          igst_amount: number
          is_interstate: boolean
          note_date: string
          notes: string | null
          org_id: string
          reason: string
          returned_stock: boolean
          round_off: number
          sgst_amount: number
          status: string
          supplier_gstin: string | null
          supplier_id: string
          taxable_value: number
          total_amount: number
        }
        Insert: {
          bill_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          debit_note_no: string
          financial_year: string
          id?: string
          igst_amount?: number
          is_interstate?: boolean
          note_date: string
          notes?: string | null
          org_id: string
          reason: string
          returned_stock?: boolean
          round_off?: number
          sgst_amount?: number
          status?: string
          supplier_gstin?: string | null
          supplier_id: string
          taxable_value?: number
          total_amount?: number
        }
        Update: {
          bill_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          debit_note_no?: string
          financial_year?: string
          id?: string
          igst_amount?: number
          is_interstate?: boolean
          note_date?: string
          notes?: string | null
          org_id?: string
          reason?: string
          returned_stock?: boolean
          round_off?: number
          sgst_amount?: number
          status?: string
          supplier_gstin?: string | null
          supplier_id?: string
          taxable_value?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "debit_notes_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "supplier_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "v_bill_ageing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "debit_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payables"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      delivery_challan_lines: {
        Row: {
          challan_id: string
          id: string
          item_id: string
          line_total: number | null
          qty: number
          rate: number | null
          so_line_id: string | null
          unit_id: string
        }
        Insert: {
          challan_id: string
          id?: string
          item_id: string
          line_total?: number | null
          qty: number
          rate?: number | null
          so_line_id?: string | null
          unit_id: string
        }
        Update: {
          challan_id?: string
          id?: string
          item_id?: string
          line_total?: number | null
          qty?: number
          rate?: number | null
          so_line_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challan_lines_challan_id_fkey"
            columns: ["challan_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challan_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challan_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_challan_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_challan_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_challan_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_challan_lines_so_line_id_fkey"
            columns: ["so_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challan_lines_unit_fk"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_challans: {
        Row: {
          challan_date: string
          challan_no: string
          client_id: string
          created_at: string
          created_by: string | null
          driver_name: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          org_id: string
          so_id: string
          status: string
          total_amount: number | null
          transport_mode: Database["public"]["Enums"]["transport_mode"]
          vehicle_no: string | null
        }
        Insert: {
          challan_date?: string
          challan_no: string
          client_id: string
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          org_id: string
          so_id: string
          status?: string
          total_amount?: number | null
          transport_mode: Database["public"]["Enums"]["transport_mode"]
          vehicle_no?: string | null
        }
        Update: {
          challan_date?: string
          challan_no?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          org_id?: string
          so_id?: string
          status?: string
          total_amount?: number | null
          transport_mode?: Database["public"]["Enums"]["transport_mode"]
          vehicle_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_receivables"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "delivery_challans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_ageing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "delivery_challans_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "v_so_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          created_at: string
          created_by: string | null
          operation: string
          org_id: string
          request_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          operation: string
          org_id: string
          request_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          operation?: string
          org_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      expense_heads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_heads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_heads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_heads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          expense_date: string
          expense_no: string
          financial_year: string
          head_id: string
          id: string
          mode: string
          notes: string | null
          org_id: string
          payee: string | null
          reference: string | null
          status: string
        }
        Insert: {
          amount: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          expense_date: string
          expense_no: string
          financial_year: string
          head_id: string
          id?: string
          mode: string
          notes?: string | null
          org_id: string
          payee?: string | null
          reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          expense_date?: string
          expense_no?: string
          financial_year?: string
          head_id?: string
          id?: string
          mode?: string
          notes?: string | null
          org_id?: string
          payee?: string | null
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_head_id_fkey"
            columns: ["head_id"]
            isOneToOne: false
            referencedRelation: "expense_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      gst_states: {
        Row: {
          alpha_code: string
          code: string
          is_ut: boolean
          name: string
        }
        Insert: {
          alpha_code: string
          code: string
          is_ut?: boolean
          name: string
        }
        Update: {
          alpha_code?: string
          code?: string
          is_ut?: boolean
          name?: string
        }
        Relationships: []
      }
      inbound_receipt_lines: {
        Row: {
          gst_percent: Database["public"]["Enums"]["gst_rate"]
          id: string
          item_id: string
          line_total: number | null
          notes: string | null
          po_line_id: string | null
          qty_billed: number
          qty_ordered: number | null
          qty_received: number
          rate: number
          receipt_id: string
          unit_id: string
        }
        Insert: {
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id: string
          line_total?: number | null
          notes?: string | null
          po_line_id?: string | null
          qty_billed?: number
          qty_ordered?: number | null
          qty_received: number
          rate: number
          receipt_id: string
          unit_id: string
        }
        Update: {
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id?: string
          line_total?: number | null
          notes?: string | null
          po_line_id?: string | null
          qty_billed?: number
          qty_ordered?: number | null
          qty_received?: number
          rate?: number
          receipt_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_receipt_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipt_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inbound_receipt_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inbound_receipt_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inbound_receipt_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inbound_receipt_lines_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipt_lines_unit_fk"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_receipts: {
        Row: {
          challan_no: string | null
          created_at: string
          created_by: string | null
          driver_name: string | null
          gst_amount: number | null
          id: string
          invoice_no: string | null
          notes: string | null
          org_id: string
          po_id: string | null
          receipt_date: string
          receipt_no: string
          received_by: string | null
          status: string
          supplier_id: string
          total_amount: number | null
          transport_mode: Database["public"]["Enums"]["transport_mode"]
          updated_at: string
          vehicle_no: string | null
        }
        Insert: {
          challan_no?: string | null
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          gst_amount?: number | null
          id?: string
          invoice_no?: string | null
          notes?: string | null
          org_id: string
          po_id?: string | null
          receipt_date?: string
          receipt_no: string
          received_by?: string | null
          status?: string
          supplier_id: string
          total_amount?: number | null
          transport_mode?: Database["public"]["Enums"]["transport_mode"]
          updated_at?: string
          vehicle_no?: string | null
        }
        Update: {
          challan_no?: string | null
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          gst_amount?: number | null
          id?: string
          invoice_no?: string | null
          notes?: string | null
          org_id?: string
          po_id?: string | null
          receipt_date?: string
          receipt_no?: string
          received_by?: string | null
          status?: string
          supplier_id?: string
          total_amount?: number | null
          transport_mode?: Database["public"]["Enums"]["transport_mode"]
          updated_at?: string
          vehicle_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "inbound_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payables"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      income_heads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_heads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_heads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_heads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      inventory_balance: {
        Row: {
          available_qty: number | null
          current_qty: number
          item_id: string
          org_id: string
          reserved_qty: number
          updated_at: string
        }
        Insert: {
          available_qty?: number | null
          current_qty?: number
          item_id: string
          org_id: string
          reserved_qty?: number
          updated_at?: string
        }
        Update: {
          available_qty?: number | null
          current_qty?: number
          item_id?: string
          org_id?: string
          reserved_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "inventory_balance_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "inventory_balance_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "inventory_balance_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "inventory_balance_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "inventory_balance_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["org_id", "item_id"]
          },
        ]
      }
      inventory_ops_log: {
        Row: {
          created_at: string
          created_by: string | null
          item_id: string | null
          operation_id: string
          operation_type: string
          org_id: string
          qty: number | null
          ref_id: string | null
          ref_type: string | null
          result_movement_id: string | null
          result_payload: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          item_id?: string | null
          operation_id: string
          operation_type: string
          org_id: string
          qty?: number | null
          ref_id?: string | null
          ref_type?: string | null
          result_movement_id?: string | null
          result_payload?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          item_id?: string | null
          operation_id?: string
          operation_type?: string
          org_id?: string
          qty?: number | null
          ref_id?: string | null
          ref_type?: string | null
          result_movement_id?: string | null
          result_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_ops_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ops_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ops_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "inventory_ops_log_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "inventory_ops_log_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "inventory_ops_log_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "inventory_ops_log_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "inventory_ops_log_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["org_id", "item_id"]
          },
        ]
      }
      item_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      item_prices: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          gst_percent: Database["public"]["Enums"]["gst_rate"]
          id: string
          item_id: string
          notes: string | null
          org_id: string
          purchase_rate: number | null
          selling_rate: number | null
          supplier_id: string | null
          unit_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id: string
          notes?: string | null
          org_id: string
          purchase_rate?: number | null
          selling_rate?: number | null
          supplier_id?: string | null
          unit_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id?: string
          notes?: string | null
          org_id?: string
          purchase_rate?: number | null
          selling_rate?: number | null
          supplier_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_prices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_prices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "item_prices_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "item_prices_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "item_prices_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "item_prices_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "item_prices_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "item_prices_org_unit_fk"
            columns: ["org_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "item_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payables"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      items: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          hsn_code: string | null
          id: string
          is_active: boolean
          is_manufactured: boolean
          is_raw_material: boolean
          is_traded: boolean
          item_code: string
          material_type_id: string | null
          name: string
          notes: string | null
          org_id: string
          reorder_level: number | null
          reorder_qty: number | null
          size_spec: string | null
          sub_category: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          is_manufactured?: boolean
          is_raw_material?: boolean
          is_traded?: boolean
          item_code: string
          material_type_id?: string | null
          name: string
          notes?: string | null
          org_id: string
          reorder_level?: number | null
          reorder_qty?: number | null
          size_spec?: string | null
          sub_category?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          is_manufactured?: boolean
          is_raw_material?: boolean
          is_traded?: boolean
          item_code?: string
          material_type_id?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          reorder_level?: number | null
          reorder_qty?: number | null
          size_spec?: string | null
          sub_category?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_org_category_fk"
            columns: ["org_id", "category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "items_org_material_type_fk"
            columns: ["org_id", "material_type_id"]
            isOneToOne: false
            referencedRelation: "material_types"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "items_org_unit_fk"
            columns: ["org_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      material_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      money_openings: {
        Row: {
          account: string
          amount: number
          as_of: string
          id: string
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account: string
          amount: number
          as_of: string
          id?: string
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account?: string
          amount?: number
          as_of?: string
          id?: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "money_openings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "money_openings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "money_openings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      money_transfers: {
        Row: {
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          direction: string
          financial_year: string
          id: string
          notes: string | null
          org_id: string
          reference: string | null
          status: string
          transfer_date: string
          transfer_no: string
        }
        Insert: {
          amount: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          direction: string
          financial_year: string
          id?: string
          notes?: string | null
          org_id: string
          reference?: string | null
          status?: string
          transfer_date: string
          transfer_no: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          financial_year?: string
          id?: string
          notes?: string | null
          org_id?: string
          reference?: string | null
          status?: string
          transfer_date?: string
          transfer_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "money_transfers_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "money_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "money_transfers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "money_transfers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      org_sequences: {
        Row: {
          current_value: number
          org_id: string
          seq_name: string
        }
        Insert: {
          current_value?: number
          org_id: string
          seq_name: string
        }
        Update: {
          current_value?: number
          org_id?: string
          seq_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      organizations: {
        Row: {
          access_status: string
          address: string | null
          bank_account_no: string | null
          bank_branch: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          invoice_prefix: string
          invoice_terms: string | null
          is_active: boolean
          name: string
          pan: string | null
          phone: string | null
          pincode: string | null
          slug: string | null
          state: string | null
          state_code: string | null
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          access_status?: string
          address?: string | null
          bank_account_no?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          invoice_prefix?: string
          invoice_terms?: string | null
          is_active?: boolean
          name: string
          pan?: string | null
          phone?: string | null
          pincode?: string | null
          slug?: string | null
          state?: string | null
          state_code?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          access_status?: string
          address?: string | null
          bank_account_no?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          invoice_prefix?: string
          invoice_terms?: string | null
          is_active?: boolean
          name?: string
          pan?: string | null
          phone?: string | null
          pincode?: string | null
          slug?: string | null
          state?: string | null
          state_code?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "gst_states"
            referencedColumns: ["code"]
          },
        ]
      }
      other_income: {
        Row: {
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          financial_year: string
          head_id: string
          id: string
          income_date: string
          income_no: string
          mode: string
          notes: string | null
          org_id: string
          received_from: string | null
          reference: string | null
          status: string
        }
        Insert: {
          amount: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_year: string
          head_id: string
          id?: string
          income_date: string
          income_no: string
          mode: string
          notes?: string | null
          org_id: string
          received_from?: string | null
          reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_year?: string
          head_id?: string
          id?: string
          income_date?: string
          income_no?: string
          mode?: string
          notes?: string | null
          org_id?: string
          received_from?: string | null
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "other_income_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_income_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_income_head_id_fkey"
            columns: ["head_id"]
            isOneToOne: false
            referencedRelation: "income_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_income_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_income_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      production_assignments: {
        Row: {
          assigned_date: string
          hours_worked: number | null
          id: string
          notes: string | null
          production_order_id: string
          worker_id: string
        }
        Insert: {
          assigned_date?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          production_order_id: string
          worker_id: string
        }
        Update: {
          assigned_date?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          production_order_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_assignments_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_items: {
        Row: {
          id: string
          item_id: string
          production_order_id: string
          qty_produced: number
          qty_required: number
          unit_id: string | null
        }
        Insert: {
          id?: string
          item_id: string
          production_order_id: string
          qty_produced?: number
          qty_required: number
          unit_id?: string | null
        }
        Update: {
          id?: string
          item_id?: string
          production_order_id?: string
          qty_produced?: number
          qty_required?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "production_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "production_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "production_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "production_order_items_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_items_unit_fk"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          completed_date: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          org_id: string
          po_number: string
          so_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["production_status"]
          target_date: string | null
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id: string
          po_number: string
          so_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["production_status"]
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          po_number?: string
          so_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["production_status"]
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "production_orders_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "v_so_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          org_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          org_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          org_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          gst_amount: number
          gst_percent: Database["public"]["Enums"]["gst_rate"]
          id: string
          item_id: string
          line_total: number
          notes: string | null
          org_id: string
          po_id: string
          qty: number
          qty_received: number
          rate: number
          sort_order: number
          taxable_value: number
          unit_id: string
        }
        Insert: {
          gst_amount: number
          gst_percent: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id: string
          line_total: number
          notes?: string | null
          org_id: string
          po_id: string
          qty: number
          qty_received?: number
          rate: number
          sort_order: number
          taxable_value: number
          unit_id: string
        }
        Update: {
          gst_amount?: number
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id?: string
          line_total?: number
          notes?: string | null
          org_id?: string
          po_id?: string
          qty?: number
          qty_received?: number
          rate?: number
          sort_order?: number
          taxable_value?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          expected_date: string | null
          financial_year: string
          gst_amount: number
          id: string
          is_interstate: boolean
          issued_at: string | null
          issued_by: string | null
          notes: string | null
          org_id: string
          po_date: string
          po_no: string
          status: string
          supplier_id: string
          taxable_value: number
          terms: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          financial_year: string
          gst_amount?: number
          id?: string
          is_interstate?: boolean
          issued_at?: string | null
          issued_by?: string | null
          notes?: string | null
          org_id: string
          po_date: string
          po_no: string
          status?: string
          supplier_id: string
          taxable_value?: number
          terms?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          financial_year?: string
          gst_amount?: number
          id?: string
          is_interstate?: boolean
          issued_at?: string | null
          issued_by?: string | null
          notes?: string | null
          org_id?: string
          po_date?: string
          po_no?: string
          status?: string
          supplier_id?: string
          taxable_value?: number
          terms?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payables"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      quotation_lines: {
        Row: {
          description: string | null
          gst_percent: Database["public"]["Enums"]["gst_rate"]
          id: string
          item_id: string
          line_total: number | null
          qty: number
          quotation_id: string
          sort_order: number | null
          unit_id: string
          unit_rate: number
        }
        Insert: {
          description?: string | null
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id: string
          line_total?: number | null
          qty: number
          quotation_id: string
          sort_order?: number | null
          unit_id: string
          unit_rate: number
        }
        Update: {
          description?: string | null
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id?: string
          line_total?: number | null
          qty?: number
          quotation_id?: string
          sort_order?: number | null
          unit_id?: string
          unit_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "quotation_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "quotation_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "quotation_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "quotation_lines_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_lines_unit_fk"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_id: string
          created_at: string
          created_by: string | null
          delivery_days: number | null
          gst_amount: number
          id: string
          notes: string | null
          org_id: string
          payment_terms: string | null
          quotation_date: string
          quotation_no: string
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          total_amount: number
          transport_note: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          delivery_days?: number | null
          gst_amount?: number
          id?: string
          notes?: string | null
          org_id: string
          payment_terms?: string | null
          quotation_date?: string
          quotation_no: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          total_amount?: number
          transport_note?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          delivery_days?: number | null
          gst_amount?: number
          id?: string
          notes?: string | null
          org_id?: string
          payment_terms?: string | null
          quotation_date?: string
          quotation_no?: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          total_amount?: number
          transport_note?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_receivables"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      receipt_allocations: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          org_id: string
          receipt_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          org_id: string
          receipt_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          org_id?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_ageing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "receipt_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "customer_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_lines: {
        Row: {
          cgst_amount: number
          challan_id: string | null
          challan_line_id: string | null
          description: string
          gst_rate: number
          hsn_code: string | null
          id: string
          igst_amount: number
          invoice_id: string
          item_id: string
          line_total: number
          org_id: string
          qty: number
          rate: number
          sgst_amount: number
          so_line_id: string | null
          sort_order: number
          taxable_value: number
          unit_id: string | null
          unit_name: string | null
        }
        Insert: {
          cgst_amount?: number
          challan_id?: string | null
          challan_line_id?: string | null
          description: string
          gst_rate: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          invoice_id: string
          item_id: string
          line_total: number
          org_id: string
          qty: number
          rate: number
          sgst_amount?: number
          so_line_id?: string | null
          sort_order: number
          taxable_value: number
          unit_id?: string | null
          unit_name?: string | null
        }
        Update: {
          cgst_amount?: number
          challan_id?: string | null
          challan_line_id?: string | null
          description?: string
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          invoice_id?: string
          item_id?: string
          line_total?: number
          org_id?: string
          qty?: number
          rate?: number
          sgst_amount?: number
          so_line_id?: string | null
          sort_order?: number
          taxable_value?: number
          unit_id?: string | null
          unit_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_lines_challan_id_fkey"
            columns: ["challan_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_challan_line_id_fkey"
            columns: ["challan_line_id"]
            isOneToOne: false
            referencedRelation: "delivery_challan_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_ageing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_so_line_id_fkey"
            columns: ["so_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          amount_credited: number
          amount_paid: number
          balance_due: number | null
          buyer_address: string | null
          buyer_gstin: string | null
          buyer_name: string
          buyer_state_code: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cgst_amount: number
          client_id: string
          created_at: string
          created_by: string | null
          due_date: string
          eway_bill_date: string | null
          eway_bill_no: string | null
          financial_year: string
          id: string
          igst_amount: number
          invoice_date: string
          invoice_no: string
          is_interstate: boolean
          notes: string | null
          org_id: string
          place_of_supply: string
          reverse_charge: boolean
          round_off: number
          sgst_amount: number
          so_id: string | null
          status: string
          supplier_address: string | null
          supplier_gstin: string
          supplier_name: string
          supplier_state_code: string
          taxable_value: number
          total_amount: number
        }
        Insert: {
          amount_credited?: number
          amount_paid?: number
          balance_due?: number | null
          buyer_address?: string | null
          buyer_gstin?: string | null
          buyer_name: string
          buyer_state_code?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          eway_bill_date?: string | null
          eway_bill_no?: string | null
          financial_year: string
          id?: string
          igst_amount?: number
          invoice_date: string
          invoice_no: string
          is_interstate: boolean
          notes?: string | null
          org_id: string
          place_of_supply: string
          reverse_charge?: boolean
          round_off?: number
          sgst_amount?: number
          so_id?: string | null
          status?: string
          supplier_address?: string | null
          supplier_gstin: string
          supplier_name: string
          supplier_state_code: string
          taxable_value: number
          total_amount: number
        }
        Update: {
          amount_credited?: number
          amount_paid?: number
          balance_due?: number | null
          buyer_address?: string | null
          buyer_gstin?: string | null
          buyer_name?: string
          buyer_state_code?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          eway_bill_date?: string | null
          eway_bill_no?: string | null
          financial_year?: string
          id?: string
          igst_amount?: number
          invoice_date?: string
          invoice_no?: string
          is_interstate?: boolean
          notes?: string | null
          org_id?: string
          place_of_supply?: string
          reverse_charge?: boolean
          round_off?: number
          sgst_amount?: number
          so_id?: string | null
          status?: string
          supplier_address?: string | null
          supplier_gstin?: string
          supplier_name?: string
          supplier_state_code?: string
          taxable_value?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_buyer_state_code_fkey"
            columns: ["buyer_state_code"]
            isOneToOne: false
            referencedRelation: "gst_states"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_invoices_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_receivables"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sales_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "sales_invoices_place_of_supply_fkey"
            columns: ["place_of_supply"]
            isOneToOne: false
            referencedRelation: "gst_states"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "v_so_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_supplier_state_code_fkey"
            columns: ["supplier_state_code"]
            isOneToOne: false
            referencedRelation: "gst_states"
            referencedColumns: ["code"]
          },
        ]
      }
      sales_order_lines: {
        Row: {
          description: string | null
          gst_percent: Database["public"]["Enums"]["gst_rate"]
          id: string
          item_id: string
          line_total: number | null
          qty: number
          qty_dispatched: number | null
          qty_produced: number | null
          so_id: string
          sort_order: number | null
          unit_id: string
          unit_rate: number
        }
        Insert: {
          description?: string | null
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id: string
          line_total?: number | null
          qty: number
          qty_dispatched?: number | null
          qty_produced?: number | null
          so_id: string
          sort_order?: number | null
          unit_id: string
          unit_rate: number
        }
        Update: {
          description?: string | null
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id?: string
          line_total?: number | null
          qty?: number
          qty_dispatched?: number | null
          qty_produced?: number | null
          so_id?: string
          sort_order?: number | null
          unit_id?: string
          unit_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sales_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sales_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sales_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sales_order_lines_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "v_so_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_unit_fk"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          advance_paid: number | null
          approved_at: string | null
          approved_by: string | null
          balance_due: number | null
          client_id: string
          created_at: string
          created_by: string | null
          delivery_date: string | null
          gst_amount: number
          id: string
          notes: string | null
          order_date: string
          org_id: string
          payment_terms: string | null
          quotation_id: string | null
          so_number: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          transport_mode: Database["public"]["Enums"]["transport_mode"] | null
          updated_at: string
        }
        Insert: {
          advance_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number | null
          client_id: string
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          gst_amount?: number
          id?: string
          notes?: string | null
          order_date?: string
          org_id: string
          payment_terms?: string | null
          quotation_id?: string | null
          so_number: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total_amount?: number
          transport_mode?: Database["public"]["Enums"]["transport_mode"] | null
          updated_at?: string
        }
        Update: {
          advance_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          gst_amount?: number
          id?: string
          notes?: string | null
          order_date?: string
          org_id?: string
          payment_terms?: string | null
          quotation_id?: string | null
          so_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total_amount?: number
          transport_mode?: Database["public"]["Enums"]["transport_mode"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_receivables"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "sales_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_no: string | null
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          movement_date: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          org_id: string
          qty: number
          rate_at_time: number | null
          ref_id: string | null
          ref_type: string | null
        }
        Insert: {
          batch_no?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          movement_date?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          org_id: string
          qty: number
          rate_at_time?: number | null
          ref_id?: string | null
          ref_type?: string | null
        }
        Update: {
          batch_no?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          movement_date?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          org_id?: string
          qty?: number
          rate_at_time?: number | null
          ref_id?: string | null
          ref_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "stock_movements_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "stock_movements_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "stock_movements_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "stock_movements_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "stock_movements_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["org_id", "item_id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          org_id: string
          qty_consumed: number
          qty_released: number
          qty_reserved: number
          ref_id: string
          ref_type: string
          reservation_expiry: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          org_id: string
          qty_consumed?: number
          qty_released?: number
          qty_reserved: number
          ref_id: string
          ref_type: string
          reservation_expiry?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          org_id?: string
          qty_consumed?: number
          qty_released?: number
          qty_reserved?: number
          ref_id?: string
          ref_type?: string
          reservation_expiry?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "stock_reservations_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "stock_reservations_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "stock_reservations_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "stock_reservations_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "stock_reservations_org_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["org_id", "item_id"]
          },
        ]
      }
      supplier_bill_lines: {
        Row: {
          bill_id: string
          grn_line_id: string
          gst_amount: number
          gst_percent: Database["public"]["Enums"]["gst_rate"]
          id: string
          item_id: string
          line_total: number
          org_id: string
          qty: number
          rate: number
          sort_order: number
          taxable_value: number
          unit_id: string
        }
        Insert: {
          bill_id: string
          grn_line_id: string
          gst_amount: number
          gst_percent: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id: string
          line_total: number
          org_id: string
          qty: number
          rate: number
          sort_order: number
          taxable_value: number
          unit_id: string
        }
        Update: {
          bill_id?: string
          grn_line_id?: string
          gst_amount?: number
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id?: string
          line_total?: number
          org_id?: string
          qty?: number
          rate?: number
          sort_order?: number
          taxable_value?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bill_lines_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "supplier_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bill_lines_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "v_bill_ageing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bill_lines_grn_line_id_fkey"
            columns: ["grn_line_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipt_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bill_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bill_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "supplier_bill_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "supplier_bill_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "supplier_bill_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "supplier_bill_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bill_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "supplier_bill_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_bills: {
        Row: {
          amount_debited: number
          amount_paid: number
          balance_due: number | null
          bill_date: string
          bill_no: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cgst_amount: number
          created_at: string
          created_by: string | null
          due_date: string
          financial_year: string
          id: string
          igst_amount: number
          is_interstate: boolean
          notes: string | null
          org_id: string
          round_off: number
          sgst_amount: number
          status: string
          supplier_gstin: string | null
          supplier_id: string
          supplier_invoice_no: string
          taxable_value: number
          total_amount: number
        }
        Insert: {
          amount_debited?: number
          amount_paid?: number
          balance_due?: number | null
          bill_date: string
          bill_no: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          due_date: string
          financial_year: string
          id?: string
          igst_amount?: number
          is_interstate?: boolean
          notes?: string | null
          org_id: string
          round_off?: number
          sgst_amount?: number
          status?: string
          supplier_gstin?: string | null
          supplier_id: string
          supplier_invoice_no: string
          taxable_value?: number
          total_amount?: number
        }
        Update: {
          amount_debited?: number
          amount_paid?: number
          balance_due?: number | null
          bill_date?: string
          bill_no?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string
          financial_year?: string
          id?: string
          igst_amount?: number
          is_interstate?: boolean
          notes?: string | null
          org_id?: string
          round_off?: number
          sgst_amount?: number
          status?: string
          supplier_gstin?: string | null
          supplier_id?: string
          supplier_invoice_no?: string
          taxable_value?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bills_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "supplier_bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payables"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      supplier_payment_allocations: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payment_allocations_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "supplier_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "v_bill_ageing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "supplier_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "supplier_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          amount_allocated: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          financial_year: string
          id: string
          mode: string
          notes: string | null
          org_id: string
          payment_date: string
          payment_no: string
          reference: string | null
          status: string
          supplier_id: string
        }
        Insert: {
          amount: number
          amount_allocated?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_year: string
          id?: string
          mode: string
          notes?: string | null
          org_id: string
          payment_date: string
          payment_no: string
          reference?: string | null
          status?: string
          supplier_id: string
        }
        Update: {
          amount?: number
          amount_allocated?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_year?: string
          id?: string
          mode?: string
          notes?: string | null
          org_id?: string
          payment_date?: string
          payment_no?: string
          reference?: string | null
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payables"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          credit_days: number
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          org_id: string
          payment_terms: string | null
          phone: string | null
          state: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          credit_days?: number
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          org_id: string
          payment_terms?: string | null
          phone?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          credit_days?: number
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          payment_terms?: string | null
          phone?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "suppliers_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "gst_states"
            referencedColumns: ["code"]
          },
        ]
      }
      units: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          phone: string | null
          skill: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          phone?: string | null
          skill?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          phone?: string | null
          skill?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
    }
    Views: {
      v_bank_entries: {
        Row: {
          bank_date: string | null
          created_at: string | null
          deposit: number | null
          detail: string | null
          doc_date: string | null
          doc_id: string | null
          doc_no: string | null
          kind: string | null
          mode: string | null
          org_id: string | null
          party: string | null
          reference: string | null
          withdrawal: number | null
        }
        Relationships: []
      }
      v_bill_ageing: {
        Row: {
          amount_debited: number | null
          amount_paid: number | null
          balance_due: number | null
          bill_date: string | null
          bill_no: string | null
          bucket: string | null
          days_overdue: number | null
          due_date: string | null
          id: string | null
          org_id: string | null
          supplier_id: string | null
          supplier_invoice_no: string | null
          supplier_name: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "supplier_bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payables"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      v_client_receivables: {
        Row: {
          client_id: string | null
          client_name: string | null
          credit_days: number | null
          credit_limit: number | null
          invoiced: number | null
          max_days_overdue: number | null
          not_due: number | null
          org_id: string | null
          outstanding: number | null
          overdue: number | null
          overdue_1_30: number | null
          overdue_31_60: number | null
          overdue_61_90: number | null
          overdue_90_plus: number | null
          received: number | null
          unallocated_credit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      v_current_prices: {
        Row: {
          effective_from: string | null
          gst_percent: string | null
          item_code: string | null
          item_id: string | null
          name: string | null
          price_notes: string | null
          purchase_rate: number | null
          rate_unit: string | null
          selling_rate: number | null
        }
        Relationships: []
      }
      v_invoice_ageing: {
        Row: {
          amount_credited: number | null
          amount_paid: number | null
          balance_due: number | null
          bucket: string | null
          client_id: string | null
          client_name: string | null
          days_overdue: number | null
          due_date: string | null
          id: string | null
          invoice_date: string | null
          invoice_no: string | null
          org_id: string | null
          so_id: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_client_receivables"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sales_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "v_so_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      v_item_bom_cost: {
        Row: {
          bom_unresolved: boolean | null
          components_without_cost: number | null
          item_id: string | null
          org_id: string | null
          unit_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_org_finished_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "bom_org_finished_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_item_direct_cost"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_finished_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_finished_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_finished_item_fk"
            columns: ["org_id", "item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_valuation"
            referencedColumns: ["org_id", "item_id"]
          },
          {
            foreignKeyName: "bom_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      v_item_direct_cost: {
        Row: {
          cost_basis: string | null
          item_id: string | null
          org_id: string | null
          unit_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      v_reorder_alerts: {
        Row: {
          balance_updated_at: string | null
          below_reorder: boolean | null
          category: string | null
          category_id: string | null
          item_code: string | null
          item_id: string | null
          name: string | null
          needs_ordering: boolean | null
          org_id: string | null
          out_of_stock: boolean | null
          qty_available: number | null
          qty_incoming: number | null
          qty_on_hand: number | null
          qty_projected: number | null
          qty_reserved: number | null
          reorder_level: number | null
          reorder_qty: number | null
          suggested_order_qty: number | null
          tracks_reorder: boolean | null
          unit: string | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_org_category_fk"
            columns: ["org_id", "category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "items_org_unit_fk"
            columns: ["org_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      v_setup_readiness: {
        Row: {
          can_invoice: boolean | null
          challans_awaiting_invoice: number | null
          clients_missing_state: number | null
          clients_missing_state_sample: Json | null
          company_name: string | null
          has_address: boolean | null
          has_bank_details: boolean | null
          has_gstin: boolean | null
          has_state_code: boolean | null
          items_missing_hsn: number | null
          items_missing_hsn_sample: Json | null
          org_id: string | null
        }
        Relationships: []
      }
      v_so_pipeline: {
        Row: {
          advance_paid: number | null
          balance_due: number | null
          client_name: string | null
          client_phone: string | null
          created_by_name: string | null
          delivery_date: string | null
          id: string | null
          order_date: string | null
          quotation_no: string | null
          so_number: string | null
          status: string | null
          total_amount: number | null
        }
        Relationships: []
      }
      v_stock_levels: {
        Row: {
          balance_updated_at: string | null
          below_reorder: boolean | null
          category: string | null
          category_id: string | null
          item_code: string | null
          item_id: string | null
          name: string | null
          needs_ordering: boolean | null
          org_id: string | null
          out_of_stock: boolean | null
          qty_available: number | null
          qty_incoming: number | null
          qty_on_hand: number | null
          qty_projected: number | null
          qty_reserved: number | null
          reorder_level: number | null
          reorder_qty: number | null
          suggested_order_qty: number | null
          tracks_reorder: boolean | null
          unit: string | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_org_category_fk"
            columns: ["org_id", "category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
          {
            foreignKeyName: "items_org_unit_fk"
            columns: ["org_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      v_stock_valuation: {
        Row: {
          category: string | null
          category_id: string | null
          cost_basis: string | null
          cost_warning: string | null
          is_manufactured: boolean | null
          item_code: string | null
          item_id: string | null
          name: string | null
          org_id: string | null
          qty_on_hand: number | null
          qty_reserved: number | null
          stock_value: number | null
          unit: string | null
          unit_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_org_category_fk"
            columns: ["org_id", "category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
      v_supplier_payables: {
        Row: {
          advance: number | null
          billed: number | null
          credit_days: number | null
          debited: number | null
          next_due: string | null
          not_due: number | null
          org_id: string | null
          outstanding: number | null
          overdue: number | null
          overdue_1_30: number | null
          overdue_31_60: number | null
          overdue_61_90: number | null
          overdue_90_plus: number | null
          paid: number | null
          supplier_id: string | null
          supplier_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "v_setup_readiness"
            referencedColumns: ["org_id"]
          },
        ]
      }
    }
    Functions: {
      _allocate_payment_explicit: {
        Args: { p_allocations: Json; p_available: number; p_payment_id: string }
        Returns: number
      }
      _allocate_payment_fifo: {
        Args: { p_payment_id: string }
        Returns: number
      }
      _allocate_receipt_fifo: {
        Args: { p_invoice_id?: string; p_receipt_id: string; p_so_id?: string }
        Returns: number
      }
      _claim_document_request: {
        Args: { p_operation: string; p_request_id: string }
        Returns: undefined
      }
      _po_is_interstate: {
        Args: { p_org_id: string; p_supplier_id: string }
        Returns: boolean
      }
      _recalc_bill_paid: { Args: { p_bill_id: string }; Returns: undefined }
      _recalc_invoice_paid: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      _recalc_payment_allocated: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      _recalc_receipt_allocated: {
        Args: { p_receipt_id: string }
        Returns: undefined
      }
      _recalc_so_advance: { Args: { p_so_id: string }; Returns: undefined }
      _release_overpaid_bill: {
        Args: { p_bill_id: string; p_incoming: number }
        Returns: number
      }
      _release_overpayment: {
        Args: { p_incoming: number; p_invoice_id: string }
        Returns: number
      }
      _seed_expense_heads: { Args: { p_org_id: string }; Returns: undefined }
      _seed_income_heads: { Args: { p_org_id: string }; Returns: undefined }
      _write_purchase_order_lines: {
        Args: { p_lines: Json; p_po_id: string }
        Returns: undefined
      }
      adjust_inventory: {
        Args: {
          p_delta: number
          p_item_id: string
          p_operation_id: string
          p_reason: string
          p_ref_id?: string
        }
        Returns: Json
      }
      allocate_customer_receipt: {
        Args: { p_allocations?: Json; p_receipt_id: string }
        Returns: Json
      }
      allocate_supplier_payment: {
        Args: { p_allocations?: Json; p_payment_id: string }
        Returns: Json
      }
      assert_item_in_my_org: { Args: { p_item_id: string }; Returns: undefined }
      assert_my_role: {
        Args: { p_roles: Database["public"]["Enums"]["user_role"][] }
        Returns: undefined
      }
      bank_book: {
        Args: { p_from: string; p_to: string }
        Returns: {
          bank_date: string
          deposit: number
          detail: string
          doc_date: string
          doc_id: string
          doc_no: string
          kind: string
          mode: string
          party: string
          reference: string
          withdrawal: number
        }[]
      }
      bank_reconciliation: { Args: { p_as_of: string }; Returns: Json }
      cancel_credit_note: {
        Args: { p_credit_note_id: string; p_reason: string }
        Returns: Json
      }
      cancel_customer_receipt: {
        Args: { p_reason: string; p_receipt_id: string }
        Returns: Json
      }
      cancel_debit_note: {
        Args: { p_debit_note_id: string; p_reason: string }
        Returns: Json
      }
      cancel_expense: {
        Args: { p_expense_id: string; p_reason: string }
        Returns: Json
      }
      cancel_money_transfer: {
        Args: { p_reason: string; p_transfer_id: string }
        Returns: Json
      }
      cancel_other_income: {
        Args: { p_income_id: string; p_reason: string }
        Returns: Json
      }
      cancel_production_order: {
        Args: { p_production_order_id: string }
        Returns: Json
      }
      cancel_sales_invoice: {
        Args: { p_invoice_id: string; p_reason: string }
        Returns: Json
      }
      cancel_sales_order: { Args: { p_so_id: string }; Returns: Json }
      cancel_supplier_bill: {
        Args: { p_bill_id: string; p_reason: string }
        Returns: Json
      }
      cancel_supplier_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: Json
      }
      check_bom_availability: {
        Args: { p_production_order_id: string }
        Returns: Json
      }
      client_credit_status: { Args: { p_client_id: string }; Returns: Json }
      client_statement: {
        Args: { p_client_id: string; p_from: string; p_to: string }
        Returns: {
          balance: number
          credit: number
          debit: number
          detail: string
          doc_id: string
          doc_no: string
          entry_date: string
          kind: string
          seq: number
        }[]
      }
      close_purchase_order: {
        Args: { p_po_id: string; p_reason: string }
        Returns: Json
      }
      complete_production_order: {
        Args: { p_production_order_id: string }
        Returns: Json
      }
      consume_inventory: {
        Args: {
          p_item_id: string
          p_notes?: string
          p_operation_id: string
          p_qty: number
          p_ref_id?: string
          p_ref_type?: string
          p_reservation_id?: string
        }
        Returns: Json
      }
      convert_quotation_to_sales_order: {
        Args: { p_allow_expired?: boolean; p_quotation_id: string }
        Returns: Json
      }
      create_credit_note: {
        Args: {
          p_invoice_id: string
          p_lines: Json
          p_note_date?: string
          p_notes?: string
          p_reason: string
          p_request_id?: string
          p_restock?: boolean
        }
        Returns: Json
      }
      create_debit_note: {
        Args: {
          p_bill_id: string
          p_lines: Json
          p_note_date?: string
          p_notes?: string
          p_reason: string
          p_request_id?: string
          p_return_stock?: boolean
        }
        Returns: Json
      }
      create_delivery_challan: {
        Args: {
          p_challan_date?: string
          p_driver_name?: string
          p_lines: Json
          p_notes?: string
          p_request_id?: string
          p_so_id: string
          p_transport_mode?: Database["public"]["Enums"]["transport_mode"]
          p_vehicle_no?: string
        }
        Returns: Json
      }
      create_inbound_receipt: {
        Args: {
          p_challan_no?: string
          p_driver_name?: string
          p_invoice_no?: string
          p_lines: Json
          p_notes?: string
          p_receipt_date?: string
          p_request_id?: string
          p_supplier_id: string
          p_transport_mode?: Database["public"]["Enums"]["transport_mode"]
          p_vehicle_no?: string
        }
        Returns: Json
      }
      create_organization: {
        Args: {
          p_categories?: Json
          p_include_sap_defaults?: boolean
          p_material_types?: Json
          p_name: string
          p_template?: string
          p_units?: Json
        }
        Returns: string
      }
      create_production_order: {
        Args: {
          p_expiry_hours?: number
          p_finished_item_id: string
          p_materials: Json
          p_notes?: string
          p_qty: number
          p_request_id?: string
          p_target_date?: string
        }
        Returns: Json
      }
      create_purchase_order: {
        Args: {
          p_expected_date?: string
          p_issue?: boolean
          p_lines: Json
          p_notes?: string
          p_po_date?: string
          p_supplier_id: string
          p_terms?: string
        }
        Returns: Json
      }
      create_quotation: {
        Args: {
          p_client_id: string
          p_delivery_days?: number
          p_lines: Json
          p_notes?: string
          p_payment_terms?: string
          p_submit?: boolean
          p_transport_note?: string
          p_valid_until?: string
        }
        Returns: Json
      }
      create_sales_invoice: {
        Args: {
          p_challan_ids: string[]
          p_invoice_date?: string
          p_notes?: string
          p_request_id?: string
          p_reverse_charge?: boolean
        }
        Returns: Json
      }
      create_supplier_bill: {
        Args: {
          p_bill_date: string
          p_due_date?: string
          p_invoice_total?: number
          p_lines: Json
          p_notes?: string
          p_supplier_id: string
          p_supplier_invoice_no: string
        }
        Returns: Json
      }
      dispatch_inventory: {
        Args: {
          p_item_id: string
          p_notes?: string
          p_operation_id: string
          p_qty: number
          p_rate: number
          p_ref_id?: string
          p_ref_type?: string
          p_reservation_id?: string
        }
        Returns: Json
      }
      expire_stale_reservations: { Args: never; Returns: number }
      financial_position: { Args: { p_as_of: string }; Returns: Json }
      financial_year: { Args: { p_date: string }; Returns: string }
      gst_hsn_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          b2b: boolean
          cgst_amount: number
          description: string
          gst_rate: number
          hsn_code: string
          igst_amount: number
          sgst_amount: number
          taxable_value: number
          total_qty: number
          total_value: number
          unit_name: string
        }[]
      }
      is_valid_gstin: { Args: { p_gstin: string }; Returns: boolean }
      issue_purchase_order: { Args: { p_po_id: string }; Returns: Json }
      lock_inventory_balance: {
        Args: { p_item_id: string }
        Returns: {
          available_qty: number | null
          current_qty: number
          item_id: string
          org_id: string
          reserved_qty: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_balance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_challan_delivered: { Args: { p_challan_id: string }; Returns: Json }
      money_balances: { Args: { p_from: string; p_to: string }; Returns: Json }
      my_org: { Args: never; Returns: string }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      next_dc_no: { Args: { p_org_id: string }; Returns: string }
      next_grn_no: { Args: { p_org_id: string }; Returns: string }
      next_org_seq: {
        Args: { p_org_id: string; p_seq_name: string }
        Returns: number
      }
      next_prd_no: { Args: { p_org_id: string }; Returns: string }
      next_qt_no: { Args: { p_org_id: string }; Returns: string }
      next_so_no: { Args: { p_org_id: string }; Returns: string }
      org_is_active: { Args: never; Returns: boolean }
      produce_inventory: {
        Args: {
          p_item_id: string
          p_notes?: string
          p_operation_id: string
          p_qty: number
          p_ref_id?: string
          p_ref_type?: string
        }
        Returns: Json
      }
      profit_and_loss: { Args: { p_from: string; p_to: string }; Returns: Json }
      prune_document_requests: { Args: never; Returns: number }
      receive_inventory: {
        Args: {
          p_batch_no?: string
          p_item_id: string
          p_notes?: string
          p_operation_id: string
          p_qty: number
          p_rate: number
          p_ref_id: string
          p_ref_type: string
        }
        Returns: Json
      }
      receive_purchase_order: {
        Args: {
          p_challan_no?: string
          p_driver_name?: string
          p_invoice_no?: string
          p_lines: Json
          p_notes?: string
          p_po_id: string
          p_receipt_date?: string
          p_request_id?: string
          p_transport_mode?: Database["public"]["Enums"]["transport_mode"]
          p_vehicle_no?: string
        }
        Returns: Json
      }
      reconcile_inventory_balance: {
        Args: never
        Returns: {
          diff: number
          item_id: string
          new_qty: number
          old_qty: number
        }[]
      }
      record_customer_receipt: {
        Args: {
          p_allocations?: Json
          p_amount: number
          p_auto_allocate?: boolean
          p_client_id: string
          p_mode: string
          p_notes?: string
          p_receipt_date?: string
          p_reference?: string
          p_request_id?: string
          p_so_id?: string
        }
        Returns: Json
      }
      record_expense: {
        Args: {
          p_amount: number
          p_expense_date?: string
          p_head_id: string
          p_mode: string
          p_notes?: string
          p_payee?: string
          p_reference?: string
          p_request_id?: string
        }
        Returns: Json
      }
      record_money_transfer: {
        Args: {
          p_amount: number
          p_direction: string
          p_notes?: string
          p_reference?: string
          p_request_id?: string
          p_transfer_date?: string
        }
        Returns: Json
      }
      record_other_income: {
        Args: {
          p_amount: number
          p_head_id: string
          p_income_date?: string
          p_mode: string
          p_notes?: string
          p_received_from?: string
          p_reference?: string
          p_request_id?: string
        }
        Returns: Json
      }
      record_so_payment: {
        Args: { p_amount: number; p_so_id: string }
        Returns: Json
      }
      record_supplier_payment: {
        Args: {
          p_allocations?: Json
          p_amount: number
          p_auto_allocate?: boolean
          p_mode: string
          p_notes?: string
          p_payment_date?: string
          p_reference?: string
          p_request_id?: string
          p_supplier_id: string
        }
        Returns: Json
      }
      release_inventory: {
        Args: {
          p_notes?: string
          p_operation_id: string
          p_qty_to_release?: number
          p_reservation_id: string
        }
        Returns: Json
      }
      reserve_inventory: {
        Args: {
          p_expiry_hours?: number
          p_item_id: string
          p_notes?: string
          p_operation_id: string
          p_qty: number
          p_ref_id: string
          p_ref_type: string
        }
        Returns: Json
      }
      reserve_sales_order: {
        Args: { p_expiry_hours?: number; p_so_id: string }
        Returns: Json
      }
      save_expense_head: {
        Args: { p_id?: string; p_is_active?: boolean; p_name: string }
        Returns: Json
      }
      save_income_head: {
        Args: { p_id?: string; p_is_active?: boolean; p_name: string }
        Returns: Json
      }
      set_bank_dates: { Args: { p_entries: Json }; Returns: Json }
      set_invoice_eway_bill: {
        Args: {
          p_eway_bill_date?: string
          p_eway_bill_no: string
          p_invoice_id: string
        }
        Returns: Json
      }
      set_item_price: {
        Args: {
          p_gst_percent?: Database["public"]["Enums"]["gst_rate"]
          p_item_id: string
          p_notes?: string
          p_purchase_rate?: number
          p_selling_rate?: number
        }
        Returns: Json
      }
      set_money_opening: {
        Args: { p_account: string; p_amount: number; p_as_of: string }
        Returns: Json
      }
      set_quotation_status: {
        Args: {
          p_comments?: string
          p_quotation_id: string
          p_status: Database["public"]["Enums"]["document_status"]
        }
        Returns: Json
      }
      start_production_order: {
        Args: { p_production_order_id: string }
        Returns: Json
      }
      supplier_statement: {
        Args: { p_from: string; p_supplier_id: string; p_to: string }
        Returns: {
          balance: number
          credit: number
          debit: number
          detail: string
          doc_id: string
          doc_no: string
          entry_date: string
          kind: string
          seq: number
        }[]
      }
      update_purchase_order: {
        Args: {
          p_expected_date?: string
          p_lines: Json
          p_notes?: string
          p_po_id: string
          p_supplier_id: string
          p_terms?: string
        }
        Returns: Json
      }
      validate_stock_sufficiency: {
        Args: {
          p_balance?: Database["public"]["Tables"]["inventory_balance"]["Row"]
          p_item_id: string
          p_qty_needed: number
        }
        Returns: undefined
      }
    }
    Enums: {
      document_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "converted"
        | "rejected"
        | "cancelled"
      gst_rate: "0" | "5" | "12" | "18" | "28" | "40" | "3" | "0.25"
      movement_type:
        | "inbound"
        | "consumed"
        | "produced"
        | "sold"
        | "adjustment_in"
        | "adjustment_out"
        | "returned_supplier"
        | "returned_client"
      order_status:
        | "draft"
        | "confirmed"
        | "in_production"
        | "ready"
        | "dispatched"
        | "delivered"
        | "cancelled"
      production_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "on_hold"
        | "cancelled"
      reservation_status:
        | "active"
        | "partially_consumed"
        | "consumed"
        | "released"
        | "expired"
      transport_mode:
        | "own_truck"
        | "client_truck"
        | "supplier_truck"
        | "courier"
        | "hand_delivery"
      user_role:
        | "admin"
        | "manager"
        | "sales"
        | "store"
        | "production"
        | "viewer"
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
      document_status: [
        "draft",
        "pending_approval",
        "approved",
        "converted",
        "rejected",
        "cancelled",
      ],
      gst_rate: ["0", "5", "12", "18", "28", "40", "3", "0.25"],
      movement_type: [
        "inbound",
        "consumed",
        "produced",
        "sold",
        "adjustment_in",
        "adjustment_out",
        "returned_supplier",
        "returned_client",
      ],
      order_status: [
        "draft",
        "confirmed",
        "in_production",
        "ready",
        "dispatched",
        "delivered",
        "cancelled",
      ],
      production_status: [
        "pending",
        "in_progress",
        "completed",
        "on_hold",
        "cancelled",
      ],
      reservation_status: [
        "active",
        "partially_consumed",
        "consumed",
        "released",
        "expired",
      ],
      transport_mode: [
        "own_truck",
        "client_truck",
        "supplier_truck",
        "courier",
        "hand_delivery",
      ],
      user_role: ["admin", "manager", "sales", "store", "production", "viewer"],
    },
  },
} as const
