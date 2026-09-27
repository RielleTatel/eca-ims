export interface ApiEnvelope<T> {
  success: boolean
  message?: string
  data: T
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type SortOrder = 'asc' | 'desc'
export type ItemCondition = 'GOOD' | 'FAIR' | 'DAMAGED' | 'UNDER_REPAIR' | 'LOST'
export type BorrowingStatus = 'ACTIVE' | 'RETURNED' | 'ARCHIVED'
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

export interface Category {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface SystemSettings {
  id: string
  siteaoGovernorName: string
  updatedAt: string | null
  updater: {
    id: string
    username: string
  } | null
}

export interface InventoryItem {
  id: string
  itemCode: string
  categoryId: string
  itemName: string
  description: string | null
  totalQuantity: number
  availableQuantity: number
  damagedQuantity: number
  condition: ItemCondition
  storageLocation: string
  googleDriveFolderLink: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  category: {
    id: string
    name: string
  }
}

export interface BorrowingReturn {
  id: string
  quantity: number
  condition: ReturnCondition
  notes: string | null
  createdAt: string
  recordedBy: { id: string; username: string }
}

export interface BorrowingItem {
  id: string
  itemId: string
  quantityBorrowed: number
  quantityReturned: number
  quantityLost: number
  quantityDamaged: number
  outstandingQuantity: number
  item: { id: string; itemCode: string; itemName: string; categoryName: string }
  returns: BorrowingReturn[]
}

export interface BorrowingRecord {
  id: string
  borrowingCode: string
  borrowerName: string
  studentId: string | null
  contactDetails: string | null
  purpose: string
  borrowDate: string
  expectedReturnDate: string
  additionalNotes: string | null
  status: BorrowingStatus
  isLegacy: boolean
  legacyStatus: string | null
  borrowedAt: string | null
  returnedAt: string | null
  createdAt: string
  updatedAt: string
  recordedBy: { id: string; username: string }
  items: BorrowingItem[]
  outstandingQuantity: number
}

export interface InventoryTransactionRecord {
  id: string
  transactionType: TransactionType
  quantity: number
  quantityBefore: number
  quantityAfter: number
  remarks: string | null
  createdAt: string
  item: {
    id: string
    itemCode: string
    itemName: string
  }
  borrowing: {
    id: string
    borrowingCode: string
  } | null
  performer: {
    id: string
    username: string
  }
}

export interface AuditLogRecord {
  id: string
  action: string
  entityType: string
  entityId: string | null
  description: string
  oldValues: unknown
  newValues: unknown
  ipAddress: string | null
  createdAt: string
  user: {
    id: string
    username: string
  } | null
}
