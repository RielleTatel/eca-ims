import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthLayout } from '@/layouts/AuthLayout'
import { CommitteeLayout } from '@/layouts/CommitteeLayout'
import { LogisticsLayout } from '@/layouts/LogisticsLayout'
import { AuditLogsPage } from '@/pages/audit/AuditLogsPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { CategoriesPage } from '@/pages/categories/CategoriesPage'
import { CommitteeDashboardPage } from '@/pages/dashboard/CommitteeDashboardPage'
import { LogisticsDashboardPage } from '@/pages/dashboard/LogisticsDashboardPage'
import { InventoryPage } from '@/pages/inventory/InventoryPage'
import { ItemDetailsPage } from '@/pages/inventory/ItemDetailsPage'
import { ItemFormPage } from '@/pages/inventory/ItemFormPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { InventoryReportPage } from '@/pages/reports/InventoryReportPage'
import { SystemSettingsPage } from '@/pages/settings/SystemSettingsPage'
import { BorrowHistoryPage } from '@/pages/requests/BorrowHistoryPage'
import { CreateRequestPage } from '@/pages/requests/CreateRequestPage'
import { RequestDetailsPage } from '@/pages/requests/RequestDetailsPage'
import { RequestsPage } from '@/pages/requests/RequestsPage'
import { TransactionsPage } from '@/pages/transactions/TransactionsPage'
import { UnauthorizedPage } from '@/pages/UnauthorizedPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute'
import { RoleRoute } from '@/routes/RoleRoute'
import { RootRedirect } from '@/routes/RootRedirect'

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
              <Route path="requests" element={<RequestsPage />} />
              <Route path="requests/:requestId" element={<RequestDetailsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="settings" element={<SystemSettingsPage />} />
              <Route
                path="committees"
                element={<Navigate to="/logistics/settings" replace />}
              />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="reports" element={<InventoryReportPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
            </Route>
          </Route>
          <Route element={<RoleRoute allowedRoles={['COMMITTEE']} />}>
            <Route path="/committee" element={<CommitteeLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<CommitteeDashboardPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="inventory/:itemId" element={<ItemDetailsPage />} />
              <Route path="requests/new" element={<CreateRequestPage />} />
              <Route path="requests/history" element={<RequestsPage />} />
              <Route path="requests/:requestId" element={<RequestDetailsPage />} />
              <Route path="borrowing-history" element={<BorrowHistoryPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
