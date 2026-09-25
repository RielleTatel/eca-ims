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

export interface Category {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Committee {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CommitteeAccount {
  id: string
  username: string
  role: 'COMMITTEE'
  isActive: boolean
  committee: {
    id: string
    name: string
  } | null
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

export interface BorrowingRequestSummary {
  id: string
  requestCode: string
  committeeId: string
  submittedBy: string
  requesterName: string
  requesterPosition: string
  purpose: string
  borrowDate: string
  expectedReturnDate: string
  status: RequestStatus
  createdAt: string
  updatedAt: string
  committee: {
    id: string
    name: string
  }
  submitter: {
    id: string
    username: string
  }
  itemCount: number
  totalRequestedQuantity?: number
}

export interface BorrowingRequestDetails
  extends Omit<BorrowingRequestSummary, 'itemCount' | 'totalRequestedQuantity'> {
  itemCount?: number
  totalRequestedQuantity?: number
  additionalNotes: string | null
  rejectionReason: string | null
  approvedBy: string | null
  approvedAt: string | null
  rejectedBy: string | null
  rejectedAt: string | null
  returnedAt?: string | null
  submittedAt: string
  items: Array<{
    id: string
    itemId: string
    quantityRequested: number
    quantityApproved?: number | null
    quantityReturned?: number
    returnCondition?: ReturnCondition | null
    returnNotes?: string | null
    createdAt: string
    item: {
      id: string
      itemCode: string
      itemName: string
      availableQuantity: number
      condition: ItemCondition
      isActive: boolean
      category: {
        id: string
        name: string
        isActive: boolean
      }
    }
  }>
}

export interface BorrowingHistoryRecord {
  id: string
  requestCode: string
  requesterName: string
  requesterPosition: string
  purpose: string
  borrowDate: string
  expectedReturnDate: string
  returnedAt: string | null
  status: RequestStatus
  createdAt: string
  updatedAt: string
  committee: {
    id: string
    name: string
  }
  requestedBy: {
    id: string
    username: string
  }
  items: Array<{
    id: string
    itemId: string
    itemCode: string
    itemName: string
    quantityRequested: number
    returnCondition: string | null
    remarks: string | null
  }>
}

export interface ItemBorrowingHistoryEntry {
  borrowingRequestId: string
  requestCode: string
  committee: {
    id: string
    name: string
  }
  requester: {
    name: string
    position: string
    user: {
      id: string
      username: string
    }
  }
  borrowDate: string
  expectedReturnDate: string
  returnedAt: string | null
  status: RequestStatus
  quantityRequested: number
  quantityApproved: number | null
  quantityReleased: number | null
  quantityReturned: number
  returnCondition: string | null
  returnNotes: string | null
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
  borrowingRequest: {
    id: string
    requestCode: string
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
  committee: {
    id: string
    name: string
  } | null
}
