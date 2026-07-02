export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
          ref_id: string
          ref_type: string
        }
        Insert: {
          action: string
          actioned_at?: string
          actioned_by: string
          comments?: string | null
          id?: string
          ref_id: string
          ref_type: string
        }
        Update: {
          action?: string
          actioned_at?: string
          actioned_by?: string
          comments?: string | null
          id?: string
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
          qty_per_unit: number
          unit: Database["public"]["Enums"]["unit_of_measure"]
        }
        Insert: {
          component_id: string
          created_at?: string
          created_by?: string | null
          finished_item_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          qty_per_unit: number
          unit?: Database["public"]["Enums"]["unit_of_measure"]
        }
        Update: {
          component_id?: string
          created_at?: string
          created_by?: string | null
          finished_item_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          qty_per_unit?: number
          unit?: Database["public"]["Enums"]["unit_of_measure"]
        }
        Relationships: [
          {
            foreignKeyName: "bom_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_finished_item_id_fkey"
            columns: ["finished_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_finished_item_id_fkey"
            columns: ["finished_item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "bom_finished_item_id_fkey"
            columns: ["finished_item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
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
          phone: string | null
          state: string | null
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
          phone?: string | null
          state?: string | null
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
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
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
          unit: Database["public"]["Enums"]["unit_of_measure"]
        }
        Insert: {
          challan_id: string
          id?: string
          item_id: string
          line_total?: number | null
          qty: number
          rate?: number | null
          so_line_id?: string | null
          unit: Database["public"]["Enums"]["unit_of_measure"]
        }
        Update: {
          challan_id?: string
          id?: string
          item_id?: string
          line_total?: number | null
          qty?: number
          rate?: number | null
          so_line_id?: string | null
          unit?: Database["public"]["Enums"]["unit_of_measure"]
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
            foreignKeyName: "delivery_challan_lines_so_line_id_fkey"
            columns: ["so_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
            foreignKeyName: "delivery_challans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
      inbound_receipt_lines: {
        Row: {
          gst_percent: Database["public"]["Enums"]["gst_rate"]
          id: string
          item_id: string
          line_total: number | null
          notes: string | null
          qty_ordered: number | null
          qty_received: number
          rate: number
          receipt_id: string
          unit: Database["public"]["Enums"]["unit_of_measure"]
        }
        Insert: {
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id: string
          line_total?: number | null
          notes?: string | null
          qty_ordered?: number | null
          qty_received: number
          rate: number
          receipt_id: string
          unit: Database["public"]["Enums"]["unit_of_measure"]
        }
        Update: {
          gst_percent?: Database["public"]["Enums"]["gst_rate"]
          id?: string
          item_id?: string
          line_total?: number | null
          notes?: string | null
          qty_ordered?: number | null
          qty_received?: number
          rate?: number
          receipt_id?: string
          unit?: Database["public"]["Enums"]["unit_of_measure"]
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
            foreignKeyName: "inbound_receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
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
        ]
      }
      inventory_balance: {
        Row: {
          available_qty: number | null
          current_qty: number
          item_id: string
          reserved_qty: number
          updated_at: string
        }
        Insert: {
          available_qty?: number | null
          current_qty?: number
          item_id: string
          reserved_qty?: number
          updated_at?: string
        }
        Update: {
          available_qty?: number | null
          current_qty?: number
          item_id?: string
          reserved_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balance_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balance_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_balance_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
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
            foreignKeyName: "inventory_ops_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_ops_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_ops_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
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
          purchase_rate: number | null
          rate_unit: Database["public"]["Enums"]["unit_of_measure"]
          selling_rate: number | null
          supplier_id: string | null
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
          purchase_rate?: number | null
          rate_unit?: Database["public"]["Enums"]["unit_of_measure"]
          selling_rate?: number | null
          supplier_id?: string | null
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
          purchase_rate?: number | null
          rate_unit?: Database["public"]["Enums"]["unit_of_measure"]
          selling_rate?: number | null
          supplier_id?: string | null
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
            foreignKeyName: "item_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          created_at: string
          created_by: string | null
          hsn_code: string | null
          id: string
          is_active: boolean
          is_manufactured: boolean
          is_raw_material: boolean
          is_traded: boolean
          item_code: string
          material_type: Database["public"]["Enums"]["material_type"] | null
          name: string
          notes: string | null
          reorder_level: number | null
          reorder_qty: number | null
          size_spec: string | null
          sub_category: string | null
          unit: Database["public"]["Enums"]["unit_of_measure"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["item_category"]
          created_at?: string
          created_by?: string | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          is_manufactured?: boolean
          is_raw_material?: boolean
          is_traded?: boolean
          item_code: string
          material_type?: Database["public"]["Enums"]["material_type"] | null
          name: string
          notes?: string | null
          reorder_level?: number | null
          reorder_qty?: number | null
          size_spec?: string | null
          sub_category?: string | null
          unit?: Database["public"]["Enums"]["unit_of_measure"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string
          created_by?: string | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          is_manufactured?: boolean
          is_raw_material?: boolean
          is_traded?: boolean
          item_code?: string
          material_type?: Database["public"]["Enums"]["material_type"] | null
          name?: string
          notes?: string | null
          reorder_level?: number | null
          reorder_qty?: number | null
          size_spec?: string | null
          sub_category?: string | null
          unit?: Database["public"]["Enums"]["unit_of_measure"]
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
          unit: Database["public"]["Enums"]["unit_of_measure"]
        }
        Insert: {
          id?: string
          item_id: string
          production_order_id: string
          qty_produced?: number
          qty_required: number
          unit: Database["public"]["Enums"]["unit_of_measure"]
        }
        Update: {
          id?: string
          item_id?: string
          production_order_id?: string
          qty_produced?: number
          qty_required?: number
          unit?: Database["public"]["Enums"]["unit_of_measure"]
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
            foreignKeyName: "production_order_items_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
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
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
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
          unit: Database["public"]["Enums"]["unit_of_measure"]
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
          unit: Database["public"]["Enums"]["unit_of_measure"]
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
          unit?: Database["public"]["Enums"]["unit_of_measure"]
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
            foreignKeyName: "quotation_lines_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
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
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
          unit: Database["public"]["Enums"]["unit_of_measure"]
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
          unit: Database["public"]["Enums"]["unit_of_measure"]
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
          unit?: Database["public"]["Enums"]["unit_of_measure"]
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
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
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
            foreignKeyName: "stock_reservations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "stock_reservations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          skill: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          skill?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          skill?: string | null
        }
        Relationships: []
      }
    }
    Views: {
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
        Relationships: [
          {
            foreignKeyName: "item_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_reorder_alerts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_stock_levels"
            referencedColumns: ["item_id"]
          },
        ]
      }
      v_reorder_alerts: {
        Row: {
          balance_updated_at: string | null
          below_reorder: boolean | null
          category: string | null
          item_code: string | null
          item_id: string | null
          name: string | null
          qty_available: number | null
          qty_on_hand: number | null
          qty_reserved: number | null
          reorder_level: number | null
          unit: string | null
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
          item_code: string | null
          item_id: string | null
          name: string | null
          qty_available: number | null
          qty_on_hand: number | null
          qty_reserved: number | null
          reorder_level: number | null
          unit: string | null
        }
        Relationships: []
      }
    }
    Functions: {
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
      check_bom_availability: {
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
      lock_inventory_balance: {
        Args: { p_item_id: string }
        Returns: {
          available_qty: number | null
          current_qty: number
          item_id: string
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
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      next_dc_no: { Args: never; Returns: string }
      next_grn_no: { Args: never; Returns: string }
      next_prd_no: { Args: never; Returns: string }
      next_qt_no: { Args: never; Returns: string }
      next_so_no: { Args: never; Returns: string }
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
      reconcile_inventory_balance: {
        Args: never
        Returns: {
          diff: number
          item_id: string
          new_qty: number
          old_qty: number
        }[]
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
      gst_rate: "0" | "5" | "12" | "18" | "28"
      item_category:
        | "Conductor"
        | "Cable"
        | "Insulator"
        | "Structural"
        | "Clamp"
        | "Stay Set"
        | "TF Belt"
        | "Hardware"
        | "GOD"
        | "LA"
        | "Fastener"
        | "Earthing"
        | "DB"
        | "Lug"
        | "Accessories"
      material_type:
        | "GI"
        | "MS"
        | "Aluminium"
        | "Copper"
        | "Polymer"
        | "Porcelain"
        | "HDPE"
        | "Chemical"
        | "Concrete"
        | "Mixed"
        | "Other"
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
      unit_of_measure: "No." | "Mtr" | "Kg" | "Set" | "Pair" | "Lot" | "Km"
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
  graphql_public: {
    Enums: {},
  },
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
      gst_rate: ["0", "5", "12", "18", "28"],
      item_category: [
        "Conductor",
        "Cable",
        "Insulator",
        "Structural",
        "Clamp",
        "Stay Set",
        "TF Belt",
        "Hardware",
        "GOD",
        "LA",
        "Fastener",
        "Earthing",
        "DB",
        "Lug",
        "Accessories",
      ],
      material_type: [
        "GI",
        "MS",
        "Aluminium",
        "Copper",
        "Polymer",
        "Porcelain",
        "HDPE",
        "Chemical",
        "Concrete",
        "Mixed",
        "Other",
      ],
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
      unit_of_measure: ["No.", "Mtr", "Kg", "Set", "Pair", "Lot", "Km"],
      user_role: ["admin", "manager", "sales", "store", "production", "viewer"],
    },
  },
} as const

