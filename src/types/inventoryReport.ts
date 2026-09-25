import type { ItemCondition, Pagination, SortOrder } from '@/types/api'

export type InventoryReportSortField =
  | 'itemName'
  | 'itemCode'
  | 'condition'
  | 'totalQuantity'
  | 'availableQuantity'
  | 'createdAt'
  | 'updatedAt'

export interface InventoryReportMetadata {
  title: 'INVENTORY REPORT'
  dateOfInventory: string
  conductedBy: 'Logistics Team'
  preparedBy: 'Logistics Team'
  notedBy: {
    name: string
    title: 'ECA Governor'
  }
}

export interface InventoryReportSummary {
  distinctItems: number
  totalQuantity: number
  availableQuantity: number
  borrowedQuantity: number
}

export interface InventoryReportItem {
  id: string
  itemCode: string
  itemName: string
  condition: ItemCondition
  conditionLabel: string
  quantity: number
  availableQuantity: number
  borrowedQuantity: number
  category: {
    id: string
    name: string
  }
  storageLocation: string
  isActive: boolean
}

export interface InventoryReportResponse {
  report: InventoryReportMetadata
  summary: InventoryReportSummary
  items: InventoryReportItem[]
  generatedAt: string
  pagination: Pagination
}

export interface InventoryReportFilters {
  search?: string
  categoryId?: string
  condition?: ItemCondition
  isActive: boolean
  sortBy: InventoryReportSortField
  sortOrder: SortOrder
}

export interface InventoryReportPreviewParams extends InventoryReportFilters {
  page: number
  limit: number
}

export interface InventoryReportDownload {
  blob: Blob
  contentDisposition?: string
}
