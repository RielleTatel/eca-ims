import { LoaderCircle } from 'lucide-react'

interface PageLoadingProps {
  label?: string
}

export function PageLoading({ label = 'Loading' }: PageLoadingProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-4 text-center" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </main>
  )
}
