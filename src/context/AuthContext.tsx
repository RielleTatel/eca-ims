import { useEffect, useState, type ReactNode } from 'react'

import {
  AuthContext,
  type AuthContextValue,
  type AuthUser,
  type LoginCredentials,
  type UserRole,
} from '@/context/auth-context'
import { supabase } from '@/lib/supabase'
import { authService } from '@/services/authService'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    let active = true

    async function initializeAuth() {
      try {
        const sessionUser = await authService.getCurrentUser()
        if (active) {
          setUser(sessionUser)
        }
      } catch {
        if (active) {
          setUser(null)
        }
      } finally {
        if (active) {
          setIsInitializing(false)
        }
      }
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (!active) return

      if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        try {
          const updatedUser = await authService.getCurrentUser()
          if (active) {
            setUser(updatedUser)
          }
        } catch {
          if (active) {
            setUser(null)
          }
        }
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function login(credentials: LoginCredentials) {
    const authenticatedUser = await authService.login(credentials)
    setUser(authenticatedUser)
    return authenticatedUser
  }

  async function logout() {
    try {
      await authService.logout()
    } finally {
      setUser(null)
    }
  }

  async function refreshSession() {
    try {
      const refreshedUser = await authService.refreshSession()
      setUser(refreshedUser)
      return refreshedUser
    } catch {
      setUser(null)
      return null
    }
  }

  function hasRole(...roles: UserRole[]) {
    return user !== null && roles.includes(user.role)
  }

  const value: AuthContextValue = {
    user,
    role: user?.role ?? null,
    isAuthenticated: user !== null,
    isInitializing,
    login,
    logout,
    refreshSession,
    hasRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
