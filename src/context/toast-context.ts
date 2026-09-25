import { createContext } from 'react'

export type ToastTone = 'success' | 'error'

export interface ToastInput {
  title: string
  description?: string
  tone?: ToastTone
}

export interface ToastContextValue {
  notify: (toast: ToastInput) => void
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined)
