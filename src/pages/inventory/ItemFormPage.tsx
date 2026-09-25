import axios from 'axios'
import { ArrowLeft, BadgeInfo, LoaderCircle, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/common/PageHeader'
import { AppSelect } from '@/components/common/AppSelect'
import { InlineError } from '@/components/states/InlineError'
import { PageLoading } from '@/components/states/PageLoading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api'
import { categoryService } from '@/services/categoryService'
import { itemService, type ItemInput } from '@/services/itemService'
import type { Category, ItemCondition } from '@/types/api'
import { formatEnumLabel } from '@/utils/formatEnumLabel'

interface ItemFormState {
  itemCode: string
  itemName: string
  description: string
  categoryId: string
  totalQuantity: string
  condition: ItemCondition
  storageLocation: string
  googleDriveFolderLink: string
}

const initialForm: ItemFormState = {
  itemCode: '',
  itemName: '',
  description: '',
  categoryId: '',
  totalQuantity: '1',
  condition: 'GOOD',
  storageLocation: '',
  googleDriveFolderLink: '',
}

const conditions: ItemCondition[] = ['GOOD', 'FAIR', 'DAMAGED', 'UNDER_REPAIR', 'LOST']

export function ItemFormPage() {
  const { itemId } = useParams()
  const isEditing = Boolean(itemId)
  const navigate = useNavigate()
  const { notify } = useToast()
  const [form, setForm] = useState(initialForm)
  const [originalCategoryId, setOriginalCategoryId] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const categoryRequest = categoryService.list(itemId ? undefined : true, controller.signal)

    if (itemId) {
      Promise.all([categoryRequest, itemService.get(itemId, controller.signal)])
        .then(([categoryResult, item]) => {
          setCategories(categoryResult)
          setOriginalCategoryId(item.categoryId)
          setForm({
            itemCode: item.itemCode,
            itemName: item.itemName,
            description: item.description ?? '',
            categoryId: item.categoryId,
            totalQuantity: String(item.totalQuantity),
            condition: item.condition,
            storageLocation: item.storageLocation,
            googleDriveFolderLink: item.googleDriveFolderLink ?? '',
          })
        })
        .catch((requestError: unknown) => {
          if (!axios.isCancel(requestError)) {
            setError(getApiErrorMessage(requestError, 'Inventory item could not be loaded.'))
          }
        })
        .finally(() => setIsLoading(false))
    } else {
      categoryRequest
        .then((categoryResult) => {
          setCategories(categoryResult)
          if (categoryResult.length > 0) {
            setForm((current) => ({ ...current, categoryId: categoryResult[0].id }))
          }
        })
        .catch((requestError: unknown) => {
          if (!axios.isCancel(requestError)) {
            setError(getApiErrorMessage(requestError, 'Categories could not be loaded.'))
          }
        })
        .finally(() => setIsLoading(false))
    }

    return () => controller.abort()
  }, [itemId])

  function updateField<K extends keyof ItemFormState>(field: K, value: ItemFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSaving) {
      return
    }

    const totalQuantity = Number(form.totalQuantity)

    if (
      !form.itemName.trim() ||
      !form.categoryId ||
      !form.storageLocation.trim() ||
      !Number.isInteger(totalQuantity) ||
      totalQuantity < 1
    ) {
      setError('Complete all required fields and enter a valid total quantity.')
      return
    }

    const input: ItemInput = {
      itemName: form.itemName.trim(),
      description: form.description.trim() || null,
      categoryId: form.categoryId,
      totalQuantity,
      condition: form.condition,
      storageLocation: form.storageLocation.trim(),
      googleDriveFolderLink: form.googleDriveFolderLink.trim() || null,
    }

    setIsSaving(true)
    setError(null)

    try {
      const updateInput: Partial<ItemInput> = { ...input }

      if (form.categoryId === originalCategoryId) {
        delete updateInput.categoryId
      }

      const response =
        isEditing && itemId
          ? await itemService.update(itemId, updateInput)
          : await itemService.create(input)
      notify({
        title: response.message ?? `Inventory item ${isEditing ? 'updated' : 'created'}.`,
        description: isEditing
          ? undefined
          : `Item code ${response.data.item.itemCode} was assigned automatically.`,
      })
      navigate('/logistics/inventory', { replace: true })
    } catch (saveError) {
      const message = getApiErrorMessage(saveError, 'Inventory item could not be saved.')
      setError(message)
      notify({ title: 'Inventory item was not saved.', description: message, tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <PageLoading label={isEditing ? 'Loading inventory item' : 'Loading inventory form'} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? 'Edit Inventory Item' : 'Add Inventory Item'}
        description={
          isEditing
            ? 'Update the item details. Its system-generated item code stays the same.'
            : 'Add the item details and the system will assign its item code.'
        }
        actions={
          <Button asChild variant="outline">
            <Link to="/logistics/inventory">
              <ArrowLeft aria-hidden="true" />
              Back to inventory
            </Link>
          </Button>
        }
      />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Item information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            {error ? <div className="md:col-span-2"><InlineError message={error} /></div> : null}
            {isEditing ? (
              <div className="space-y-2">
                <Label htmlFor="item-code">Item code</Label>
                <Input
                  id="item-code"
                  value={form.itemCode}
                  readOnly
                  className="bg-muted/50 font-mono"
                />
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 md:col-span-2">
                <BadgeInfo className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Item code generated automatically</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A permanent item code will be assigned after you save this item.
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="item-name">Item name *</Label>
              <Input
                id="item-name"
                value={form.itemName}
                onChange={(event) => updateField('itemName', event.target.value)}
                disabled={isLoading || isSaving}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-category">Category *</Label>
              <AppSelect
                id="item-category"
                value={form.categoryId}
                onValueChange={(value) => updateField('categoryId', value)}
                disabled={isLoading || isSaving}
                ariaLabel="Select item category"
                emptyLabel="Select a category"
                allowEmpty={false}
                options={categories.map((category) => ({
                  value: category.id,
                  label: `${category.name}${category.isActive ? '' : ' (inactive)'}`,
                  disabled: !category.isActive && category.id !== originalCategoryId,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-quantity">Total quantity *</Label>
              <Input
                id="item-quantity"
                type="number"
                min={1}
                step={1}
                value={form.totalQuantity}
                onChange={(event) => updateField('totalQuantity', event.target.value)}
                disabled={isLoading || isSaving}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-condition">Condition *</Label>
              <AppSelect
                id="item-condition"
                value={form.condition}
                onValueChange={(value) =>
                  updateField('condition', value as ItemCondition)
                }
                disabled={isLoading || isSaving}
                ariaLabel="Select item condition"
                emptyLabel="Select a condition"
                allowEmpty={false}
                options={conditions.map((condition) => ({
                  value: condition,
                  label: formatEnumLabel(condition),
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-location">Storage location *</Label>
              <Input
                id="item-location"
                value={form.storageLocation}
                onChange={(event) => updateField('storageLocation', event.target.value)}
                disabled={isLoading || isSaving}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="item-description">Description</Label>
              <textarea
                id="item-description"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                disabled={isLoading || isSaving}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="item-drive-link">Google Drive folder link</Label>
              <Input
                id="item-drive-link"
                type="url"
                value={form.googleDriveFolderLink}
                onChange={(event) => updateField('googleDriveFolderLink', event.target.value)}
                disabled={isLoading || isSaving}
                placeholder="https://drive.google.com/…"
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2 border-t pt-6">
            <Button asChild type="button" variant="outline">
              <Link to="/logistics/inventory">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isLoading || isSaving || categories.length === 0}>
              {isSaving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {isSaving ? 'Saving…' : 'Save item'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
