import { supabase } from '@/lib/supabase'
import type {
  BorrowingHistoryRecord,
  BorrowingRequestDetails,
  BorrowingRequestSummary,
  Pagination,
  RequestStatus,
  ReturnCondition,
  SortOrder,
} from '@/types/api'

export interface RequestListParams {
  status?: RequestStatus
  committeeId?: string
  search?: string
  page: number
  limit: number
  sortBy: 'createdAt' | 'updatedAt' | 'borrowDate' | 'expectedReturnDate' | 'status'
  sortOrder: SortOrder
}

export interface HistoryListParams {
  status?: RequestStatus
  committeeId?: string
  itemId?: string
  search?: string
  page: number
  limit: number
  sortBy:
    | 'createdAt'
    | 'updatedAt'
    | 'borrowDate'
    | 'expectedReturnDate'
    | 'returnedAt'
    | 'status'
  sortOrder: SortOrder
}

export interface BorrowRequestInput {
  requesterName: string
  requesterPosition: string
  purpose: string
  borrowDate: string
  expectedReturnDate: string
  additionalNotes?: string | null
  items: Array<{
    itemId: string
    quantity: number
  }>
}

const SORT_FIELD_MAP: Record<string, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  borrowDate: 'borrow_date',
  expectedReturnDate: 'expected_return_date',
  returnedAt: 'returned_at',
  status: 'status',
}

export const requestService = {
  async list(params: RequestListParams, _committeeUser: boolean, _signal?: AbortSignal) {
    const { page, limit, status, committeeId, search, sortBy, sortOrder } = params
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('borrowing_requests')
      .select(
        `
        id,
        request_code,
        committee_id,
        submitted_by,
        requester_name,
        requester_position,
        purpose,
        borrow_date,
        expected_return_date,
        status,
        created_at,
        updated_at,
        committee:committees (
          id,
          name
        ),
        submitter:profiles!borrowing_requests_submitted_by_fkey (
          id,
          username
        ),
        items:borrowing_request_items (
          id,
          quantity_requested
        )
      `,
        { count: 'exact' },
      )

    if (status) {
      query = query.eq('status', status)
    }

    if (committeeId) {
      query = query.eq('committee_id', committeeId)
    }

    if (search && search.trim()) {
      const term = search.trim()
      query = query.or(`request_code.ilike.%${term}%,requester_name.ilike.%${term}%,purpose.ilike.%${term}%`)
    }

    const sortCol = SORT_FIELD_MAP[sortBy] || 'created_at'
    query = query.order(sortCol, { ascending: sortOrder === 'asc' }).range(from, to)

    const { data, count, error } = await query

    if (error) {
      throw error
    }

    const total = count ?? 0
    const totalPages = Math.ceil(total / limit) || 1

    const requests: BorrowingRequestSummary[] = (data || []).map((row) => {
      const items = (row.items || []) as Array<{ id: string; quantity_requested: number }>
      const totalRequestedQuantity = items.reduce((acc, curr) => acc + (curr.quantity_requested || 0), 0)

      return {
        id: row.id,
        requestCode: row.request_code,
        committeeId: row.committee_id,
        submittedBy: row.submitted_by,
        requesterName: row.requester_name,
        requesterPosition: row.requester_position,
        purpose: row.purpose,
        borrowDate: row.borrow_date,
        expectedReturnDate: row.expected_return_date,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        committee: row.committee as { id: string; name: string },
        submitter: (row.submitter || { id: row.submitted_by, username: 'Unknown' }) as {
          id: string
          username: string
        },
        itemCount: items.length,
        totalRequestedQuantity,
      }
    })

    const pagination: Pagination = {
      page,
      limit,
      total,
      totalPages,
    }

    return { requests, pagination }
  },

  async history(params: HistoryListParams, _signal?: AbortSignal) {
    const { page, limit, status, committeeId, itemId, search, sortBy, sortOrder } = params
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('borrowing_requests')
      .select(
        `
        id,
        request_code,
        submitted_by,
        requester_name,
        requester_position,
        purpose,
        borrow_date,
        expected_return_date,
        returned_at,
        status,
        created_at,
        updated_at,
        committee:committees (
          id,
          name
        ),
        submitter:profiles!borrowing_requests_submitted_by_fkey (
          id,
          username
        ),
        items:borrowing_request_items!inner (
          id,
          item_id,
          quantity_requested,
          quantity_returned,
          return_condition,
          item:items (
            id,
            item_code,
            item_name
          )
        )
      `,
        { count: 'exact' },
      )

    if (status) {
      query = query.eq('status', status)
    }

    if (committeeId) {
      query = query.eq('committee_id', committeeId)
    }

    if (itemId) {
      query = query.eq('items.item_id', itemId)
    }

    if (search && search.trim()) {
      const term = search.trim()
      query = query.or(`request_code.ilike.%${term}%,requester_name.ilike.%${term}%,purpose.ilike.%${term}%`)
    }

    const sortCol = SORT_FIELD_MAP[sortBy] || 'created_at'
    query = query.order(sortCol, { ascending: sortOrder === 'asc' }).range(from, to)

    const { data, count, error } = await query

    if (error) {
      throw error
    }

    const total = count ?? 0
    const totalPages = Math.ceil(total / limit) || 1

    const history: BorrowingHistoryRecord[] = (data || []).map((row) => {
      const rawItems = (row.items || []) as Array<{
        id: string
        item_id: string
        quantity_requested: number
        quantity_returned: number
        return_condition: ReturnCondition | null
        return_notes?: string | null
        item: { id: string; item_code: string; item_name: string }
      }>

      return {
        id: row.id,
        requestCode: row.request_code,
        requesterName: row.requester_name,
        requesterPosition: row.requester_position,
        purpose: row.purpose,
        borrowDate: row.borrow_date,
        expectedReturnDate: row.expected_return_date,
        returnedAt: row.returned_at,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        committee: row.committee as { id: string; name: string },
        requestedBy: (row.submitter || { id: row.submitted_by, username: 'Unknown' }) as {
          id: string
          username: string
        },
        items: rawItems.map((itemRow) => ({
          id: itemRow.id,
          itemId: itemRow.item_id,
          itemName: itemRow.item?.item_name || 'Item',
          itemCode: itemRow.item?.item_code || '',
          quantityRequested: itemRow.quantity_requested,
          returnCondition: itemRow.return_condition,
          remarks: itemRow.return_notes || null,
        })),
      }
    })

    return {
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }
  },

  async get(id: string, _signal?: AbortSignal): Promise<BorrowingRequestDetails> {
    const { data, error } = await supabase
      .from('borrowing_requests')
      .select(`
        id,
        request_code,
        committee_id,
        submitted_by,
        requester_name,
        requester_position,
        purpose,
        borrow_date,
        expected_return_date,
        additional_notes,
        status,
        rejection_reason,
        approved_by,
        approved_at,
        rejected_by,
        rejected_at,
        returned_at,
        submitted_at,
        created_at,
        updated_at,
        committee:committees (
          id,
          name
        ),
        submitter:profiles!borrowing_requests_submitted_by_fkey (
          id,
          username
        ),
        items:borrowing_request_items (
          id,
          item_id,
          quantity_requested,
          quantity_approved,
          quantity_returned,
          return_condition,
          return_notes,
          created_at,
          item:items (
            id,
            item_code,
            item_name,
            available_quantity,
            condition,
            is_active,
            category:categories (
              id,
              name,
              is_active
            )
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      throw error || new Error('Borrowing request not found.')
    }

    const rawItems = (data.items || []) as Array<{
      id: string
      item_id: string
      quantity_requested: number
      quantity_approved: number | null
      quantity_returned: number
      return_condition: ReturnCondition | null
      return_notes: string | null
      created_at: string
      item: {
        id: string
        item_code: string
        item_name: string
        available_quantity: number
        condition: BorrowingRequestDetails['items'][0]['item']['condition']
        is_active: boolean
        category: {
          id: string
          name: string
          is_active: boolean
        }
      }
    }>

    return {
      id: data.id,
      requestCode: data.request_code,
      committeeId: data.committee_id,
      submittedBy: data.submitted_by,
      requesterName: data.requester_name,
      requesterPosition: data.requester_position,
      purpose: data.purpose,
      borrowDate: data.borrow_date,
      expectedReturnDate: data.expected_return_date,
      additionalNotes: data.additional_notes,
      status: data.status,
      rejectionReason: data.rejection_reason,
      approvedBy: data.approved_by,
      approvedAt: data.approved_at,
      rejectedBy: data.rejected_by,
      rejectedAt: data.rejected_at,
      returnedAt: data.returned_at,
      submittedAt: data.submitted_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      committee: data.committee as { id: string; name: string },
      submitter: (data.submitter || { id: data.submitted_by, username: 'Unknown' }) as {
        id: string
        username: string
      },
      itemCount: rawItems.length,
      totalRequestedQuantity: rawItems.reduce((acc, curr) => acc + (curr.quantity_requested || 0), 0),
      items: rawItems.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        quantityRequested: r.quantity_requested,
        quantityApproved: r.quantity_approved,
        quantityReturned: r.quantity_returned,
        returnCondition: r.return_condition,
        returnNotes: r.return_notes,
        createdAt: r.created_at,
        item: {
          id: r.item.id,
          itemCode: r.item.item_code,
          itemName: r.item.item_name,
          availableQuantity: r.item.available_quantity,
          condition: r.item.condition,
          isActive: r.item.is_active,
          category: {
            id: r.item.category.id,
            name: r.item.category.name,
            isActive: r.item.category.is_active,
          },
        },
      })),
    }
  },

  async create(input: BorrowRequestInput) {
    const { data, error } = await supabase.rpc('create_borrowing_request', {
      p_requester_name: input.requesterName.trim(),
      p_requester_position: input.requesterPosition.trim(),
      p_purpose: input.purpose.trim(),
      p_borrow_date: input.borrowDate,
      p_expected_return_date: input.expectedReturnDate,
      p_additional_notes: input.additionalNotes?.trim() || null,
      p_items: input.items,
    })

    if (error) {
      throw error
    }

    const res = data as unknown as { id: string }
    const request = await this.get(res.id)
    return {
      success: true,
      message: 'Borrowing request submitted successfully.',
      data: { request },
    }
  },

  async approve(id: string, remarks?: string) {
    const { error } = await supabase.rpc('approve_borrowing_request', {
      p_request_id: id,
      p_remarks: remarks?.trim() || null,
    })

    if (error) {
      throw error
    }

    const request = await this.get(id)
    return {
      success: true,
      message: 'Borrowing request approved successfully.',
      data: { request },
    }
  },

  async reject(id: string, reason: string) {
    const { error } = await supabase.rpc('reject_borrowing_request', {
      p_request_id: id,
      p_reason: reason.trim(),
    })

    if (error) {
      throw error
    }

    const request = await this.get(id)
    return {
      success: true,
      message: 'Borrowing request rejected successfully.',
      data: { request },
    }
  },

  async processReturn(id: string, condition: ReturnCondition, notes?: string) {
    const { error } = await supabase.rpc('return_borrowing_request', {
      p_request_id: id,
      p_condition: condition,
      p_notes: notes?.trim() || null,
    })

    if (error) {
      throw error
    }

    const request = await this.get(id)
    return {
      success: true,
      message: 'Borrowing return processed successfully.',
      data: { request },
    }
  },
}
