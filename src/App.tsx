import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeProvider'
import { ToastProvider } from '@/context/ToastProvider'
import { ServerStartupGate } from '@/components/startup/ServerStartupGate'
import { AppRoutes } from '@/routes/AppRoutes'

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ServerStartupGate>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ServerStartupGate>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
