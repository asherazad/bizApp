import { Routes, Route, Navigate } from 'react-router-dom'
import { TenantProvider }   from './context/TenantContext'
import { AuthProvider }     from './context/AuthContext'
import { DeptProvider }     from './context/DeptContext'
import { ToastProvider }    from './context/ToastContext'
import AppLayout            from './layouts/AppLayout'
import ProtectedRoute       from './layouts/ProtectedRoute'
import Login                from './pages/login/Login'
import Dashboard            from './pages/dashboard/Dashboard'
import Users                from './pages/users/Users'
import Roles                from './pages/roles/Roles'
import Departments          from './pages/departments/Departments'
import Businesses           from './pages/businesses/Businesses'
import ComingSoon           from './pages/ComingSoon'
import Clients              from './pages/clients/Clients'
import InvoiceList          from './pages/invoices/InvoiceList'
import InvoiceUpload        from './pages/invoices/InvoiceUpload'
import InvoiceView          from './pages/invoices/InvoiceView'
import QuotationList        from './pages/quotations/QuotationList'

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <TenantProvider>
        <DeptProvider>
          {children}
        </DeptProvider>
      </TenantProvider>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <Protected>
              <AppLayout />
            </Protected>
          }>
            <Route index                             element={<Dashboard />} />

            {/* ── Invoices ── */}
            <Route path="invoices"                   element={<InvoiceList />} />
            <Route path="invoices/upload"            element={<InvoiceUpload />} />
            <Route path="invoices/:id"               element={<InvoiceView />} />

            {/* ── Clients ── */}
            <Route path="clients"                    element={<Clients />} />

            {/* ── Quotations ── */}
            <Route path="quotations"                 element={<QuotationList />} />
            <Route path="quotations/upload"          element={<InvoiceUpload />} />
            <Route path="quotations/:id"             element={<InvoiceView />} />

            {/* ── Other modules (Sprint 3+) ── */}
            <Route path="expenses"                   element={<ComingSoon title="Expenses" />} />
            <Route path="bills"                      element={<ComingSoon title="Bill payments" />} />
            <Route path="subscriptions"              element={<ComingSoon title="Subscriptions" />} />
            <Route path="purchase-orders"            element={<ComingSoon title="Purchase orders" />} />
            <Route path="inventory"                  element={<ComingSoon title="Inventory" />} />
            <Route path="resources"                  element={<ComingSoon title="Resources (HR)" />} />
            <Route path="forecasting"                element={<ComingSoon title="Forecasting" />} />
            <Route path="reports"                    element={<ComingSoon title="Reports & P&L" />} />

            {/* ── Settings ── */}
            <Route path="settings/users"             element={<Users />} />
            <Route path="settings/roles"             element={<Roles />} />
            <Route path="settings/departments"       element={<Departments />} />
            <Route path="settings/businesses"        element={<Businesses />} />
            <Route path="*"                          element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
