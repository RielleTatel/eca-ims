import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'

import { AuthLayout } from '@/layouts/AuthLayout'
import { LogisticsLayout } from '@/layouts/LogisticsLayout'
import { AuditLogsPage } from '@/pages/audit/AuditLogsPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { CategoriesPage } from '@/pages/categories/CategoriesPage'
import { LogisticsDashboardPage } from '@/pages/dashboard/LogisticsDashboardPage'
import { InventoryPage } from '@/pages/inventory/InventoryPage'
import { ItemDetailsPage } from '@/pages/inventory/ItemDetailsPage'
import { ItemFormPage } from '@/pages/inventory/ItemFormPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { InventoryReportPage } from '@/pages/reports/InventoryReportPage'
import { SystemSettingsPage } from '@/pages/settings/SystemSettingsPage'
import { BorrowingsPage } from '@/pages/borrowings/BorrowingsPage'
import { RecordBorrowingPage } from '@/pages/borrowings/RecordBorrowingPage'
import { BorrowingDetailsPage } from '@/pages/borrowings/BorrowingDetailsPage'
import { TransactionsPage } from '@/pages/transactions/TransactionsPage'
import { UnauthorizedPage } from '@/pages/UnauthorizedPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute'
import { RoleRoute } from '@/routes/RoleRoute'
import { RootRedirect } from '@/routes/RootRedirect'

function LegacyBorrowingRedirect() {
  const { requestId } = useParams()
  return <Navigate to={`/logistics/borrowings/${requestId}`} replace />
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route element={<RoleRoute allowedRoles={['SUPER_ADMIN']} />}>
            <Route path="/logistics" element={<LogisticsLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<LogisticsDashboardPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="inventory/new" element={<ItemFormPage />} />
              <Route path="inventory/:itemId" element={<ItemDetailsPage />} />
              <Route path="inventory/:itemId/edit" element={<ItemFormPage />} />
              <Route path="borrowings" element={<BorrowingsPage />} />
              <Route path="borrowings/new" element={<RecordBorrowingPage />} />
              <Route path="borrowings/:borrowingId" element={<BorrowingDetailsPage />} />
              <Route path="requests" element={<Navigate to="/logistics/borrowings" replace />} />
              <Route path="requests/:requestId" element={<LegacyBorrowingRedirect />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="settings" element={<SystemSettingsPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="reports" element={<InventoryReportPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
