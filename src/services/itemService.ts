import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type {
  InventoryItem,
  ItemBorrowingHistoryEntry,
  ItemCondition,
  Pagination,
  RequestStatus,
  SortOrder,
} from '@/types/api'

export interface ItemListParams {
  search?: string
  categoryId?: string
  condition?: ItemCondition
  isActive?: boolean
  availableOnly?: boolean
  page: number
  limit: number
  sortBy: 'itemName' | 'itemCode' | 'totalQuantity' | 'availableQuantity' | 'createdAt' | 'updatedAt'
  sortOrder: SortOrder
}

export interface ItemInput {
  itemName: string
  description?: string | null
  categoryId: string
  totalQuantity: number
  condition: ItemCondition
  storageLocation: string
  googleDriveFolderLink?: string | null
}

function generateItemCode(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `ITM-${id}`
}

const SORT_FIELD_MAP: Record<ItemListParams['sortBy'], string> = {
  itemName: 'item_name',
  itemCode: 'item_code',
  totalQuantity: 'total_quantity',
  availableQuantity: 'available_quantity',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

export const itemService = {
  async list(params: ItemListParams, _signal?: AbortSignal) {
    const { page, limit, search, categoryId, condition, isActive, availableOnly, sortBy, sortOrder } = params
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('items')
      .select(
        `
        id,
        item_code,
        category_id,
        item_name,
        description,
        total_quantity,
        available_quantity,
        condition,
        storage_location,
        google_drive_folder_link,
        is_active,
        created_at,
        updated_at,
        category:categories (
          id,
          name
        )
      `,
        { count: 'exact' },
      )

    if (search && search.trim()) {
      const term = search.trim()
      query = query.or(`item_name.ilike.%${term}%,item_code.ilike.%${term}%,storage_location.ilike.%${term}%`)
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (condition) {
      query = query.eq('condition', condition)
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive)
    }

    if (availableOnly) {
      query = query.gt('available_quantity', 0)
    }

    const sortColumn = SORT_FIELD_MAP[sortBy] || 'created_at'
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' }).range(from, to)

    const { data, count, error } = await query

    if (error) {
      throw error
    }

    const total = count ?? 0
    const totalPages = Math.ceil(total / limit) || 1

    const items: InventoryItem[] = (data || []).map((row) => ({
      id: row.id,
      itemCode: row.item_code,
      categoryId: row.category_id,
      itemName: row.item_name,
      description: row.description,
      totalQuantity: row.total_quantity,
      availableQuantity: row.available_quantity,
      condition: row.condition,
      storageLocation: row.storage_location,
      googleDriveFolderLink: row.google_drive_folder_link,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      category: row.category as { id: string; name: string },
    }))

    const pagination: Pagination = {
      page,
      limit,
      total,
      totalPages,
    }

    return { items, pagination }
  },

  async get(id: string, _signal?: AbortSignal): Promise<InventoryItem> {
    const { data, error } = await supabase
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
        google_drive_folder_link,
        is_active,
        created_at,
        updated_at,
        category:categories (
          id,
          name
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      throw error || new Error('Item not found.')
    }

    return {
      id: data.id,
      itemCode: data.item_code,
      categoryId: data.category_id,
      itemName: data.item_name,
      description: data.description,
      totalQuantity: data.total_quantity,
      availableQuantity: data.available_quantity,
      condition: data.condition,
      storageLocation: data.storage_location,
      googleDriveFolderLink: data.google_drive_folder_link,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      category: data.category as { id: string; name: string },
    }
  },

  async create(input: ItemInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const itemCode = generateItemCode()

    const { data, error } = await supabase
      .from('items')
      .insert({
        item_code: itemCode,
        category_id: input.categoryId,
        item_name: input.itemName.trim(),
        description: input.description?.trim() || null,
        total_quantity: input.totalQuantity,
        available_quantity: input.totalQuantity,
        condition: input.condition,
        storage_location: input.storageLocation.trim(),
        google_drive_folder_link: input.googleDriveFolderLink?.trim() || null,
        created_by: user?.id,
        updated_by: user?.id,
      })
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
        google_drive_folder_link,
        is_active,
        created_at,
        updated_at,
        category:categories (
          id,
          name
        )
      `)
      .single()

    if (error) {
      throw error
    }

    if (user?.id) {
      await supabase.from('inventory_transactions').insert({
        item_id: data.id,
        performed_by: user.id,
        transaction_type: 'ITEM_ADDED',
        quantity: input.totalQuantity,
        quantity_before: 0,
        quantity_after: input.totalQuantity,
        remarks: 'Initial item stock registration',
      })

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'CREATE_ITEM',
        entity_type: 'items',
        entity_id: data.id,
        description: `Created inventory item ${data.item_name} (${data.item_code})`,
        new_values: data as unknown as Json,
      })
    }

    const item: InventoryItem = {
      id: data.id,
      itemCode: data.item_code,
      categoryId: data.category_id,
      itemName: data.item_name,
      description: data.description,
      totalQuantity: data.total_quantity,
      availableQuantity: data.available_quantity,
      condition: data.condition,
      storageLocation: data.storage_location,
      googleDriveFolderLink: data.google_drive_folder_link,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      category: data.category as { id: string; name: string },
    }

    return {
      success: true,
      message: 'Item created successfully.',
      data: { item },
    }
  },

  async update(id: string, input: Partial<ItemInput> & { isActive?: boolean }) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const existing = await this.get(id)

    const payload: {
      category_id?: string
      item_name?: string
      description?: string | null
      total_quantity?: number
      available_quantity?: number
      condition?: ItemCondition
      storage_location?: string
      google_drive_folder_link?: string | null
      is_active?: boolean
      updated_by?: string | null
      updated_at?: string
    } = {
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    }

    if (input.categoryId) payload.category_id = input.categoryId
    if (input.itemName) payload.item_name = input.itemName.trim()
    if (input.description !== undefined) payload.description = input.description?.trim() || null
    if (input.condition) payload.condition = input.condition
    if (input.storageLocation) payload.storage_location = input.storageLocation.trim()
    if (input.googleDriveFolderLink !== undefined) {
      payload.google_drive_folder_link = input.googleDriveFolderLink?.trim() || null
    }
    if (input.isActive !== undefined) payload.is_active = input.isActive

    if (input.totalQuantity !== undefined && input.totalQuantity !== existing.totalQuantity) {
      const difference = input.totalQuantity - existing.totalQuantity
      const newAvailable = existing.availableQuantity + difference

      if (newAvailable < 0) {
        throw new Error('Total quantity cannot be reduced below the number of currently borrowed units.')
      }

      payload.total_quantity = input.totalQuantity
      payload.available_quantity = newAvailable

      if (user?.id) {
        await supabase.from('inventory_transactions').insert({
          item_id: id,
          performed_by: user.id,
          transaction_type: difference > 0 ? 'QUANTITY_INCREASED' : 'QUANTITY_DECREASED',
          quantity: Math.abs(difference),
          quantity_before: existing.totalQuantity,
          quantity_after: input.totalQuantity,
          remarks: 'Total quantity manually adjusted by administrator',
        })
      }
    }

    const { data, error } = await supabase
      .from('items')
      .update(payload)
      .eq('id', id)
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
        google_drive_folder_link,
        is_active,
        created_at,
        updated_at,
        category:categories (
          id,
          name
        )
      `)
      .single()

    if (error) {
      throw error
    }

    if (user?.id) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'UPDATE_ITEM',
        entity_type: 'items',
        entity_id: id,
        description: `Updated item ${data.item_name}`,
        old_values: existing as unknown as Json,
        new_values: data as unknown as Json,
      })
    }

    const item: InventoryItem = {
      id: data.id,
      itemCode: data.item_code,
      categoryId: data.category_id,
      itemName: data.item_name,
      description: data.description,
      totalQuantity: data.total_quantity,
      availableQuantity: data.available_quantity,
      condition: data.condition,
      storageLocation: data.storage_location,
      googleDriveFolderLink: data.google_drive_folder_link,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      category: data.category as { id: string; name: string },
    }

    return {
      success: true,
      message: 'Item updated successfully.',
      data: { item },
    }
  },

  async deactivate(id: string) {
    const existing = await this.get(id)
    if (existing.totalQuantity > existing.availableQuantity) {
      throw new Error('Item cannot be deactivated while units are currently borrowed.')
    }

    const res = await this.update(id, { isActive: false })
    return {
      success: true,
      message: 'Item deactivated successfully.',
      data: res.data,
    }
  },

  async history(id: string, page: number, limit: number, _signal?: AbortSignal) {
    const from = (page - 1) * limit
    const to = from + limit - 1

    const item = await this.get(id)

    const { data, count, error } = await supabase
      .from('borrowing_request_items')
      .select(
        `
        id,
        quantity_requested,
        quantity_approved,
        quantity_released,
        quantity_returned,
        return_condition,
        return_notes,
        borrowing_request:borrowing_requests!inner (
          id,
          request_code,
          requester_name,
          requester_position,
          purpose,
          borrow_date,
          expected_return_date,
          status,
          returned_at,
          submitted_by,
          committee:committees (
            id,
            name
          ),
          submitter:profiles!borrowing_requests_submitted_by_fkey (
            id,
            username
          )
        )
      `,
        { count: 'exact' },
      )
      .eq('item_id', id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      throw error
    }

    const total = count ?? 0
    const totalPages = Math.ceil(total / limit) || 1

    const history: ItemBorrowingHistoryEntry[] = (data || []).map((row) => {
      const req = row.borrowing_request as unknown as {
        id: string
        request_code: string
        requester_name: string
        requester_position: string
        purpose: string
        borrow_date: string
        expected_return_date: string
        status: RequestStatus
        returned_at: string | null
        submitted_by: string
        committee: { id: string; name: string }
        submitter: { id: string; username: string } | null
      }

      return {
        borrowingRequestId: req.id,
        requestCode: req.request_code,
        committee: req.committee,
        requester: {
          name: req.requester_name,
          position: req.requester_position,
          user: {
            id: req.submitter?.id || req.submitted_by,
            username: req.submitter?.username || 'User',
          },
        },
        borrowDate: req.borrow_date,
        expectedReturnDate: req.expected_return_date,
        returnedAt: req.returned_at,
        status: req.status,
        quantityRequested: row.quantity_requested,
        quantityApproved: row.quantity_approved,
        quantityReleased: row.quantity_released,
        quantityReturned: row.quantity_returned,
        returnCondition: row.return_condition,
        returnNotes: row.return_notes,
      }
    })

    return {
      item: {
        id: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        description: item.description,
        condition: item.condition,
        isActive: item.isActive,
        category: item.category,
      },
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }
  },
}
