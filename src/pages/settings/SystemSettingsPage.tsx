import { PageHeader } from '@/components/common/PageHeader'
import { OrganizationSettingsPanel } from '@/components/settings/OrganizationSettingsPanel'

export function SystemSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="System Settings" description="Manage ECA report and signatory details." />
      <OrganizationSettingsPanel />
    </div>
  )
}
