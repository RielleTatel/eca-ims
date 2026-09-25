export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'SUPER_ADMIN' | 'COMMITTEE'
export type ItemCondition = 'GOOD' | 'FAIR' | 'DAMAGED' | 'UNDER_REPAIR' | 'LOST'
export type RequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'BORROWED'
  | 'RETURNED'
export type ReturnCondition = 'GOOD' | 'FAIR' | 'DAMAGED' | 'LOST'
export type TransactionType =
  | 'ITEM_ADDED'
  | 'QUANTITY_INCREASED'
  | 'QUANTITY_DECREASED'
  | 'BORROWED'
  | 'RETURNED'
  | 'DAMAGED'
  | 'LOST'
  | 'ADJUSTMENT'

export interface Database {
  public: {
    Tables: {
      committees: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          committee_id: string | null
          username: string
          role: UserRole
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          committee_id?: string | null
          username: string
          role?: UserRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          committee_id?: string | null
          username?: string
          role?: UserRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_committee_id_fkey'
            columns: ['committee_id']
            isOneToOne: true
            referencedRelation: 'committees'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categories_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      items: {
        Row: {
          id: string
          item_code: string
          category_id: string
          item_name: string
          description: string | null
          total_quantity: number
          available_quantity: number
          condition: ItemCondition
          storage_location: string
          google_drive_folder_link: string | null
          is_active: boolean
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          item_code: string
          category_id: string
          item_name: string
          description?: string | null
          total_quantity: number
          available_quantity: number
          condition?: ItemCondition
          storage_location: string
          google_drive_folder_link?: string | null
          is_active?: boolean
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          item_code?: string
          category_id?: string
          item_name?: string
          description?: string | null
          total_quantity?: number
          available_quantity?: number
          condition?: ItemCondition
          storage_location?: string
          google_drive_folder_link?: string | null
          is_active?: boolean
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'items_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      borrowing_requests: {
        Row: {
          id: string
          request_code: string
          committee_id: string
          submitted_by: string
          requester_name: string
          requester_position: string
          purpose: string
          borrow_date: string
          expected_return_date: string
          additional_notes: string | null
          status: RequestStatus
          rejection_reason: string | null
          cancellation_reason: string | null
          approved_by: string | null
          approved_at: string | null
          rejected_by: string | null
          rejected_at: string | null
          cancelled_by: string | null
          cancelled_at: string | null
          borrowed_at: string | null
          returned_at: string | null
          submitted_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          request_code: string
          committee_id: string
          submitted_by: string
          requester_name: string
          requester_position: string
          purpose: string
          borrow_date: string
          expected_return_date: string
          additional_notes?: string | null
          status?: RequestStatus
          rejection_reason?: string | null
          cancellation_reason?: string | null
          approved_by?: string | null
          approved_at?: string | null
          rejected_by?: string | null
          rejected_at?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          borrowed_at?: string | null
          returned_at?: string | null
          submitted_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          request_code?: string
          committee_id?: string
          submitted_by?: string
          requester_name?: string
          requester_position?: string
          purpose?: string
          borrow_date?: string
          expected_return_date?: string
          additional_notes?: string | null
          status?: RequestStatus
          rejection_reason?: string | null
          cancellation_reason?: string | null
          approved_by?: string | null
          approved_at?: string | null
          rejected_by?: string | null
          rejected_at?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          borrowed_at?: string | null
          returned_at?: string | null
          submitted_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'borrowing_requests_committee_id_fkey'
            columns: ['committee_id']
            isOneToOne: false
            referencedRelation: 'committees'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'borrowing_requests_submitted_by_fkey'
            columns: ['submitted_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      borrowing_request_items: {
        Row: {
          id: string
          borrowing_request_id: string
          item_id: string
          quantity_requested: number
          quantity_approved: number | null
          quantity_released: number | null
          quantity_returned: number
          return_condition: ReturnCondition | null
          return_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          borrowing_request_id: string
          item_id: string
          quantity_requested: number
          quantity_approved?: number | null
          quantity_released?: number | null
          quantity_returned?: number
          return_condition?: ReturnCondition | null
          return_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          borrowing_request_id?: string
          item_id?: string
          quantity_requested?: number
          quantity_approved?: number | null
          quantity_released?: number | null
          quantity_returned?: number
          return_condition?: ReturnCondition | null
          return_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'borrowing_request_items_borrowing_request_id_fkey'
            columns: ['borrowing_request_id']
            isOneToOne: false
            referencedRelation: 'borrowing_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'borrowing_request_items_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
      }
      inventory_transactions: {
        Row: {
          id: string
          item_id: string
          borrowing_request_id: string | null
          performed_by: string
          transaction_type: TransactionType
          quantity: number
          quantity_before: number
          quantity_after: number
          remarks: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          borrowing_request_id?: string | null
          performed_by: string
          transaction_type: TransactionType
          quantity: number
          quantity_before: number
          quantity_after: number
          remarks?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          borrowing_request_id?: string | null
          performed_by?: string
          transaction_type?: TransactionType
          quantity?: number
          quantity_before?: number
          quantity_after?: number
          remarks?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_transactions_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_transactions_borrowing_request_id_fkey'
            columns: ['borrowing_request_id']
            isOneToOne: false
            referencedRelation: 'borrowing_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_transactions_performed_by_fkey'
            columns: ['performed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          committee_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          description: string
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          committee_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          description: string
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          committee_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          description?: string
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_logs_committee_id_fkey'
            columns: ['committee_id']
            isOneToOne: false
            referencedRelation: 'committees'
            referencedColumns: ['id']
          },
        ]
      }
      system_settings: {
        Row: {
          id: string
          siteao_governor_name: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          siteao_governor_name?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          siteao_governor_name?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'system_settings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_borrowing_request: {
        Args: {
          p_requester_name: string
          p_requester_position: string
          p_purpose: string
          p_borrow_date: string
          p_expected_return_date: string
          p_additional_notes: string | null
          p_items: Json
        }
        Returns: Json
      }
      approve_borrowing_request: {
        Args: {
          p_request_id: string
          p_remarks?: string | null
        }
        Returns: Json
      }
      reject_borrowing_request: {
        Args: {
          p_request_id: string
          p_reason: string
        }
        Returns: Json
      }
      return_borrowing_request: {
        Args: {
          p_request_id: string
          p_condition: ReturnCondition
          p_notes?: string | null
        }
        Returns: Json
      }
      get_dashboard_metrics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_create_committee_account: {
        Args: {
          p_username: string
          p_password: string
          p_committee_id: string
        }
        Returns: Json
      }
      admin_reset_committee_password: {
        Args: {
          p_user_id: string
          p_new_password: string
        }
        Returns: Json
      }
    }
    Enums: {
      user_role: UserRole
      item_condition: ItemCondition
      request_status: RequestStatus
      return_condition: ReturnCondition
      transaction_type: TransactionType
    }
  }
}
