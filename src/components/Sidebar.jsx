import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Building2, Landmark, Users2, FileText,
  ShoppingCart, Receipt, UserCheck, Calendar, Wallet,
  CreditCard, Plane, RefreshCw, Bell, Users, LogOut,
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
  { to: '/payroll',         icon: Wallet,           label: 'Payroll & Loans' },
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
      <div className="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#1e3a5f"/>
          <path d="M8 8h4l8 16h-4L8 8zm8 0h4l-8 16h-4l8-16z" fill="#f59e0b"/>
        </svg>
        <span className="sidebar-logo-text">Ne<span>xus</span></span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item, i) => {
          if (item.section) return <div key={i} className="sidebar-section">{item.section}</div>;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon className="nav-icon" size={16} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
          {user?.name}
        </div>
        <button
          className="nav-item"
          onClick={() => { logout(); navigate('/login'); }}
          style={{ color: 'rgba(255,255,255,.6)' }}
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
