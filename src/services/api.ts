import type { PostgrestError } from '@supabase/supabase-js'

export function getApiErrorMessage(error: unknown, fallback = 'An unexpected error occurred.'): string {
  if (!error) {
    return fallback
  }

  if (typeof error === 'string') {
    return error.trim() || fallback
  }

  // Handle Supabase PostgrestError or AuthError
  if (typeof error === 'object' && error !== null) {
    const pgError = error as Partial<PostgrestError>
    if (typeof pgError.message === 'string' && pgError.message.trim()) {
      return pgError.message
    }

    if ('error_description' in error && typeof (error as Record<string, unknown>).error_description === 'string') {
      return (error as Record<string, string>).error_description
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message
    }
  }

  return fallback
}

export async function getApiBlobErrorMessage(error: unknown, fallback: string): Promise<string> {
  return getApiErrorMessage(error, fallback)
}

// Export dummy api/baseUrl if any legacy references remain during migration
export const apiBaseUrl = ''
export const api = {}
