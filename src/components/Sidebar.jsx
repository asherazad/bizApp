import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Building2, Landmark, Users2, FileText,
  ShoppingCart, Receipt, UserCheck, Calendar, Wallet,
  CreditCard, Plane, RefreshCw, Bell, Users, LogOut, HandCoins,
} from 'lucide-react';

const NAV = [
  { section: 'Overview' },
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
  { section: 'Finance' },
  { to: '/invoices',        icon: FileText,         label: 'Invoices' },
  { to: '/purchase-orders', icon: ShoppingCart,     label: 'Purchase Orders' },
  { to: '/banks',           icon: Landmark,         label: 'Bank Accounts' },
  { to: '/bills',           icon: CreditCard,       label: 'Bills' },
  { to: '/tax',             icon: Receipt,          label: 'Tax & Challans' },
  { section: 'HR' },
  { to: '/resources',       icon: UserCheck,        label: 'Resources' },
  { to: '/attendance',      icon: Calendar,         label: 'Attendance' },
  { to: '/loans',           icon: HandCoins,        label: 'Loans & Advances' },
  { to: '/payroll',         icon: Wallet,           label: 'Payroll & Salary' },
  { section: 'Operations' },
  { to: '/travel',          icon: Plane,            label: 'Travel' },
  { to: '/subscriptions',   icon: RefreshCw,        label: 'Subscriptions' },
  { to: '/reminders',       icon: Bell,             label: 'Reminders' },
  { to: '/clients',         icon: Users2,           label: 'Clients & Vendors' },
  { section: 'Admin' },
  { to: '/wings',           icon: Building2,        label: 'Business Wings' },
  { to: '/users',           icon: Users,            label: 'User Management' },
];

export default function Sidebar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <img src="/horizontal-sync-logo.svg" alt="SYNC" />
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map((item, i) => {
          if (item.section) return (
            <div key={i} className="sidebar-section">{item.section}</div>
          );
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <item.icon className="nav-icon" size={16}/>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--sidebar-hover)' }}>
        <div className="sidebar-user-email" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--sidebar-text-muted)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.name || user?.email}
        </div>
        <button
          className="nav-item"
          title="Sign Out"
          onClick={() => { logout(); navigate('/login'); }}
        >
          <LogOut size={15}/>
          <span className="nav-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
