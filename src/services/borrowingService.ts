import { supabase } from '@/lib/supabase'
import type { BorrowingItemRow, BorrowingRow, Json } from '@/lib/database.types'
import type { BorrowingRecord, BorrowingStatus, ReturnCondition, SortOrder } from '@/types/api'

export interface BorrowingListParams {
  status?: BorrowingStatus
  overdueOnly?: boolean
  itemId?: string
  search?: string
  page: number
  limit: number
  sortBy: 'createdAt' | 'borrowDate' | 'expectedReturnDate' | 'status'
  sortOrder: SortOrder
}

export interface BorrowingDetailsInput {
  borrowerName: string
  studentId: string
  contactDetails?: string
  purpose: string
  expectedReturnDate: string
  additionalNotes?: string
}

export interface BorrowingInput extends BorrowingDetailsInput {
  borrowDate: string
  items: Array<{ itemId: string; quantity: number }>
}

export interface BorrowingReturnInput {
  borrowingItemId: string
  quantity: number
  condition: ReturnCondition
  notes?: string
}

// Calendar dates throughout the borrowing workflow use the ECA's local timezone.
export function todayInManila() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

export function isOverdue(record: Pick<BorrowingRecord, 'status' | 'expectedReturnDate'>) {
  return record.status === 'ACTIVE' && record.expectedReturnDate < todayInManila()
}

export function displayBorrowingDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString()
}

const selection = `
  *, recorder:profiles!borrowings_recorded_by_fkey(id, username),
  items:borrowing_items(
    *, item:items(id, item_code, item_name, category:categories(name)),
    returns:borrowing_returns(*, recorder:profiles!borrowing_returns_recorded_by_fkey(id, username))
  )
` as const

type RawRecord = BorrowingRow & {
  recorder: { id: string; username: string } | null
  items: Array<BorrowingItemRow & {
    item: { id: string; item_code: string; item_name: string; category: { name: string } | null } | null
    returns: Array<{
      id: string; quantity: number; condition: ReturnCondition; notes: string | null; created_at: string
      recorder: { id: string; username: string } | null
    }>
  }>
}

function mapBorrowing(row: RawRecord): BorrowingRecord {
  const items = row.items.map((line) => ({
    id: line.id,
    itemId: line.item_id,
    quantityBorrowed: line.quantity_borrowed,
    quantityReturned: line.quantity_returned,
    quantityLost: line.quantity_lost,
    quantityDamaged: line.quantity_damaged,
    outstandingQuantity: row.status === 'ARCHIVED' ? 0 : line.quantity_borrowed - line.quantity_returned - line.quantity_lost,
    item: {
      id: line.item_id,
      itemCode: line.item?.item_code ?? '',
      itemName: line.item?.item_name ?? 'Historical item',
      categoryName: line.item?.category?.name ?? 'Uncategorized',
    },
    returns: line.returns.map((entry) => ({
      id: entry.id,
      quantity: entry.quantity,
      condition: entry.condition,
      notes: entry.notes,
      createdAt: entry.created_at,
      recordedBy: entry.recorder ?? { id: '', username: 'Historical account' },
    })).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }))
  const legacy = row.legacy_metadata as Record<string, Json> | null
  return {
    id: row.id,
    borrowingCode: row.borrowing_code,
    borrowerName: row.borrower_name,
    studentId: row.student_id,
    contactDetails: row.contact_details,
    purpose: row.purpose,
    borrowDate: row.borrow_date,
    expectedReturnDate: row.expected_return_date,
    additionalNotes: row.additional_notes,
    status: row.status,
    isLegacy: row.is_legacy,
    legacyStatus: typeof legacy?.status === 'string' ? legacy.status : null,
    borrowedAt: row.borrowed_at,
    returnedAt: row.returned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    recordedBy: row.recorder ?? { id: row.recorded_by, username: 'Historical account' },
    items,
    outstandingQuantity: items.reduce((sum, line) => sum + line.outstandingQuantity, 0),
  }
}

const sortColumns = {
  createdAt: 'created_at', borrowDate: 'borrow_date', expectedReturnDate: 'expected_return_date', status: 'status',
} as const

export const borrowingService = {
  async list(params: BorrowingListParams, signal?: AbortSignal) {
    let query = supabase.from('borrowings').select(params.itemId ? selection.replace('items:borrowing_items(', 'items:borrowing_items!inner(') : selection, { count: 'exact' })
    if (params.status) query = query.eq('status', params.status)
    if (params.overdueOnly) query = query.eq('status', 'ACTIVE').lt('expected_return_date', todayInManila())
    if (params.itemId) query = query.eq('items.item_id', params.itemId)
    if (params.search?.trim()) {
      // Quote PostgREST values so punctuation in names/IDs cannot alter the filter.
      const term = params.search.trim().replace(/[\\"%_]/g, '\\$&')
      query = query.or(`borrowing_code.ilike."%${term}%",borrower_name.ilike."%${term}%",student_id.ilike."%${term}%"`)
    }
    query = query.order(sortColumns[params.sortBy], { ascending: params.sortOrder === 'asc' })
      .order('id', { ascending: true })
      .range((params.page - 1) * params.limit, params.page * params.limit - 1)
    if (signal) query = query.abortSignal(signal)
    const { data, count, error } = await query
    if (error) throw error
    return {
      borrowings: (data ?? []).map((row) => mapBorrowing(row as unknown as RawRecord)),
      pagination: { page: params.page, limit: params.limit, total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / params.limit)) },
    }
  },

  async get(id: string, signal?: AbortSignal) {
    let query = supabase.from('borrowings').select(selection).eq('id', id)
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query.single()
    if (error || !data) throw error ?? new Error('Borrowing record not found.')
    return mapBorrowing(data as unknown as RawRecord)
  },

  async create(input: BorrowingInput) {
    const { data, error } = await supabase.rpc('record_borrowing', {
      p_borrower_name: input.borrowerName.trim(), p_student_id: input.studentId.trim(),
      p_contact_details: input.contactDetails?.trim() || null, p_purpose: input.purpose.trim(),
      p_borrow_date: input.borrowDate, p_expected_return_date: input.expectedReturnDate,
      p_additional_notes: input.additionalNotes?.trim() || null, p_items: input.items,
    })
    if (error) throw error
    return data as { id: string; borrowingCode: string }
  },

  async processReturn(id: string, returns: BorrowingReturnInput[]) {
    const { error } = await supabase.rpc('record_borrowing_return', { p_borrowing_id: id, p_returns: returns.map((line) => ({ ...line, notes: line.notes?.trim() || null })) })
    if (error) throw error
  },

  async updateDetails(id: string, input: BorrowingDetailsInput) {
    const { error } = await supabase.rpc('update_borrowing_details', {
      p_borrowing_id: id, p_borrower_name: input.borrowerName.trim(), p_student_id: input.studentId.trim(),
      p_contact_details: input.contactDetails?.trim() || null, p_purpose: input.purpose.trim(),
      p_expected_return_date: input.expectedReturnDate, p_additional_notes: input.additionalNotes?.trim() || null,
    })
    if (error) throw error
  },
}
