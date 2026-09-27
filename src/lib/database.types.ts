export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type UserRole = 'SUPER_ADMIN' | 'ARCHIVED'
export type ItemCondition = 'GOOD' | 'FAIR' | 'DAMAGED' | 'UNDER_REPAIR' | 'LOST'
export type BorrowingStatus = 'ACTIVE' | 'RETURNED' | 'ARCHIVED'
export type ReturnCondition = 'GOOD' | 'FAIR' | 'DAMAGED' | 'LOST'
export type TransactionType = 'ITEM_ADDED' | 'QUANTITY_INCREASED' | 'QUANTITY_DECREASED' | 'BORROWED' | 'RETURNED' | 'DAMAGED' | 'LOST' | 'ADJUSTMENT'

type Relationship<Name extends string, Column extends string, Relation extends string> = {
  foreignKeyName: Name; columns: [Column]; isOneToOne: false; referencedRelation: Relation; referencedColumns: ['id']
}
type Table<Row, Required extends keyof Row, Relationships extends unknown[] = []> = {
  Row: Row; Insert: Partial<Row> & Pick<Row, Required>; Update: Partial<Row>; Relationships: Relationships
}
type Timestamps = { created_at: string; updated_at: string }
export type BorrowingRow = Timestamps & {
  id: string; borrowing_code: string; recorded_by: string; borrower_name: string; student_id: string | null
  contact_details: string | null; purpose: string; borrow_date: string; expected_return_date: string
  additional_notes: string | null; status: BorrowingStatus; is_legacy: boolean; legacy_metadata: Json | null
  borrowed_at: string | null; returned_at: string | null
}
export type BorrowingItemRow = Timestamps & {
  id: string; borrowing_id: string; item_id: string; quantity_borrowed: number; quantity_returned: number
  quantity_lost: number; quantity_damaged: number
}
export interface Database {
  public: {
    Tables: {
      profiles: Table<Timestamps & { id: string; username: string; role: UserRole; is_active: boolean }, 'id' | 'username'>
      categories: Table<Timestamps & { id: string; name: string; description: string | null; is_active: boolean; created_by: string | null }, 'name', [Relationship<'categories_created_by_fkey', 'created_by', 'profiles'>]>
      items: Table<Timestamps & {
        id: string; item_code: string; category_id: string; item_name: string; description: string | null
        total_quantity: number; available_quantity: number; damaged_quantity: number; condition: ItemCondition
        storage_location: string; google_drive_folder_link: string | null; is_active: boolean
        created_by: string | null; updated_by: string | null
      }, 'item_code' | 'category_id' | 'item_name' | 'total_quantity' | 'available_quantity' | 'storage_location', [Relationship<'items_category_id_fkey', 'category_id', 'categories'>]>
      borrowings: Table<BorrowingRow, 'borrowing_code' | 'recorded_by' | 'borrower_name' | 'purpose' | 'borrow_date' | 'expected_return_date', [Relationship<'borrowings_recorded_by_fkey', 'recorded_by', 'profiles'>]>
      borrowing_items: Table<BorrowingItemRow, 'borrowing_id' | 'item_id' | 'quantity_borrowed', [Relationship<'borrowing_items_borrowing_id_fkey', 'borrowing_id', 'borrowings'>, Relationship<'borrowing_items_item_id_fkey', 'item_id', 'items'>]>
      borrowing_returns: Table<{
        id: string; borrowing_item_id: string; quantity: number; condition: ReturnCondition; notes: string | null
        recorded_by: string; created_at: string
      }, 'borrowing_item_id' | 'quantity' | 'condition' | 'recorded_by', [Relationship<'borrowing_returns_borrowing_item_id_fkey', 'borrowing_item_id', 'borrowing_items'>, Relationship<'borrowing_returns_recorded_by_fkey', 'recorded_by', 'profiles'>]>
      inventory_transactions: Table<{
        id: string; item_id: string; borrowing_id: string | null; performed_by: string; transaction_type: TransactionType
        quantity: number; quantity_before: number; quantity_after: number; remarks: string | null; created_at: string
      }, 'item_id' | 'performed_by' | 'transaction_type' | 'quantity' | 'quantity_before' | 'quantity_after', [Relationship<'inventory_transactions_item_id_fkey', 'item_id', 'items'>, Relationship<'inventory_transactions_borrowing_id_fkey', 'borrowing_id', 'borrowings'>, Relationship<'inventory_transactions_performed_by_fkey', 'performed_by', 'profiles'>]>
      audit_logs: Table<{
        id: string; user_id: string | null; action: string; entity_type: string; entity_id: string | null; description: string
        old_values: Json | null; new_values: Json | null; ip_address: string | null; created_at: string
      }, 'action' | 'entity_type' | 'description', [Relationship<'audit_logs_user_id_fkey', 'user_id', 'profiles'>]>
      system_settings: Table<Timestamps & {
        id: string; siteao_governor_name: string; updated_by: string | null
      }, never, [Relationship<'system_settings_updated_by_fkey', 'updated_by', 'profiles'>]>
    }
    Views: { [_ in never]: never }
    Functions: {
      record_borrowing: {
        Args: { p_borrower_name: string; p_student_id: string; p_contact_details: string | null; p_purpose: string; p_borrow_date: string; p_expected_return_date: string; p_additional_notes: string | null; p_items: Json }
        Returns: Json
      }
      record_borrowing_return: { Args: { p_borrowing_id: string; p_returns: Json }; Returns: Json }
      update_borrowing_details: {
        Args: { p_borrowing_id: string; p_borrower_name: string; p_student_id: string; p_contact_details: string | null; p_expected_return_date: string; p_purpose: string; p_additional_notes: string | null }
        Returns: Json
      }
      update_inventory_item: { Args: { p_item_id: string; p_input: Json }; Returns: undefined }
      repair_inventory_units: { Args: { p_item_id: string; p_quantity: number }; Returns: undefined }
      get_dashboard_metrics: { Args: Record<PropertyKey, never>; Returns: Json }
    }
    Enums: { account_role: UserRole; item_condition: ItemCondition; borrowing_status: BorrowingStatus; return_condition: ReturnCondition; transaction_type: TransactionType }
  }
}
