import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { supabase } from '@/lib/supabase'
import type { ItemCondition } from '@/types/api'
import type {
  InventoryReportDownload,
  InventoryReportFilters,
  InventoryReportItem,
  InventoryReportMetadata,
  InventoryReportPreviewParams,
  InventoryReportResponse,
  InventoryReportSummary,
} from '@/types/inventoryReport'

const CONDITION_LABELS: Record<ItemCondition, string> = {
  GOOD: 'Good',
  FAIR: 'Fair',
  DAMAGED: 'Damaged',
  UNDER_REPAIR: 'Under Repair',
  LOST: 'Lost',
}

const SORT_FIELD_MAP: Record<InventoryReportFilters['sortBy'], string> = {
  itemName: 'item_name',
  itemCode: 'item_code',
  condition: 'condition',
  totalQuantity: 'total_quantity',
  availableQuantity: 'available_quantity',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

async function fetchReportDataset(filters: InventoryReportFilters) {
  // Fetch system settings for Governor name
  const { data: settings } = await supabase
    .from('system_settings')
    .select('siteao_governor_name')
    .eq('id', 'siteao')
    .single()

  const governorName = settings?.siteao_governor_name || 'HON. JHERMIE P. LICAROS'

  let query = supabase
    .from('items')
    .select(`
      id,
      item_code,
      category_id,
      item_name,
      description,
      total_quantity,
      available_quantity,
      condition,
      storage_location,
      is_active,
      created_at,
      updated_at,
      category:categories (
        id,
        name
      )
    `)

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim()
    query = query.or(`item_name.ilike.%${term}%,item_code.ilike.%${term}%,storage_location.ilike.%${term}%`)
  }

  if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId)
  }

  if (filters.condition) {
    query = query.eq('condition', filters.condition)
  }

  if (filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }

  const sortCol = SORT_FIELD_MAP[filters.sortBy] || 'item_name'
  query = query.order(sortCol, { ascending: filters.sortOrder === 'asc' })

  const { data, error } = await query

  if (error) {
    throw error
  }

  const rawItems = data || []

  let totalQty = 0
  let availQty = 0
  let borrowedQty = 0

  const items: InventoryReportItem[] = rawItems.map((r) => {
    const total = r.total_quantity
    const available = r.available_quantity
    const borrowed = Math.max(0, total - available)

    totalQty += total
    availQty += available
    borrowedQty += borrowed

    return {
      id: r.id,
      itemCode: r.item_code,
      itemName: r.item_name,
      condition: r.condition as ItemCondition,
      conditionLabel: CONDITION_LABELS[r.condition as ItemCondition] || r.condition,
      quantity: total,
      availableQuantity: available,
      borrowedQuantity: borrowed,
      category: r.category as { id: string; name: string },
      storageLocation: r.storage_location,
      isActive: r.is_active,
    }
  })

  const metadata: InventoryReportMetadata = {
    title: 'INVENTORY REPORT',
    dateOfInventory: formatDate(new Date()),
    conductedBy: 'Logistics Team',
    preparedBy: 'Logistics Team',
    notedBy: {
      name: governorName,
      title: 'ECA Governor',
    },
  }

  const summary: InventoryReportSummary = {
    distinctItems: items.length,
    totalQuantity: totalQty,
    availableQuantity: availQty,
    borrowedQuantity: borrowedQty,
  }

  return { metadata, summary, items }
}

export const inventoryReportService = {
  async get(params: InventoryReportPreviewParams, _signal?: AbortSignal): Promise<InventoryReportResponse> {
    const { metadata, summary, items } = await fetchReportDataset(params)

    const from = (params.page - 1) * params.limit
    const paginatedItems = items.slice(from, from + params.limit)
    const totalPages = Math.ceil(items.length / params.limit) || 1

    return {
      report: metadata,
      summary,
      items: paginatedItems,
      generatedAt: new Date().toISOString(),
      pagination: {
        page: params.page,
        limit: params.limit,
        total: items.length,
        totalPages,
      },
    }
  },

  async downloadCsv(filters: InventoryReportFilters): Promise<InventoryReportDownload> {
    const { items } = await fetchReportDataset(filters)

    const headers = [
      'Item Code',
      'Item',
      'Category',
      'Condition',
      'Total Quantity',
      'Available Quantity',
      'Borrowed Quantity',
      'Storage Location',
      'Status',
    ]

    const rows = items.map((i) =>
      [
        escapeCsvValue(i.itemCode),
        escapeCsvValue(i.itemName),
        escapeCsvValue(i.category?.name),
        escapeCsvValue(i.conditionLabel),
        i.quantity,
        i.availableQuantity,
        i.borrowedQuantity,
        escapeCsvValue(i.storageLocation),
        i.isActive ? 'Active' : 'Inactive',
      ].join(','),
    )

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const filename = `inventory-report-${new Date().toISOString().slice(0, 10)}.csv`

    return {
      blob,
      contentDisposition: `attachment; filename="${filename}"`,
    }
  },

  async downloadPdf(filters: InventoryReportFilters): Promise<InventoryReportDownload> {
    const { metadata, summary, items } = await fetchReportDataset(filters)

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Header Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(24, 34, 53) // Navy
    doc.text('SITEAO OpsTracker - INVENTORY REPORT', 14, 20)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(90, 90, 90)
    doc.text(`Date of Inventory: ${metadata.dateOfInventory}`, 14, 27)
    doc.text(`Conducted By: ${metadata.conductedBy}`, 14, 32)
    doc.text(`Noted By: ${metadata.notedBy.name} (${metadata.notedBy.title})`, 14, 37)

    // Summary box
    doc.setDrawColor(220, 220, 220)
    doc.setFillColor(248, 249, 250)
    doc.roundedRect(14, 42, 182, 16, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.text(`Total Distinct Items: ${summary.distinctItems}`, 20, 52)
    doc.text(`Total Units: ${summary.totalQuantity}`, 70, 52)
    doc.text(`Available: ${summary.availableQuantity}`, 120, 52)
    doc.text(`Borrowed: ${summary.borrowedQuantity}`, 160, 52)

    // Table
    const tableBody = items.map((i) => [
      i.itemCode,
      i.itemName,
      i.category?.name || '—',
      i.conditionLabel,
      String(i.quantity),
      String(i.availableQuantity),
      String(i.borrowedQuantity),
      i.storageLocation,
    ])

    autoTable(doc, {
      startY: 63,
      head: [
        [
          'Item Code',
          'Item Name',
          'Category',
          'Condition',
          'Total',
          'Avail',
          'Borrowed',
          'Location',
        ],
      ],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [24, 34, 53],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [40, 40, 40],
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      margin: { left: 14, right: 14, bottom: 20 },
    })

    const blob = doc.output('blob')
    const filename = `inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`

    return {
      blob,
      contentDisposition: `attachment; filename="${filename}"`,
    }
  },
}
