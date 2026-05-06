import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './layouts/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import Login from './pages/login/Login';
import Dashboard from './pages/dashboard/Dashboard';
import Wings from './pages/wings/Wings';
import Banks from './pages/banks/Banks';
import Clients from './pages/clients/Clients';
import Invoices from './pages/invoices/Invoices';
import PurchaseOrders from './pages/po/PurchaseOrders';
import Tax from './pages/tax/Tax';
import Resources from './pages/resources/Resources';
import Attendance from './pages/attendance/Attendance';
import Payroll from './pages/payroll/Payroll';
import Loans from './pages/loans/Loans';
import Bills from './pages/bills/Bills';
import Travel from './pages/travel/Travel';
import Subscriptions from './pages/subscriptions/Subscriptions';
import Reminders from './pages/reminders/Reminders';
import Users from './pages/users/Users';
import CreditCard from './pages/creditcard/CreditCard';
import Reports from './pages/reports/Reports';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"        element={<Dashboard />} />
          <Route path="/wings"            element={<Wings />} />
          <Route path="/banks"            element={<Banks />} />
          <Route path="/clients"          element={<Clients />} />
          <Route path="/invoices"         element={<Invoices />} />
          <Route path="/purchase-orders"  element={<PurchaseOrders />} />
          <Route path="/tax"              element={<Tax />} />
          <Route path="/resources"        element={<Resources />} />
          <Route path="/attendance"       element={<Attendance />} />
          <Route path="/payroll"          element={<Payroll />} />
          <Route path="/loans"            element={<Loans />} />
          <Route path="/bills"            element={<Bills />} />
          <Route path="/creditcard"       element={<CreditCard />} />
          <Route path="/travel"           element={<Travel />} />
          <Route path="/subscriptions"    element={<Subscriptions />} />
          <Route path="/reminders"        element={<Reminders />} />
          <Route path="/users"            element={<Users />} />
          <Route path="/reports"          element={<Reports />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
