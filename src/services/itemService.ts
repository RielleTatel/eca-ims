import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type {
  InventoryItem,
  ItemCondition,
  Pagination,
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
  async delete(itemId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_inventory_item', { p_item_id: itemId })
    if (error) throw error
  },
  async list(params: ItemListParams, signal?: AbortSignal) {
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
        damaged_quantity,
        condition,
        storage_location,
        google_drive_folder_link,
        is_active,
        created_at,
        updated_at,
        category:categories!inner (
          id,
          name,
          is_active
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
      query = query.gt('available_quantity', 0).in('condition', ['GOOD', 'FAIR']).eq('category.is_active', true)
    }

    const sortColumn = SORT_FIELD_MAP[sortBy] || 'created_at'
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' }).range(from, to)

    if (signal) query = query.abortSignal(signal)
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
      damagedQuantity: row.damaged_quantity,
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

  async get(id: string, signal?: AbortSignal): Promise<InventoryItem> {
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
        damaged_quantity,
        condition,
        storage_location,
        google_drive_folder_link,
        is_active,
        created_at,
        updated_at,
        category:categories!inner (
          id,
          name,
          is_active
        )
      `)
      .eq('id', id)
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query.single()

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
      damagedQuantity: data.damaged_quantity,
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
        damaged_quantity,
        condition,
        storage_location,
        google_drive_folder_link,
        is_active,
        created_at,
        updated_at,
        category:categories!inner (
          id,
          name,
          is_active
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
      damagedQuantity: data.damaged_quantity,
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
    const { error } = await supabase.rpc('update_inventory_item', { p_item_id: id, p_input: input as Json })
    if (error) throw error
    return { success: true, message: 'Item updated successfully.', data: { item: await this.get(id) } }
  },

  async repair(id: string, quantity: number) {
    const { error } = await supabase.rpc('repair_inventory_units', { p_item_id: id, p_quantity: quantity })
    if (error) throw error
    return this.get(id)
  },

  async deactivate(id: string) {
    const existing = await this.get(id)
    if (existing.totalQuantity - existing.availableQuantity - existing.damagedQuantity > 0) {
      throw new Error('Item cannot be deactivated while units are currently borrowed.')
    }

    const res = await this.update(id, { isActive: false })
    return {
      success: true,
      message: 'Item deactivated successfully.',
      data: res.data,
    }
  },
}
