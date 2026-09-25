import { createContext } from 'react'

export type UserRole = 'SUPER_ADMIN' | 'COMMITTEE'

export interface AuthUser {
  id: string
  username: string
  role: UserRole
  committee: {
    id: string
    name: string
  } | null
}

export interface AuthContextValue {
  user: AuthUser | null
  role: UserRole | null
  isAuthenticated: boolean
  isInitializing: boolean
  login: (credentials: LoginCredentials) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshSession: () => Promise<AuthUser | null>
  hasRole: (...roles: UserRole[]) => boolean
}

export interface LoginCredentials {
  username: string
  password: string
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
