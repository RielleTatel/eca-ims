import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export interface DashboardMetric {
  label: string
  icon: LucideIcon
  value: number
  detail: string
  href: string
}

interface DashboardOverviewProps {
  metrics: DashboardMetric[]
  isLoading?: boolean
}

export function DashboardOverview({ metrics, isLoading = false }: DashboardOverviewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Link
          key={metric.label}
          to={metric.href}
          className="group rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`Open ${metric.label}`}
        >
          <Card className="h-full border-t-2 border-t-primary/70 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <metric.icon className="size-4" aria-hidden="true" />
              </span>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </>
              ) : (
                <>
                  <p className="font-heading text-3xl font-bold tabular-nums">{metric.value.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
