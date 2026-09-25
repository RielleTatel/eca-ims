import { type ReactNode } from 'react'

interface ServerStartupGateProps {
  children: ReactNode
}

/**
 * In the Supabase architecture, database connection and authentication are managed directly
 * by the Supabase client without requiring a cold-start backend server poll.
 */
export function ServerStartupGate({ children }: ServerStartupGateProps) {
  return <>{children}</>
}
