import type { LucideIcon } from 'lucide-react'

import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'

interface ModulePlaceholderPageProps {
  title: string
  description: string
  cardTitle: string
  cardDescription: string
  icon: LucideIcon
}

export function ModulePlaceholderPage(props: ModulePlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={props.title} description={props.description} />
      <SectionCard title={props.cardTitle} description="Module foundation">
        <EmptyState title="Ready for the next phase" description={props.cardDescription} icon={props.icon} />
      </SectionCard>
    </div>
  )
}
