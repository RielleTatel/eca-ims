import { ArrowLeft, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { getHomePath } from '@/lib/navigation'

export function NotFoundPage() {
  const { user } = useAuth()
  const destination = user ? getHomePath(user.role) : '/login'

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <SearchX className="size-7" aria-hidden="true" />
          </span>
          <p className="mt-6 text-sm font-medium text-primary">404</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Page not found</h1>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            The page you requested does not exist or may have moved.
          </p>
          <Button asChild className="mt-6">
            <Link to={destination}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              {user ? 'Return to dashboard' : 'Return to login'}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
