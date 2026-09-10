import axios from 'axios'
import { Landmark, LoaderCircle, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { InlineError } from '@/components/states/InlineError'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api'
import { systemSettingsService } from '@/services/systemSettingsService'
import type { SystemSettings } from '@/types/api'

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return 'Using the default system value'
  }

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function OrganizationSettingsPanel() {
  const { notify } = useToast()
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [governorName, setGovernorName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    systemSettingsService
      .get(controller.signal)
      .then((result) => {
        setSettings(result)
        setGovernorName(result.siteaoGovernorName)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setError(getApiErrorMessage(requestError, 'System settings could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  const normalizedName = governorName.trim()
  const isDirty = normalizedName !== (settings?.siteaoGovernorName ?? '')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSaving || !isDirty) {
      return
    }

    if (normalizedName.length < 2) {
      setError('Enter the full name of the ECA Governor.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await systemSettingsService.update({
        siteaoGovernorName: normalizedName,
      })
      setSettings(response.data.settings)
      setGovernorName(response.data.settings.siteaoGovernorName)
      notify({
        title: response.message ?? 'System settings updated.',
        description: 'Future inventory report previews and PDFs will use the new governor name.',
      })
    } catch (saveError) {
      const message = getApiErrorMessage(saveError, 'System settings could not be saved.')
      setError(message)
      notify({
        title: 'System settings were not saved.',
        description: message,
        tone: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Landmark className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Report signatory</CardTitle>
            <CardDescription>
              Set the governor shown in the “Noted by” section of inventory reports.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {error ? <InlineError message={error} /> : null}
          <div className="max-w-xl space-y-2">
            <Label htmlFor="eca-governor-name">ECA Governor *</Label>
            {isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Input
                id="eca-governor-name"
                value={governorName}
                onChange={(event) => setGovernorName(event.target.value)}
                maxLength={150}
                autoComplete="name"
                disabled={isSaving}
                required
              />
            )}
            <p className="text-xs text-muted-foreground">
              The title “ECA Governor” stays fixed; only the person’s name changes.
            </p>
          </div>
          {!isLoading && settings ? (
            <p className="text-xs text-muted-foreground">
              Last updated: {formatUpdatedAt(settings.updatedAt)}
              {settings.updater ? ` by ${settings.updater.username}` : ''}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button
            type="submit"
            disabled={isLoading || isSaving || !isDirty || normalizedName.length < 2}
          >
            {isSaving ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
