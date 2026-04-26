import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

const TITLES = {
  '/dashboard':       'Dashboard',
  '/wings':           'Business Wings',
  '/banks':           'Bank Accounts & Transactions',
  '/clients':         'Clients & Vendors',
  '/invoices':        'Invoices',
  '/purchase-orders': 'Purchase Orders',
  '/tax':             'Tax & Challans',
  '/resources':       'Resources & HR',
  '/attendance':      'Attendance & Leave',
  '/payroll':         'Payroll & Loans',
  '/bills':           'Bill Payments',
  '/travel':          'Travel Records',
  '/subscriptions':   'Monthly Subscriptions',
  '/reminders':       'Reminders & Calendar',
  '/users':           'User Management',
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] || 'Nexus';

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title={title} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
