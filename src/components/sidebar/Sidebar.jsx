import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import { initials } from '../../lib/format'
import styles from './Sidebar.module.css'

const NAV = [
  { label: 'Overview', items: [
    { to: '/',            label: 'Dashboard',         dot: 'blue'   },
  ]},
  { label: 'Finance', items: [
    { to: '/invoices',    label: 'Invoices',           dot: 'teal'   },
    { to: '/quotations',  label: 'Quotations',         dot: 'teal'   },
    { to: '/clients',     label: 'Clients',            dot: 'teal'   },
    { to: '/expenses',    label: 'Expenses',           dot: 'teal'   },
    { to: '/bills',       label: 'Bill payments',      dot: 'teal'   },
    { to: '/subscriptions',label:'Subscriptions',      dot: 'teal'   },
    { to: '/purchase-orders',label:'Purchase orders',  dot: 'teal'   },
  ]},
  { label: 'Operations', items: [
    { to: '/inventory',   label: 'Inventory',          dot: 'amber'  },
    { to: '/resources',   label: 'Resources (HR)',      dot: 'amber'  },
  ]},
  { label: 'Strategy', items: [
    { to: '/forecasting', label: 'Forecasting',        dot: 'coral'  },
    { to: '/reports',     label: 'Reports & P&L',      dot: 'purple' },
  ]},
  { label: 'Settings', items: [
    { to: '/settings/departments', label: 'Departments', dot: 'gray' },
    { to: '/settings/users',       label: 'Users',        dot: 'gray' },
    { to: '/settings/roles',       label: 'Roles',        dot: 'gray' },
  ]},
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { tenant }       = useTenant()
  const navigate         = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoMark}>B</div>
        <div>
          <div className={styles.logoName}>{tenant?.name ?? 'BizPortal'}</div>
          <div className={styles.logoPlan}>{tenant?.plan ?? 'pro'} plan</div>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV.map(section => (
          <div key={section.label} className={styles.section}>
            <div className={styles.sectionLabel}>{section.label}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => [styles.navItem, isActive ? styles.active : ''].join(' ')}
              >
                <span className={`${styles.dot} ${styles[`dot-${item.dot}`]}`} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className={styles.userFooter}>
        <div className={styles.avatar}>{initials(user?.full_name ?? 'U')}</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{user?.full_name}</div>
          <div className={styles.userEmail}>{user?.email}</div>
        </div>
        <button className={`btn btn-ghost btn-icon btn-sm ${styles.logoutBtn}`} onClick={handleLogout} title="Sign out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </aside>
  )
}
