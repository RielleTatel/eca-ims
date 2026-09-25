import { ArrowLeft, ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { getHomePath } from '@/lib/navigation'

export function UnauthorizedPage() {
  const { user } = useAuth()
  const destination = user ? getHomePath(user.role) : '/login'

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg border-t-2 border-t-primary">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldX className="size-7" aria-hidden="true" />
          </span>
          <p className="mt-6 text-sm font-semibold text-primary">ACCESS RESTRICTED</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">You cannot open this page</h1>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Your account is signed in, but this area is not available for your role.
          </p>
          <Button asChild className="mt-6">
            <Link to={destination}>
              <ArrowLeft aria-hidden="true" />
              Return to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
