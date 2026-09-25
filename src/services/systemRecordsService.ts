import { supabase } from '@/lib/supabase'
import type {
  AuditLogRecord,
  InventoryTransactionRecord,
  Pagination,
  SortOrder,
  TransactionType,
} from '@/types/api'

export interface InventoryTransactionListParams {
  search?: string
  transactionType?: TransactionType
  dateFrom?: string
  dateTo?: string
  page: number
  limit: number
  sortBy: 'createdAt' | 'transactionType' | 'quantity'
  sortOrder: SortOrder
}

export interface AuditLogListParams {
  search?: string
  action?: string
  entityType?: string
  dateFrom?: string
  dateTo?: string
  page: number
  limit: number
  sortBy: 'createdAt' | 'action' | 'entityType'
  sortOrder: SortOrder
}

const TX_SORT_MAP: Record<InventoryTransactionListParams['sortBy'], string> = {
  createdAt: 'created_at',
  transactionType: 'transaction_type',
  quantity: 'quantity',
}

const AUDIT_SORT_MAP: Record<AuditLogListParams['sortBy'], string> = {
  createdAt: 'created_at',
  action: 'action',
  entityType: 'entity_type',
}

export const systemRecordsService = {
  async inventoryTransactions(
    params: InventoryTransactionListParams,
    _signal?: AbortSignal,
  ) {
    const { page, limit, search, transactionType, dateFrom, dateTo, sortBy, sortOrder } = params
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('inventory_transactions')
      .select(
        `
        id,
        transaction_type,
        quantity,
        quantity_before,
        quantity_after,
        remarks,
        created_at,
        item:items (
          id,
          item_code,
          item_name
        ),
        borrowing_request:borrowing_requests (
          id,
          request_code
        ),
        performer:profiles (
          id,
          username
        )
      `,
        { count: 'exact' },
      )

    if (transactionType) {
      query = query.eq('transaction_type', transactionType)
    }

    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`)
    }

    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59.999Z`)
    }

    if (search && search.trim()) {
      query = query.ilike('remarks', `%${search.trim()}%`)
    }

    const sortCol = TX_SORT_MAP[sortBy] || 'created_at'
    query = query.order(sortCol, { ascending: sortOrder === 'asc' }).range(from, to)

    const { data, count, error } = await query

    if (error) {
      throw error
    }

    const total = count ?? 0
    const totalPages = Math.ceil(total / limit) || 1

    const transactions: InventoryTransactionRecord[] = (data || []).map((row) => {
      const rawItem = row.item as unknown as { id: string; item_code: string; item_name: string } | null
      const rawReq = row.borrowing_request as unknown as { id: string; request_code: string } | null
      const rawPerformer = row.performer as unknown as { id: string; username: string } | null

      return {
        id: row.id,
        transactionType: row.transaction_type,
        quantity: row.quantity,
        quantityBefore: row.quantity_before,
        quantityAfter: row.quantity_after,
        remarks: row.remarks,
        createdAt: row.created_at,
        item: {
          id: rawItem?.id || '',
          itemCode: rawItem?.item_code || '',
          itemName: rawItem?.item_name || 'Item',
        },
        borrowingRequest: rawReq
          ? {
              id: rawReq.id,
              requestCode: rawReq.request_code,
            }
          : null,
        performer: {
          id: rawPerformer?.id || '',
          username: rawPerformer?.username || 'System',
        },
      }
    })

    const pagination: Pagination = {
      page,
      limit,
      total,
      totalPages,
    }

    return { transactions, pagination }
  },

  async auditLogs(params: AuditLogListParams, _signal?: AbortSignal) {
    const { page, limit, search, action, entityType, dateFrom, dateTo, sortBy, sortOrder } = params
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('audit_logs')
      .select(
        `
        id,
        action,
        entity_type,
        entity_id,
        description,
        old_values,
        new_values,
        ip_address,
        created_at,
        user:profiles (
          id,
          username
        ),
        committee:committees (
          id,
          name
        )
      `,
        { count: 'exact' },
      )

    if (action) {
      query = query.eq('action', action)
    }

    if (entityType) {
      query = query.eq('entity_type', entityType)
    }

    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`)
    }

    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59.999Z`)
    }

    if (search && search.trim()) {
      query = query.or(`description.ilike.%${search.trim()}%,action.ilike.%${search.trim()}%`)
    }

    const sortCol = AUDIT_SORT_MAP[sortBy] || 'created_at'
    query = query.order(sortCol, { ascending: sortOrder === 'asc' }).range(from, to)

    const { data, count, error } = await query

    if (error) {
      throw error
    }

    const total = count ?? 0
    const totalPages = Math.ceil(total / limit) || 1

    const logs: AuditLogRecord[] = (data || []).map((row) => {
      const rawUser = row.user as unknown as { id: string; username: string } | null
      const rawCommittee = row.committee as unknown as { id: string; name: string } | null

      return {
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        description: row.description,
        oldValues: row.old_values,
        newValues: row.new_values,
        ipAddress: row.ip_address,
        createdAt: row.created_at,
        user: rawUser,
        committee: rawCommittee,
      }
    })

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filters: {
        actions: [
          'CREATE_ITEM',
          'UPDATE_ITEM',
          'CREATE_BORROW_REQUEST',
          'APPROVE_BORROW_REQUEST',
          'REJECT_BORROW_REQUEST',
          'PROCESS_RETURN',
          'CREATE_COMMITTEE',
          'UPDATE_COMMITTEE',
          'CREATE_CATEGORY',
          'UPDATE_CATEGORY',
          'UPDATE_SYSTEM_SETTINGS',
        ],
        entityTypes: ['items', 'borrowing_requests', 'committees', 'categories', 'profiles', 'system_settings'],
      },
    }
  },
}
